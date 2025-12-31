import { IVerificationService, VerificationCode, ISmsProvider } from '../interfaces';
import {
  SmsVerificationExpiredError,
  SmsVerificationInvalidError,
  SmsVerificationMaxAttemptsError,
  SmsRateLimitError,
} from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { ThreeTierRateLimiter } from '../../common/security/rate-limiter';
import { v4 as uuidv4 } from 'uuid';

interface VerificationConfig {
  codeLength: number;
  expiresInMinutes: number;
  maxAttempts: number;
  rateLimitPerHour: number;
}

export class VerificationService implements IVerificationService {
  private verifications: Map<string, VerificationCode> = new Map();
  private provider: ISmsProvider;
  private logger: PlatformLogger;
  private rateLimiter: ThreeTierRateLimiter;
  private config: VerificationConfig;

  constructor(
    provider: ISmsProvider,
    logger: PlatformLogger,
    rateLimiter: ThreeTierRateLimiter,
    config?: Partial<VerificationConfig>
  ) {
    this.provider = provider;
    this.logger = logger;
    this.rateLimiter = rateLimiter;
    this.config = {
      codeLength: 6,
      expiresInMinutes: 10,
      maxAttempts: 3,
      rateLimitPerHour: 5,
      ...config,
    };
  }

  async create(
    phoneNumber: string,
    options?: {
      channel?: 'sms' | 'call';
      codeLength?: number;
      expiresInMinutes?: number;
      locale?: string;
    }
  ): Promise<{ verificationId: string; expiresAt: Date }> {
    const timer = this.logger.startTimer('verification_create');

    try {
      this.rateLimiter.checkOrThrow('platform', 'sms_verification', phoneNumber);

      const existingVerification = this.verifications.get(phoneNumber);
      if (existingVerification && existingVerification.status === 'pending') {
        const timeSinceCreation = Date.now() - existingVerification.createdAt.getTime();
        if (timeSinceCreation < 60000) {
          throw new SmsRateLimitError(phoneNumber);
        }
      }

      const codeLength = options?.codeLength || this.config.codeLength;
      const expiresInMinutes = options?.expiresInMinutes || this.config.expiresInMinutes;
      const channel = options?.channel || 'sms';

      const code = this.generateCode(codeLength);
      const verificationId = uuidv4();
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

      const verification: VerificationCode = {
        id: verificationId,
        phoneNumber,
        code,
        channel,
        status: 'pending',
        attempts: 0,
        maxAttempts: this.config.maxAttempts,
        expiresAt,
        createdAt: new Date(),
      };

      this.verifications.set(phoneNumber, verification);

      const message = this.formatVerificationMessage(code, options?.locale);

      await this.provider.send({
        to: phoneNumber,
        body: message,
      });

      this.logger.event(EventTypes.SMS_VERIFICATION_CREATED, {
        verificationId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        channel,
        expiresAt,
      });

      this.logger.audit({
        eventType: EventTypes.SMS_VERIFICATION_CREATED,
        operation: 'create',
        resource: 'verification',
        resourceId: verificationId,
        newValue: { phoneNumber: this.maskPhoneNumber(phoneNumber), channel },
        success: true,
        correlationId: verificationId,
      });

      timer(true, { verificationId });

      return { verificationId, expiresAt };
    } catch (error) {
      timer(false, { error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  async verify(
    phoneNumber: string,
    code: string
  ): Promise<{ valid: boolean; verificationId?: string }> {
    const timer = this.logger.startTimer('verification_verify');

    const verification = this.verifications.get(phoneNumber);

    if (!verification) {
      this.logger.event(EventTypes.SMS_VERIFICATION_FAILED, {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        reason: 'not_found',
      });
      timer(false, { reason: 'not_found' });
      return { valid: false };
    }

    if (verification.status !== 'pending') {
      this.logger.event(EventTypes.SMS_VERIFICATION_FAILED, {
        verificationId: verification.id,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        reason: 'already_used',
        status: verification.status,
      });
      timer(false, { reason: 'already_used' });
      return { valid: false };
    }

    if (new Date() > verification.expiresAt) {
      verification.status = 'expired';
      this.logger.event(EventTypes.SMS_VERIFICATION_EXPIRED, {
        verificationId: verification.id,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
      });
      timer(false, { reason: 'expired' });
      throw new SmsVerificationExpiredError(phoneNumber);
    }

    verification.attempts++;

    if (verification.attempts > verification.maxAttempts) {
      verification.status = 'failed';
      this.logger.event(EventTypes.SMS_VERIFICATION_FAILED, {
        verificationId: verification.id,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        reason: 'max_attempts',
        attempts: verification.attempts,
      });
      timer(false, { reason: 'max_attempts' });
      throw new SmsVerificationMaxAttemptsError(phoneNumber);
    }

    if (verification.code !== code) {
      this.logger.event(EventTypes.SMS_VERIFICATION_FAILED, {
        verificationId: verification.id,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        reason: 'invalid_code',
        attempts: verification.attempts,
        remainingAttempts: verification.maxAttempts - verification.attempts,
      });
      timer(false, { reason: 'invalid_code' });
      throw new SmsVerificationInvalidError(phoneNumber);
    }

    verification.status = 'verified';
    verification.verifiedAt = new Date();

    this.logger.event(EventTypes.SMS_VERIFICATION_VALIDATED, {
      verificationId: verification.id,
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      attempts: verification.attempts,
    });

    this.logger.audit({
      eventType: EventTypes.SMS_VERIFICATION_VALIDATED,
      operation: 'verify',
      resource: 'verification',
      resourceId: verification.id,
      newValue: { verified: true, attempts: verification.attempts },
      success: true,
      correlationId: verification.id,
    });

    timer(true, { verificationId: verification.id });

    return { valid: true, verificationId: verification.id };
  }

  async cancel(phoneNumber: string): Promise<boolean> {
    const verification = this.verifications.get(phoneNumber);
    if (!verification || verification.status !== 'pending') {
      return false;
    }

    this.verifications.delete(phoneNumber);

    this.logger.audit({
      eventType: EventTypes.SMS_VERIFICATION_FAILED,
      operation: 'cancel',
      resource: 'verification',
      resourceId: verification.id,
      success: true,
      correlationId: verification.id,
    });

    return true;
  }

  async getStatus(phoneNumber: string): Promise<VerificationCode | null> {
    const verification = this.verifications.get(phoneNumber);
    if (!verification) {
      return null;
    }

    if (verification.status === 'pending' && new Date() > verification.expiresAt) {
      verification.status = 'expired';
    }

    return {
      ...verification,
      code: '******',
    };
  }

  private generateCode(length: number): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    return code;
  }

  private formatVerificationMessage(code: string, locale?: string): string {
    const messages: Record<string, string> = {
      en: `Your verification code is: ${code}. This code expires in ${this.config.expiresInMinutes} minutes.`,
      es: `Tu codigo de verificacion es: ${code}. Este codigo expira en ${this.config.expiresInMinutes} minutos.`,
      fr: `Votre code de verification est: ${code}. Ce code expire dans ${this.config.expiresInMinutes} minutes.`,
      de: `Ihr Verifizierungscode lautet: ${code}. Dieser Code lauft in ${this.config.expiresInMinutes} Minuten ab.`,
      pt: `Seu codigo de verificacao e: ${code}. Este codigo expira em ${this.config.expiresInMinutes} minutos.`,
      zh: `您的验证码是: ${code}。此代码将在 ${this.config.expiresInMinutes} 分钟后过期。`,
      ja: `認証コード: ${code}。このコードは ${this.config.expiresInMinutes} 分後に期限切れになります。`,
      ko: `인증 코드: ${code}. 이 코드는 ${this.config.expiresInMinutes}분 후에 만료됩니다.`,
    };

    return messages[locale || 'en'] || messages['en'];
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return '****';
    }
    return phoneNumber.slice(0, 3) + '****' + phoneNumber.slice(-2);
  }

  clearVerifications(): void {
    this.verifications.clear();
  }

  getVerificationCount(): number {
    return this.verifications.size;
  }
}

export default VerificationService;
