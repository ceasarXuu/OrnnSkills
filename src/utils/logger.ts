import winston from 'winston';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

/** Fields added by Winston internals — excluded from metadata output. */
const SKIP_FIELDS = new Set(['timestamp', 'level', 'message', 'stack', 'context', 'splat', 'service']);

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function resolveLogDir(): string {
  return process.env.ORNN_LOG_DIR?.trim() || join(homedir(), '.ornn', 'logs');
}

function shouldWriteFileLogs(): boolean {
  return !isTruthyEnv(process.env.ORNN_DISABLE_FILE_LOGGING) && !isTruthyEnv(process.env.VITEST);
}

function shouldSilenceConsoleLogs(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test' || isTruthyEnv(process.env.VITEST);
}

/**
 * 脱敏敏感信息
 */
function sanitizeMessage(message: string): string {
  let sanitized = message.replace(
    /api[_-]?key['":\s]*['"]?([a-zA-Z0-9]{20,})['"]?/gi,
    'api_key: [REDACTED]'
  );
  sanitized = sanitized.replace(
    /token['":\s]*['"]?([a-zA-Z0-9._-]{20,})['"]?/gi,
    'token: [REDACTED]'
  );
  sanitized = sanitized.replace(/password['":\s]*['"]?([^\s'"]+)['"]?/gi, 'password: [REDACTED]');
  sanitized = sanitized.replace(
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
    '[PRIVATE_KEY_REDACTED]'
  );
  sanitized = sanitized.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '[EMAIL_REDACTED]@$2'
  );
  sanitized = sanitized.replace(/\/Users\/([^/]+)\//g, '/Users/[USER]/');
  sanitized = sanitized.replace(/\/home\/([^/]+)\//g, '/home/[USER]/');
  return sanitized;
}

/**
 * 将 metadata 值序列化为可读字符串.
 * Error 对象显示 .message；对象显示 JSON；其余 String().
 */
function formatMetaValue(v: unknown): string {
  if (v instanceof Error) return v.message;
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>;
    if (typeof obj['message'] === 'string') return obj['message'];
    try {
      return JSON.stringify(v);
    } catch {
      return '[object]';
    }
  }
  return String(v);
}

function stripAnsiColorCodes(text: string): string {
  let result = '';

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\u001B' && text[index + 1] === '[') {
      index += 2;
      while (index < text.length) {
        const next = text[index];
        if ((next >= '0' && next <= '9') || next === ';') {
          index += 1;
          continue;
        }
        break;
      }
      if (text[index] === 'm') {
        continue;
      }
      result += '\u001B[';
      if (index < text.length) {
        result += text[index];
      }
      continue;
    }
    result += char;
  }

  return result;
}

/**
 * 构建单条日志行.
 *
 * 格式: [YYYY-MM-DD HH:mm:ss] LEVEL  [context] message | key=val key2=val2
 *        (stack trace indented 2 spaces on following lines)
 */
function buildLogLine(info: winston.Logform.TransformableInfo): string {
  const timestamp = (info['timestamp'] as string) ?? '';
  // Strip ANSI colour codes so padEnd gives correct visual width
  const rawLevel = stripAnsiColorCodes(String(info.level));
  const levelStr = rawLevel.toUpperCase().padEnd(5);
  const message = String(info.message);
  const stack = info['stack'] as string | undefined;
  const context = info['context'] as string | undefined;

  const ctx = context ? ` [${context}]` : '';
  const sanitizedMsg = sanitizeMessage(message);

  const metaPairs = Object.entries(info as Record<string, unknown>)
    .filter(([k]) => !SKIP_FIELDS.has(k))
    .map(([k, v]) => `${k}=${sanitizeMessage(formatMetaValue(v))}`)
    .join(' ');

  const line = `[${timestamp}] ${levelStr}${ctx} ${sanitizedMsg}${metaPairs ? ' | ' + metaPairs : ''}`;

  if (typeof stack === 'string') {
    const sanitizedStack = sanitizeMessage(stack).split('\n').join('\n  ');
    return `${line}\n  ${sanitizedStack}`;
  }
  return line;
}

/**
 * 从环境变量解析日志级别.
 * LOG_LEVEL=debug  或  DEBUG=ornn  → debug
 */
function resolveLogLevel(): string {
  const env = process.env['LOG_LEVEL']?.toLowerCase();
  const valid = new Set(['error', 'warn', 'info', 'debug', 'verbose']);
  if (env && valid.has(env)) return env;
  const debug = process.env['DEBUG'];
  if (debug === 'ornn' || debug === '*') return 'debug';
  return 'info';
}

/**
 * 创建日志目录
 */
function ensureLogDir(): void {
  if (!shouldWriteFileLogs()) return;
  const logDir = resolveLogDir();
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(buildLogLine)
);

/**
 * 创建主 logger
 */
function createLogger(): winston.Logger {
  ensureLogDir();
  const logDir = resolveLogDir();
  const transports: winston.transport[] = [];

  if (shouldWriteFileLogs()) {
    transports.push(
      new winston.transports.File({
        filename: join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: join(logDir, 'combined.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      })
    );
  }

  transports.push(
    new winston.transports.Console({
      silent: shouldSilenceConsoleLogs(),
    })
  );

  return winston.createLogger({
    level: resolveLogLevel(),
    format: logFormat,
    transports,
  });
}

// 导出单例 logger
export const logger = createLogger();

/**
 * 创建带模块上下文的 logger.
 * 日志行将显示 [context] 字段，便于定位来源.
 */
export function createChildLogger(context: string): winston.Logger {
  return logger.child({ context });
}

/**
 * 设置日志级别（运行时覆盖）
 */
export function setLogLevel(level: string): void {
  logger.level = level;
}
