/**
 * Project-level Observer
 *
 * Unified observer that handles both Codex and Claude Code traces.
 * Only processes traces belonging to the current project.
 */

import { watch, type FSWatcher } from 'chokidar';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { createChildLogger } from '../../utils/logger.js';
import { extractSkillRefs } from '../../utils/skill-refs.js';
import type { Trace } from '../../types/index.js';

const logger = createChildLogger('project-observer');

export interface ProjectObserverOptions {
  projectPath: string;
  onTrace: (trace: Trace) => void;
}

/**
 * Project-level Observer
 *
 * Responsibilities:
 * 1. Watch global Codex sessions directory (filter by cwd)
 * 2. Watch project-specific Claude directory
 * 3. Parse traces from both runtimes
 * 4. Only emit traces belonging to current project
 */
export class ProjectObserver {
  private options: ProjectObserverOptions;
  private codexWatcher: FSWatcher | null = null;
  private claudeWatcher: FSWatcher | null = null;
  private processedFiles: Set<string> = new Set();

  constructor(options: ProjectObserverOptions) {
    this.options = options;
  }

  /**
   * Start watching for traces
   */
  async start(): Promise<void> {
    logger.info('Starting project observer...');
    logger.info(`Project path: ${this.options.projectPath}`);

    // Start Codex watcher (global directory, filter by cwd)
    this.startCodexWatcher();

    // Start Claude watcher (project-specific directory)
    this.startClaudeWatcher();

    logger.info('Project observer started');
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    logger.info('Stopping project observer...');

    if (this.codexWatcher) {
      await this.codexWatcher.close();
      this.codexWatcher = null;
    }

    if (this.claudeWatcher) {
      await this.claudeWatcher.close();
      this.claudeWatcher = null;
    }

    logger.info('Project observer stopped');
  }

  startCodexWatcher(): void {
    const codexSessionsDir = join(homedir(), '.codex', 'sessions');

    if (!existsSync(codexSessionsDir)) {
      logger.warn(`Codex sessions directory not found: ${codexSessionsDir}`);
      return;
    }

    logger.info(`Watching Codex sessions: ${codexSessionsDir}`);

    this.codexWatcher = watch(`${codexSessionsDir}/**/*.jsonl`, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.codexWatcher.on('add', (filePath: string) => {
      this.handleCodexFile(filePath);
    });

    this.codexWatcher.on('change', (filePath: string) => {
      this.handleCodexFile(filePath);
    });

    this.codexWatcher.on('error', (error: Error) => {
      logger.error('Codex watcher error:', error);
    });
  }

  startClaudeWatcher(): void {
    const projectName = this.options.projectPath.replace(/\//g, '-');
    const claudeProjectDir = join(homedir(), '.claude', 'projects', projectName);

    if (!existsSync(claudeProjectDir)) {
      logger.warn(`Claude project directory not found: ${claudeProjectDir}`);
      return;
    }

    logger.info(`Watching Claude project: ${claudeProjectDir}`);

    this.claudeWatcher = watch(`${claudeProjectDir}/*.jsonl`, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.claudeWatcher.on('add', (filePath: string) => {
      this.handleClaudeFile(filePath);
    });

    this.claudeWatcher.on('change', (filePath: string) => {
      this.handleClaudeFile(filePath);
    });

    this.claudeWatcher.on('error', (error: Error) => {
      logger.error('Claude watcher error:', error);
    });
  }

  handleCodexFile(filePath: string): void {
    if (this.processedFiles.has(filePath)) {
      return;
    }

    try {
      const traces = this.parseCodexFile(filePath);

      for (const trace of traces) {
        if (this.isCurrentProject(trace)) {
          this.options.onTrace(trace);
        }
      }

      this.processedFiles.add(filePath);
    } catch (error) {
      logger.error(`Failed to parse Codex file ${filePath}:`, error);
    }
  }

  handleClaudeFile(filePath: string): void {
    if (filePath.includes('index')) {
      return;
    }

    if (this.processedFiles.has(filePath)) {
      return;
    }

    try {
      const traces = this.parseClaudeFile(filePath);

      for (const trace of traces) {
        if (this.isCurrentProject(trace)) {
          this.options.onTrace(trace);
        }
      }

      this.processedFiles.add(filePath);
    } catch (error) {
      logger.error(`Failed to parse Claude file ${filePath}:`, error);
    }
  }

  parseCodexFile(filePath: string): Trace[] {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const traces: Trace[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);
        const trace = this.convertCodexEventToTrace(event, filePath);
        if (trace) {
          traces.push(trace);
        }
      } catch (error) {
        logger.debug(`Failed to parse line in ${filePath}:`, error);
      }
    }

    return traces;
  }

  parseClaudeFile(filePath: string): Trace[] {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const traces: Trace[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);
        const trace = this.convertClaudeEventToTrace(event, filePath);
        if (trace) {
          traces.push(trace);
        }
      } catch (error) {
        logger.debug(`Failed to parse line in ${filePath}:`, error);
      }
    }

