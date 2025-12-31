import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ValidationException } from '../exceptions';

@Injectable()
export class PartyValidationPipe implements PipeTransform<unknown> {
  async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    if (typeof value === 'object' && value !== null) {
      value = this.sanitizeObject(value as Record<string, unknown>);
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      const validationErrors: Record<string, string[]> = {};

      for (const error of errors) {
        const property = error.property;
        const constraints = error.constraints;

        if (constraints) {
          validationErrors[property] = Object.values(constraints);
        }

        if (error.children && error.children.length > 0) {
          for (const child of error.children) {
            const childProperty = `${property}.${child.property}`;
            if (child.constraints) {
              validationErrors[childProperty] = Object.values(child.constraints);
            }
          }
        }
      }

      throw new ValidationException('Validation failed', { errors: validationErrors });
    }

    return object;
  }

  private toValidate(metatype: new (...args: unknown[]) => unknown): boolean {
    const types: (new (...args: unknown[]) => unknown)[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) => {
          if (typeof item === 'string') {
            return this.sanitizeString(item);
          }
          if (typeof item === 'object' && item !== null) {
            return this.sanitizeObject(item as Record<string, unknown>);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeString(str: string): string {
    return str
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }
}
