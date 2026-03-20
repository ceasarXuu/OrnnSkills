import winston from 'winston';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

const LOG_DIR = join(homedir(), '.ornn', 'logs');

/**
 * 创建日志目录
 */
function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * 自定义日志格式
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    const baseMessage = `[${timestamp}] ${String(level).toUpperCase()}: ${String(message)}`;
    const stackStr = typeof stack === 'string' ? stack : undefined;
    return stackStr ? `${baseMessage}\n${stackStr}` : baseMessage;
  })
);

/**
 * 创建主 logger
 */
function createLogger(): winston.Logger {
  ensureLogDir();

  return winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
      // 文件日志
      new winston.transports.File({
        filename: join(LOG_DIR, 'error.log'),
        level: 'error',
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: join(LOG_DIR, 'combined.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      }),
      // 控制台日志（仅在开发环境）
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat
        ),
        silent: process.env.NODE_ENV === 'production',
      }),
    ],
  });
}

// 导出单例 logger
export const logger = createLogger();

/**
 * 创建带上下文的 logger
 */
export function createChildLogger(context: string): winston.Logger {
  return logger.child({ context });
}

/**
 * 设置日志级别
 */
export function setLogLevel(level: string): void {
  logger.level = level;
}