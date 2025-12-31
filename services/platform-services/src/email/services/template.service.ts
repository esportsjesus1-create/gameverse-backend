import { IEmailTemplateService, EmailTemplate, EmailTemplateRenderResult } from '../interfaces';
import { EmailTemplateNotFoundError, EmailTemplateRenderError } from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';

export class EmailTemplateService implements IEmailTemplateService {
  private templates: Map<string, EmailTemplate> = new Map();
  private templatesByName: Map<string, string> = new Map();
  private logger: PlatformLogger;

  constructor(logger: PlatformLogger) {
    this.logger = logger;
  }

  async create(
    template: Omit<EmailTemplate, 'id' | 'version' | 'createdAt' | 'updatedAt'>
  ): Promise<EmailTemplate> {
    const timer = this.logger.startTimer('email_template_create');

    const id = uuidv4();
    const now = new Date();

    const variables = this.extractVariables(template.htmlContent);
    if (template.textContent) {
      const textVariables = this.extractVariables(template.textContent);
      for (const v of textVariables) {
        if (!variables.includes(v)) {
          variables.push(v);
        }
      }
    }
    const subjectVariables = this.extractVariables(template.subject);
    for (const v of subjectVariables) {
      if (!variables.includes(v)) {
        variables.push(v);
      }
    }

    const newTemplate: EmailTemplate = {
      ...template,
      id,
      variables,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(id, newTemplate);
    this.templatesByName.set(template.name.toLowerCase(), id);

    this.logger.event(EventTypes.EMAIL_TEMPLATE_CREATED, {
      templateId: id,
      name: template.name,
      variables,
    });

    this.logger.audit({
      eventType: EventTypes.EMAIL_TEMPLATE_CREATED,
      operation: 'create',
      resource: 'email_template',
      resourceId: id,
      newValue: { name: template.name, category: template.category },
      success: true,
      correlationId: uuidv4(),
    });

    timer(true, { templateId: id });

    return newTemplate;
  }

  async update(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const timer = this.logger.startTimer('email_template_update');

    const existing = this.templates.get(id);
    if (!existing) {
      timer(false, { templateId: id, error: 'not_found' });
      throw new EmailTemplateNotFoundError(id);
    }

    const oldValue = { ...existing };

    let variables = existing.variables;
    if (updates.htmlContent || updates.textContent || updates.subject) {
      variables = this.extractVariables(updates.htmlContent || existing.htmlContent);
      const textContent = updates.textContent || existing.textContent;
      if (textContent) {
        const textVariables = this.extractVariables(textContent);
        for (const v of textVariables) {
          if (!variables.includes(v)) {
            variables.push(v);
          }
        }
      }
      const subject = updates.subject || existing.subject;
      const subjectVariables = this.extractVariables(subject);
      for (const v of subjectVariables) {
        if (!variables.includes(v)) {
          variables.push(v);
        }
      }
    }

    const updated: EmailTemplate = {
      ...existing,
      ...updates,
      id,
      variables,
      version: existing.version + 1,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    if (updates.name && updates.name !== existing.name) {
      this.templatesByName.delete(existing.name.toLowerCase());
      this.templatesByName.set(updates.name.toLowerCase(), id);
    }

    this.templates.set(id, updated);

    this.logger.event(EventTypes.EMAIL_TEMPLATE_UPDATED, {
      templateId: id,
      name: updated.name,
      version: updated.version,
    });

    this.logger.audit({
      eventType: EventTypes.EMAIL_TEMPLATE_UPDATED,
      operation: 'update',
      resource: 'email_template',
      resourceId: id,
      oldValue: { name: oldValue.name, version: oldValue.version },
      newValue: { name: updated.name, version: updated.version },
      success: true,
      correlationId: uuidv4(),
    });

    timer(true, { templateId: id, version: updated.version });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const timer = this.logger.startTimer('email_template_delete');

    const existing = this.templates.get(id);
    if (!existing) {
      timer(false, { templateId: id, error: 'not_found' });
      throw new EmailTemplateNotFoundError(id);
    }

    this.templates.delete(id);
    this.templatesByName.delete(existing.name.toLowerCase());

    this.logger.event(EventTypes.EMAIL_TEMPLATE_DELETED, {
      templateId: id,
      name: existing.name,
    });

    this.logger.audit({
      eventType: EventTypes.EMAIL_TEMPLATE_DELETED,
      operation: 'delete',
      resource: 'email_template',
      resourceId: id,
      oldValue: { name: existing.name },
      success: true,
      correlationId: uuidv4(),
    });

    timer(true, { templateId: id });
  }

  async get(id: string): Promise<EmailTemplate | null> {
    return this.templates.get(id) || null;
  }

  async getByName(name: string): Promise<EmailTemplate | null> {
    const id = this.templatesByName.get(name.toLowerCase());
    if (!id) return null;
    return this.templates.get(id) || null;
  }

  async list(filter?: { category?: string; isActive?: boolean }): Promise<EmailTemplate[]> {
    let templates = Array.from(this.templates.values());

    if (filter?.category) {
      templates = templates.filter((t) => t.category === filter.category);
    }

    if (filter?.isActive !== undefined) {
      templates = templates.filter((t) => t.isActive === filter.isActive);
    }

    return templates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async render(
    templateId: string,
    data: Record<string, unknown>
  ): Promise<EmailTemplateRenderResult> {
    const timer = this.logger.startTimer('email_template_render');

    const template = this.templates.get(templateId);
    if (!template) {
      timer(false, { templateId, error: 'not_found' });
      throw new EmailTemplateNotFoundError(templateId);
    }

    if (!template.isActive) {
      timer(false, { templateId, error: 'inactive' });
      throw new EmailTemplateRenderError(templateId, 'Template is inactive');
    }

    try {
      const subject = this.renderString(template.subject, data);
      const html = this.renderString(template.htmlContent, data);
      const text = template.textContent ? this.renderString(template.textContent, data) : undefined;

      this.logger.event(EventTypes.EMAIL_TEMPLATE_RENDERED, {
        templateId,
        name: template.name,
        variablesProvided: Object.keys(data),
      });

      timer(true, { templateId });

      return { subject, html, text };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      timer(false, { templateId, error: errorMessage });
      throw new EmailTemplateRenderError(templateId, errorMessage);
    }
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

export default EmailTemplateService;
