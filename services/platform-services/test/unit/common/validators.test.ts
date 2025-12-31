import {
  sendEmailRequestSchema,
  emailTemplateSchema,
  sendSmsRequestSchema,
  smsTemplateSchema,
  verificationRequestSchema,
  verificationCheckSchema,
  fileUploadRequestSchema,
  signedUrlRequestSchema,
  fileListRequestSchema,
  configValueSchema,
  featureFlagSchema,
  secretSchema,
} from '../../../src/common/validators';

describe('Email Validators', () => {
  describe('sendEmailRequestSchema', () => {
    it('should validate a valid email request', () => {
      const validRequest = {
        to: ['test@example.com'],
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      };
      const result = sendEmailRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate email request with all fields', () => {
      const fullRequest = {
        to: ['test@example.com', 'test2@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        from: 'sender@example.com',
        replyTo: 'reply@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: 'Test content',
        templateId: 'template-123',
        templateData: { name: 'John' },
        priority: 'high',
        tags: ['marketing'],
        trackOpens: true,
        trackClicks: true,
        scheduledAt: new Date().toISOString(),
      };
      const result = sendEmailRequestSchema.safeParse(fullRequest);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const invalidRequest = {
        to: ['invalid-email'],
        subject: 'Test',
        html: '<p>Test</p>',
      };
      const result = sendEmailRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject empty to array', () => {
      const invalidRequest = {
        to: [],
        subject: 'Test',
        html: '<p>Test</p>',
      };
      const result = sendEmailRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject missing subject', () => {
      const invalidRequest = {
        to: ['test@example.com'],
        html: '<p>Test</p>',
      };
      const result = sendEmailRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('emailTemplateSchema', () => {
    it('should validate a valid email template', () => {
      const validTemplate = {
        name: 'welcome-email',
        subject: 'Welcome {{name}}!',
        htmlContent: '<h1>Welcome {{name}}</h1>',
        category: 'onboarding',
      };
      const result = emailTemplateSchema.safeParse(validTemplate);
      expect(result.success).toBe(true);
    });

    it('should validate template with all fields', () => {
      const fullTemplate = {
        name: 'welcome-email',
        subject: 'Welcome {{name}}!',
        htmlContent: '<h1>Welcome {{name}}</h1>',
        textContent: 'Welcome {{name}}',
        category: 'onboarding',
        description: 'Welcome email for new users',
        isActive: true,
        metadata: { version: '1.0' },
      };
      const result = emailTemplateSchema.safeParse(fullTemplate);
      expect(result.success).toBe(true);
    });

    it('should reject template without name', () => {
      const invalidTemplate = {
        subject: 'Test',
        htmlContent: '<p>Test</p>',
      };
      const result = emailTemplateSchema.safeParse(invalidTemplate);
      expect(result.success).toBe(false);
    });
  });
});

describe('SMS Validators', () => {
  describe('sendSmsRequestSchema', () => {
    it('should validate a valid SMS request', () => {
      const validRequest = {
        to: '+14155551234',
        body: 'Test message',
      };
      const result = sendSmsRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate SMS request with template', () => {
      const templateRequest = {
        to: '+14155551234',
        templateId: 'template-123',
        templateData: { code: '123456' },
      };
      const result = sendSmsRequestSchema.safeParse(templateRequest);
      expect(result.success).toBe(true);
    });

    it('should validate SMS request with all fields', () => {
      const fullRequest = {
        to: '+14155551234',
        from: '+14155559999',
        body: 'Test message',
        mediaUrls: ['https://example.com/image.jpg'],
        scheduledAt: new Date().toISOString(),
        validityPeriod: 3600,
        priority: 'high',
        metadata: { campaign: 'test' },
      };
      const result = sendSmsRequestSchema.safeParse(fullRequest);
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone number', () => {
      const invalidRequest = {
        to: '123',
        body: 'Test',
      };
      const result = sendSmsRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('smsTemplateSchema', () => {
    it('should validate a valid SMS template', () => {
      const validTemplate = {
        name: 'verification-code',
        content: 'Your code is {{code}}',
        category: 'verification',
      };
      const result = smsTemplateSchema.safeParse(validTemplate);
      expect(result.success).toBe(true);
    });

    it('should reject template without name', () => {
      const invalidTemplate = {
        content: 'Test content',
      };
      const result = smsTemplateSchema.safeParse(invalidTemplate);
      expect(result.success).toBe(false);
    });
  });

  describe('verificationRequestSchema', () => {
    it('should validate a valid verification request', () => {
      const validRequest = {
        phoneNumber: '+14155551234',
      };
      const result = verificationRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate verification request with options', () => {
      const fullRequest = {
        phoneNumber: '+14155551234',
        channel: 'sms',
        codeLength: 6,
        expiresInMinutes: 10,
        locale: 'en',
      };
      const result = verificationRequestSchema.safeParse(fullRequest);
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone number', () => {
      const invalidRequest = {
        phoneNumber: 'invalid',
      };
      const result = verificationRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('verificationCheckSchema', () => {
    it('should validate a valid verification check', () => {
      const validCheck = {
        phoneNumber: '+14155551234',
        code: '123456',
      };
      const result = verificationCheckSchema.safeParse(validCheck);
      expect(result.success).toBe(true);
    });

    it('should reject missing code', () => {
      const invalidCheck = {
        phoneNumber: '+14155551234',
      };
      const result = verificationCheckSchema.safeParse(invalidCheck);
      expect(result.success).toBe(false);
    });
  });
});

describe('Storage Validators', () => {
  describe('fileUploadRequestSchema', () => {
    it('should validate a valid file upload request', () => {
      const validRequest = {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      };
      const result = fileUploadRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate file upload with all options', () => {
      const fullRequest = {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        bucket: 'my-bucket',
        path: 'uploads/images',
        isPublic: true,
        metadata: { userId: '123' },
        tags: { project: 'test' },
      };
      const result = fileUploadRequestSchema.safeParse(fullRequest);
      expect(result.success).toBe(true);
    });

    it('should reject missing filename', () => {
      const invalidRequest = {
        contentType: 'image/jpeg',
      };
      const result = fileUploadRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('signedUrlRequestSchema', () => {
    it('should validate a valid signed URL request', () => {
      const validRequest = {
        fileKey: 'uploads/test.jpg',
        operation: 'get',
      };
      const result = signedUrlRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate signed URL request with expiration', () => {
      const fullRequest = {
        fileKey: 'uploads/test.jpg',
        operation: 'put',
        expiresInSeconds: 3600,
        contentType: 'image/jpeg',
      };
      const result = signedUrlRequestSchema.safeParse(fullRequest);
      expect(result.success).toBe(true);
    });

    it('should reject invalid operation', () => {
      const invalidRequest = {
        fileKey: 'test.jpg',
        operation: 'invalid',
      };
      const result = signedUrlRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('fileListRequestSchema', () => {
    it('should validate a valid file list request', () => {
      const validRequest = {
        prefix: 'uploads/',
        maxKeys: 100,
      };
      const result = fileListRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate empty request', () => {
      const result = fileListRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe('Config Validators', () => {
  describe('configValueSchema', () => {
    it('should validate a string config value', () => {
      const validConfig = {
        key: 'API_URL',
        value: 'https://api.example.com',
        type: 'string',
      };
      const result = configValueSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should validate a number config value', () => {
      const validConfig = {
        key: 'PORT',
        value: 3000,
        type: 'number',
      };
      const result = configValueSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should validate a boolean config value', () => {
      const validConfig = {
        key: 'DEBUG',
        value: true,
        type: 'boolean',
      };
      const result = configValueSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should validate config with all fields', () => {
      const fullConfig = {
        key: 'SETTINGS',
        value: { nested: 'value' },
        type: 'json',
        description: 'Application settings',
        isSecret: false,
        environment: 'production',
        metadata: { version: '1.0' },
      };
      const result = configValueSchema.safeParse(fullConfig);
      expect(result.success).toBe(true);
    });

    it('should reject missing key', () => {
      const invalidConfig = {
        value: 'test',
        type: 'string',
      };
      const result = configValueSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('featureFlagSchema', () => {
    it('should validate a valid feature flag', () => {
      const validFlag = {
        name: 'new-feature',
        enabled: true,
        rolloutPercentage: 50,
      };
      const result = featureFlagSchema.safeParse(validFlag);
      expect(result.success).toBe(true);
    });

    it('should validate feature flag with targeting', () => {
      const fullFlag = {
        name: 'beta-feature',
        description: 'Beta feature for testing',
        enabled: true,
        rolloutPercentage: 25,
        targetUsers: ['user-1', 'user-2'],
        targetGroups: ['beta-testers'],
        conditions: [
          { field: 'country', operator: 'eq', value: 'US' },
        ],
        metadata: { owner: 'team-a' },
      };
      const result = featureFlagSchema.safeParse(fullFlag);
      expect(result.success).toBe(true);
    });

    it('should reject invalid rollout percentage', () => {
      const invalidFlag = {
        name: 'test-flag',
        enabled: true,
        rolloutPercentage: 150,
      };
      const result = featureFlagSchema.safeParse(invalidFlag);
      expect(result.success).toBe(false);
    });
  });

  describe('secretSchema', () => {
    it('should validate a valid secret', () => {
      const validSecret = {
        name: 'DB_PASSWORD',
        value: 'secret-value',
      };
      const result = secretSchema.safeParse(validSecret);
      expect(result.success).toBe(true);
    });

    it('should validate secret with all fields', () => {
      const fullSecret = {
        name: 'API_KEY',
        value: 'secret-api-key',
        description: 'External API key',
        environment: 'production',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        rotationPolicy: {
          enabled: true,
          intervalDays: 30,
        },
        metadata: { service: 'external-api' },
      };
      const result = secretSchema.safeParse(fullSecret);
      expect(result.success).toBe(true);
    });

    it('should reject missing name', () => {
      const invalidSecret = {
        value: 'secret-value',
      };
      const result = secretSchema.safeParse(invalidSecret);
      expect(result.success).toBe(false);
    });
  });
});
