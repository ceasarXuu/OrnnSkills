import winston from 'winston';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

const LOG_DIR = join(homedir(), '.ornn', 'logs');

/**
 * 脱敏敏感信息
 */
function sanitizeMessage(message: string): string {
  // 脱敏 API 密钥
  let sanitized = message.replace(/api[_-]?key['":\s]*['"]?([a-zA-Z0-9]{20,})['"]?/gi, 'api_key: [REDACTED]');
  
  // 脱敏令牌
  sanitized = sanitized.replace(/token['":\s]*['"]?([a-zA-Z0-9._-]{20,})['"]?/gi, 'token: [REDACTED]');
  
  // 脱敏密码
  sanitized = sanitized.replace(/password['":\s]*['"]?([^\s'"]+)['"]?/gi, 'password: [REDACTED]');
  
  // 脱敏私钥
  sanitized = sanitized.replace(/-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, '[PRIVATE_KEY_REDACTED]');
  
  // 脱敏邮箱
  sanitized = sanitized.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '[EMAIL_REDACTED]@$2');
  
  // 脱敏文件路径中的用户名
  sanitized = sanitized.replace(/\/Users\/([^/]+)\//g, '/Users/[USER]/');
  sanitized = sanitized.replace(/\/home\/([^/]+)\//g, '/home/[USER]/');
  
  return sanitized;
}

/**
 * 自定义日志格式（带脱敏）
/**
 * 自定义日志格式

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
    // 脱敏消息
    const sanitizedMessage = sanitizeMessage(String(message));
    const baseMessage = `[${timestamp}] ${String(level).toUpperCase()}: ${sanitizedMessage}`;
    
    // 脱敏堆栈
    let stackStr: string | undefined;
    if (typeof stack === 'string') {
      stackStr = sanitizeMessage(stack);
    }
    
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