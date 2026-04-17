import initSqlJs, { type Database } from 'sql.js';
import { dirname } from 'node:path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createChildLogger } from '../../utils/logger.js';

const logger = createChildLogger('sqlite-db-adapter');

export type SQLiteSchemaInitializer = (db: Database) => void;

export class SQLiteDbAdapter {
  private db: Database | null = null;

  constructor(
    private readonly dbPath: string,
    private readonly initializeSchema: SQLiteSchemaInitializer
  ) {}

  getDatabase(): Database | null {
    return this.db;
  }

  get database(): Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async init(): Promise<void> {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const SQL = await initSqlJs();
    this.db = existsSync(this.dbPath)
      ? new SQL.Database(readFileSync(this.dbPath))
      : new SQL.Database();

    this.initializeSchema(this.db);
    this.save();
    logger.debug('Database initialized', { path: this.dbPath });
  }

  save(): void {
    const buffer = Buffer.from(this.database.export());
    const uniqueId = randomBytes(8).toString('hex');
    const tempPath = `${this.dbPath}.${process.pid}.${uniqueId}.tmp`;

    try {
      writeFileSync(tempPath, buffer);
      renameSync(tempPath, this.dbPath);
    } catch (error) {
      try {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }
      } catch {
        // ignore cleanup failures
      }
      throw error;
    }
  }

  beginTransaction(): void {
    this.database.run('BEGIN TRANSACTION');
  }

  commit(): void {
    try {
      this.database.run('COMMIT');
      this.save();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('no transaction is active')) {
        logger.debug('No active transaction to commit');
        return;
      }
      throw error;
    }
  }

  rollback(): void {
    try {
      this.database.run('ROLLBACK');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('no transaction is active')) {
        logger.debug('No active transaction to rollback');
        return;
      }
      throw error;
    }
  }

  createBackup(backupPath?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = backupPath ?? `${this.dbPath}.backup.${timestamp}`;
    const backupDir = dirname(backupFilePath);
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    writeFileSync(backupFilePath, Buffer.from(this.database.export()));
    logger.info('Database backup created', { path: backupFilePath });
    return backupFilePath;
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const SQL = await initSqlJs();
    this.close(false);
    this.db = new SQL.Database(readFileSync(backupPath));
    this.save();
    logger.info('Database restored from backup', { path: backupPath });
  }

  close(shouldSave = true): void {
    if (!this.db) {
      return;
    }
    if (shouldSave) {
      this.save();
    }
    this.db.close();
    this.db = null;
    logger.info('Database closed');
  }
}
