import pino from 'pino';

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  name?: string;
  prettyPrint?: boolean;
}

export function createLogger(config: LoggerConfig): pino.Logger {
  return pino({
    name: config.name || 'unreal-bridge',
    level: config.level,
    transport: config.prettyPrint
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard'
          }
        }
      : undefined,
    base: {
      service: 'unreal-bridge',
      version: '1.39.0'
    }
  });
}

export const defaultLogger = createLogger({ level: 'info' });
