import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';

export function tailNdjson(filePath: string, maxLines = 200): string[] {
  if (!existsSync(filePath)) return [];

  const chunkSize = 65536;
  const fd = openSync(filePath, 'r');
  try {
    const fileSize = statSync(filePath).size;
    if (fileSize === 0) return [];

    let position = fileSize;
    const lines: string[] = [];
    let remainder = '';

    while (position > 0 && lines.length < maxLines) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;
      const buffer = Buffer.alloc(readSize);
      readSync(fd, buffer, 0, readSize, position);
      const chunk = buffer.toString('utf-8') + remainder;
      const parts = chunk.split('\n');
      remainder = parts[0] ?? '';
      for (let index = parts.length - 1; index >= 1; index -= 1) {
        if (parts[index].trim()) lines.push(parts[index]);
      }
    }

    if (remainder.trim()) {
      lines.push(remainder);
    }

    return lines.slice(0, maxLines).reverse();
  } finally {
    closeSync(fd);
  }
}
