import { ISmsTemplateService, SmsTemplate } from '../interfaces';
import { SmsTemplateNotFoundError } from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';

export class SmsTemplateService implements ISmsTemplateService {
  private templates: Map<string, SmsTemplate> = new Map();
  private templatesByName: Map<string, string> = new Map();
  private logger: PlatformLogger;

  constructor(logger: PlatformLogger) {
    this.logger = logger;
  }

  async create(
    template: Omit<SmsTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SmsTemplate> {
    const id = uuidv4();
    const now = new Date();

    const variables = this.extractVariables(template.content);

    const newTemplate: SmsTemplate = {
      ...template,
      id,
      variables,
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(id, newTemplate);
    this.templatesByName.set(template.name.toLowerCase(), id);

    this.logger.audit({
      eventType: EventTypes.EMAIL_TEMPLATE_CREATED,
      operation: 'create',
      resource: 'sms_template',
      resourceId: id,
      newValue: { name: template.name, category: template.category },
      success: true,
      correlationId: uuidv4(),
    });

    return newTemplate;
  }

  async update(id: string, updates: Partial<SmsTemplate>): Promise<SmsTemplate> {
    const existing = this.templates.get(id);
    if (!existing) {
      throw new SmsTemplateNotFoundError(id);
    }

    let variables = existing.variables;
    if (updates.content) {
      variables = this.extractVariables(updates.content);
    }

    const updated: SmsTemplate = {
      ...existing,
      ...updates,
      id,
      variables,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    if (updates.name && updates.name !== existing.name) {
      this.templatesByName.delete(existing.name.toLowerCase());
      this.templatesByName.set(updates.name.toLowerCase(), id);
    }

    this.templates.set(id, updated);

    this.logger.audit({
      eventType: EventTypes.EMAIL_TEMPLATE_UPDATED,
      operation: 'update',
      resource: 'sms_template',
      resourceId: id,
      oldValue: { name: existing.name },
      newValue: { name: updated.name },
      success: true,
      correlationId: uuidv4(),
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = this.templates.get(id);
    if (!existing) {
      throw new SmsTemplateNotFoundError(id);
    }

    this.templates.delete(id);
    this.templatesByName.delete(existing.name.toLowerCase());

    this.logger.audit({
      eventType: EventTypes.EMAIL_TEMPLATE_DELETED,
      operation: 'delete',
      resource: 'sms_template',
      resourceId: id,
      oldValue: { name: existing.name },
      success: true,
      correlationId: uuidv4(),
    });
  }

  async get(id: string): Promise<SmsTemplate | null> {
    return this.templates.get(id) || null;
  }

  async getByName(name: string): Promise<SmsTemplate | null> {
    const id = this.templatesByName.get(name.toLowerCase());
    if (!id) return null;
    return this.templates.get(id) || null;
  }

  async list(filter?: { category?: string; isActive?: boolean }): Promise<SmsTemplate[]> {
    let templates = Array.from(this.templates.values());

    if (filter?.category) {
      templates = templates.filter((t) => t.category === filter.category);
    }

    if (filter?.isActive !== undefined) {
      templates = templates.filter((t) => t.isActive === filter.isActive);
    }

    return templates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async render(templateId: string, data: Record<string, unknown>): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new SmsTemplateNotFoundError(templateId);
    }

    if (!template.isActive) {
      throw new Error(`SMS template ${templateId} is inactive`);
    }

    return this.renderString(template.content, data);
  }

  private extractVariables(content: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const variable = match[1].trim();
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  private renderString(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmedKey = key.trim();
      const value = this.getNestedValue(data, trimmedKey);
      return value !== undefined ? String(value) : `{{${trimmedKey}}}`;
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  getTemplateCount(): number {
    return this.templates.size;
  }

  clearTemplates(): void {
    this.templates.clear();
    this.templatesByName.clear();
  }
}

export default SmsTemplateService;