    return traces;
  }

  convertCodexEventToTrace(event: unknown, source: string): Trace | null {
    const e = event as Record<string, unknown>;
    const sessionId = basename(source, '.jsonl');

    let projectPath: string | undefined;
    if (e.type === 'session_meta') {
      const payload = e.payload as Record<string, unknown> | undefined;
      if (payload?.cwd) {
        projectPath = String(payload.cwd);
      }
    }

    let eventType: Trace['event_type'] = 'status';
    if (e.type === 'response_item') {
      const payload = e.payload as Record<string, unknown> | undefined;
      if (payload?.role === 'user') {
        eventType = 'user_input';
      } else if (payload?.role === 'assistant') {
        eventType = 'assistant_output';
      }
    }

    let content: string | undefined;
    const payload = e.payload as Record<string, unknown> | undefined;
    if (payload?.content) {
      if (Array.isArray(payload.content)) {
        content = payload.content.map((c: { text?: string }) => c.text).join('\n');
      } else {
        content = String(payload.content);
      }
    }

    const baseInstructions = payload?.base_instructions;
    const skillRefs = this.extractSkillRefs(
      typeof baseInstructions === 'string' ? baseInstructions : content || ''
    );

    return {
      trace_id: `${sessionId}_${String(e.timestamp)}`,
      runtime: 'codex',
      session_id: sessionId,
      turn_id: String(e.timestamp),
      event_type: eventType,
      timestamp: String(e.timestamp),
      user_input: eventType === 'user_input' ? content : undefined,
      assistant_output: eventType === 'assistant_output' ? content : undefined,
      skill_refs: skillRefs,
      status: 'success',
      metadata: {
        source,
        projectPath,
        rawType: e.type,
      },
    };
  }

  convertClaudeEventToTrace(event: unknown, source: string): Trace | null {
    const e = event as Record<string, unknown>;
    const sessionId = basename(source, '.jsonl');

    let eventType: Trace['event_type'] = 'status';
    if (e.type === 'user') {
      eventType = 'user_input';
    } else if (e.type === 'assistant') {
      eventType = 'assistant_output';
    }

    const message = e.message as Record<string, unknown> | undefined;
    const content = String(message?.content || e.content || '');

    const skillRefs = this.extractSkillRefs(content);

    return {
      trace_id: `${sessionId}_${String(e.timestamp)}`,
      runtime: 'claude',
      session_id: sessionId,
      turn_id: String(e.timestamp),
      event_type: eventType,
      timestamp: String(e.timestamp),
      user_input: eventType === 'user_input' ? content : undefined,
      assistant_output: eventType === 'assistant_output' ? content : undefined,
      skill_refs: skillRefs,
      status: 'success',
      metadata: {
        source,
        projectPath: this.options.projectPath,
        rawType: e.type,
      },
    };
  }

  /**
   * Extract skill references from text
   * Supports: [$skill-name] and @skill-name formats
   * @deprecated Use extractSkillRefs from utils/skill-refs instead
   */
  extractSkillRefs(text: string | object): string[] {
    const textStr = typeof text === 'string' ? text : JSON.stringify(text);
    return extractSkillRefs(textStr);
  }

  isCurrentProject(trace: Trace): boolean {
    const traceProjectPath = trace.metadata?.projectPath;

    if (!traceProjectPath) {
      return trace.runtime === 'claude';
    }

    return traceProjectPath === this.options.projectPath;
  }
}

/**
 * Create a ProjectObserver instance
 */
export function createProjectObserver(options: ProjectObserverOptions): ProjectObserver {
  return new ProjectObserver(options);
}
