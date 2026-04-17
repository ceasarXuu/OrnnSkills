import { describe, it, expect, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { SQLiteDbAdapter } from '../../src/storage/sqlite/sqlite-db-adapter.js';

describe('SQLiteDbAdapter', () => {
  const cleanupPaths = new Set<string>();

  afterEach(() => {
    for (const path of cleanupPaths) {
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
    }
    cleanupPaths.clear();
  });

  const makeDbPath = (name: string) => {
    const dir = join(tmpdir(), `ornn-sqlite-adapter-${Date.now()}-${Math.random()}-${name}`);
    cleanupPaths.add(dir);
    return join(dir, `${name}.db`);
  };

  it('initializes with schema callback and reopens persisted data', async () => {
    const dbPath = makeDbPath('persist');
    const createSchema = (db: { run: (sql: string, params?: unknown[]) => void }) => {
      db.run('CREATE TABLE IF NOT EXISTS test_items (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
    };

    const first = new SQLiteDbAdapter(dbPath, createSchema);
    await first.init();
    first.database.run('INSERT INTO test_items (id, value) VALUES (?, ?)', ['item-1', 'value-1']);
    first.save();
    first.close();

    const second = new SQLiteDbAdapter(dbPath, createSchema);
    await second.init();
    const stmt = second.database.prepare('SELECT value FROM test_items WHERE id = ?');
    stmt.bind(['item-1']);
    expect(stmt.step()).toBe(true);
    expect(stmt.getAsObject().value).toBe('value-1');
    stmt.free();
    second.close();
  });

  it('creates a backup and restores from it', async () => {
    const dbPath = makeDbPath('backup');
    const backupPath = makeDbPath('backup-copy');
    const createSchema = (db: { run: (sql: string, params?: unknown[]) => void }) => {
      db.run('CREATE TABLE IF NOT EXISTS test_items (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
    };

    const adapter = new SQLiteDbAdapter(dbPath, createSchema);
    await adapter.init();
    adapter.database.run('INSERT INTO test_items (id, value) VALUES (?, ?)', ['item-1', 'before']);
    adapter.save();
    adapter.createBackup(backupPath);

    adapter.database.run('UPDATE test_items SET value = ? WHERE id = ?', ['after', 'item-1']);
    adapter.save();

    await adapter.restoreFromBackup(backupPath);
    const stmt = adapter.database.prepare('SELECT value FROM test_items WHERE id = ?');
    stmt.bind(['item-1']);
    expect(stmt.step()).toBe(true);
    expect(stmt.getAsObject().value).toBe('before');
    stmt.free();
    adapter.close();
  });

  it('recreates the parent directory when saving during close after the db folder was removed', async () => {
    const dbPath = makeDbPath('recreate-dir-on-close');
    const createSchema = (db: { run: (sql: string, params?: unknown[]) => void }) => {
      db.run('CREATE TABLE IF NOT EXISTS test_items (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
    };

    const adapter = new SQLiteDbAdapter(dbPath, createSchema);
    await adapter.init();
    adapter.database.run('INSERT INTO test_items (id, value) VALUES (?, ?)', ['item-1', 'value-1']);

    rmSync(dirname(dbPath), { recursive: true, force: true });

    expect(() => adapter.close()).not.toThrow();
    expect(existsSync(dbPath)).toBe(true);
  });
});
