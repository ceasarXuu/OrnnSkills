import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * 计算字符串的 SHA256 哈希
 */
export function hashString(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * 计算文件的 SHA256 哈希
 */
export function hashFile(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return hashString(content);
}

/**
 * 计算 Buffer 的 SHA256 哈希
 */
export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * 计算内容的 SHA256 哈希（字符串的别名）
 */
export function hashContent(content: string): string {
  return hashString(content);
}

