/**
 * Error Helper Utilities
 *
 * 提供友好的错误信息和解决方案指引
 */

export interface ErrorContext {
  operation: string;
  skillId?: string;
  runtime?: string;
  projectPath?: string;
}

export interface ErrorDiagnostics {
  likelyCauses: string[];
  suggestedSteps: string[];
  relatedCommands: string[];
  docsSection?: string;
  tips?: string[];
}

const ERROR_DIAGNOSTICS: Record<string, ErrorDiagnostics> = {
  'SKILL_NOT_FOUND': {
    likelyCauses: [
      'The skill has not been used in this project yet',
      'Skill ID may be misspelled',
      'The skill exists in origin but not yet forked to shadow',
    ],
    suggestedSteps: [
      '1. Run "ornn skills status" to see all available skills',
      '2. Verify the skill ID spelling is correct',
      '3. Use the main Agent to invoke the skill - OrnnSkills will auto-create shadow',
      '4. Check if the origin skill exists: cat ~/.ornn/settings.toml',
    ],
    relatedCommands: [
      'ornn skills status',
      'ornn skills status --skill <skill-id>',
    ],
    docsSection: '#问题2-shadow-skill-not-found',
    tips: [
      'Skill IDs are case-sensitive',
      'Shadow skills are created automatically when first used',
    ],
  },
  'PROJECT_NOT_INITIALIZED': {
    likelyCauses: [
      'OrnnSkills has not been initialized in this project',
      'The .ornn directory was deleted or corrupted',
      'Running the command from the wrong directory',
    ],
    suggestedSteps: [
      '1. Ensure you are in the project root directory',
      '2. Run "ornn init" to initialize OrnnSkills',
      '3. Follow the configuration wizard to set up your LLM provider',
    ],
    relatedCommands: [
      'ornn init',
      'ornn daemon status',
    ],
    docsSection: '#问题1-daemon-not-running',
    tips: [
      'Each project needs its own .ornn directory',
      'Initialization only needs to be done once per project',
    ],
  },
  'ORIGIN_NOT_FOUND': {
    likelyCauses: [
      'The skill does not exist in configured origin paths',
      'Origin paths in settings.toml are incorrect',
      'The skill was installed in a different location',
    ],
    suggestedSteps: [
      '1. Check your settings.toml: cat ~/.ornn/settings.toml',
      '2. Verify the skill exists in origin paths',
      '3. Common origin paths: ~/.skills/, ~/.claude/skills/, ~/.codex/skills/',
      '4. Re-install the skill if needed',
    ],
    relatedCommands: [
      'ornn skills status',
      'cat ~/.ornn/settings.toml',
    ],
    tips: [
      'Origin skills are global and shared across projects',
      'You can configure custom origin paths in settings.toml',
    ],
  },
  'INVALID_SKILL_ID': {
    likelyCauses: [
      'Skill ID contains invalid characters',
      'Skill ID is empty or too short',
      'Using a path instead of skill ID',
    ],
    suggestedSteps: [
      '1. Skill IDs can only contain: letters, numbers, hyphens (-), underscores (_), and dots (.)',
      '2. Example valid IDs: "code-review", "git_workflow", "api.doc-generator"',
      '3. Avoid spaces and special characters',
    ],
    relatedCommands: [
      'ornn skills status',
    ],
    tips: [
      'Skill IDs are case-sensitive: "CodeReview" ≠ "code-review"',
    ],
  },
  'INVALID_REVISION': {
    likelyCauses: [
      'Specified revision number does not exist',
      'Revision number is negative or too large',
      'Typo in revision number',
    ],
    suggestedSteps: [
      '1. Run "ornn skills log <skill-id>" to see valid revisions',
      '2. Use "ornn skills rollback <skill-id> --snapshot" for latest snapshot',
      '3. Revisions start from 0 (initial version)',
    ],
    relatedCommands: [
      'ornn skills log <skill-id>',
      'ornn skills status --skill <skill-id>',
    ],
    tips: [
      'Snapshots are safer rollback targets than bare revisions',
      'Current revision is the highest numbered one',
    ],
  },
  'SNAPSHOT_NOT_FOUND': {
    likelyCauses: [
      'No snapshots have been created yet',
      'Snapshot files may have been deleted',
      'Requested snapshot revision does not exist',
    ],
    suggestedSteps: [
      '1. Run "ornn skills log <skill-id>" to see available revisions',
      '2. Use "ornn skills rollback <skill-id> --to <revision>" with a valid revision',
      '3. Snapshots are created automatically every 5 revisions',
    ],
    relatedCommands: [
      'ornn skills log <skill-id>',
    ],
    tips: [
      'You can manually create snapshots, but they are also auto-created',
    ],
  },
  'ROLLBACK_FAILED': {
    likelyCauses: [
      'Failed to write to shadow skill file',
      'Disk space or permission issues',
      'Shadow skill file is corrupted',
    ],
    suggestedSteps: [
      '1. Check disk space: df -h',
      '2. Verify write permissions: ls -la .ornn/skills/<skill-id>/',
      '3. Try restoring from a backup',
      '4. Check system logs for more details',
    ],
    relatedCommands: [
      'ornn skills status --skill <skill-id>',
      'ornn skills log <skill-id>',
    ],
    tips: [
      'Always backup .ornn directory before major operations',
      'Check ~/.ornn/logs/error.log for detailed errors',
    ],
  },
  'PATH_TRAVERSAL': {
    likelyCauses: [
      'Attempted to access paths outside the project',
      'Using ".." to navigate to parent directories',
      'Suspicious path patterns detected',
    ],
    suggestedSteps: [
      '1. Use only relative paths or absolute paths within the project',
      '2. Do not use ".." or "~/" in project paths',
      '3. Run the command from within your project directory',
    ],
    relatedCommands: [
      'pwd',
      'ls',
    ],
    tips: [
      'For security, OrnnSkills only allows paths within the current project',
    ],
  },
  'DAEMON_NOT_RUNNING': {
    likelyCauses: [
      'OrnnSkills daemon has not been started',
      'Daemon crashed or was stopped',
      'PID file is stale',
    ],
    suggestedSteps: [
      '1. Run "ornn daemon status" to check current state',
      '2. Run "ornn daemon start" to start the daemon',
      '3. If status shows stale PID, it will auto-cleanup',
    ],
    relatedCommands: [
      'ornn daemon start',
      'ornn daemon status',
    ],
    docsSection: '#快速入门',
    tips: [
      'The daemon runs in the background and monitors your Agent',
      'You only need to start it once per project',
    ],
  },
  'DAEMON_ALREADY_RUNNING': {
    likelyCauses: [
      'Daemon is already running from a previous session',
      'PID file was not cleaned up properly',
    ],
    suggestedSteps: [
      '1. Run "ornn daemon status" to verify',
      '2. If needed, run "ornn daemon stop" then "ornn daemon start"',
    ],
    relatedCommands: [
      'ornn daemon status',
      'ornn daemon stop',
    ],
    tips: [
      'Only one daemon instance should run per project',
    ],
  },
  'CONFIG_INVALID': {
    likelyCauses: [
      'Configuration file is malformed',
      'Missing required fields',
      'Invalid value types in config',
    ],
    suggestedSteps: [
      '1. Check config syntax: cat .ornn/config.toml',
      '2. Compare with example: cat .env.local.example',
      '3. Try regenerating config: "ornn init --force"',
    ],
    relatedCommands: [
      'ornn init --force',
    ],
    tips: [
      'TOML format requires strict syntax - check for missing quotes or brackets',
    ],
  },
  'API_KEY_INVALID': {
    likelyCauses: [
      'API key is expired or revoked',
      'API key has been rotated',
      'Incorrect API key entered',
    ],
    suggestedSteps: [
      '1. Verify your API key is correct in .env.local',
      '2. Check the provider website for key status',
      '3. Re-run "ornn init" to update credentials',
    ],
    relatedCommands: [
      'ornn init',
    ],
    tips: [
      'Never share your API key - keep it secure',
      'API keys are stored in .env.local (already in .gitignore)',
    ],
  },
  'NETWORK_ERROR': {
    likelyCauses: [
      'Internet connection is unavailable',
      'Firewall or proxy blocking requests',
      'LLM provider service is down',
    ],
    suggestedSteps: [
      '1. Check your internet connection',
      '2. Verify the LLM provider status',
      '3. Check proxy settings if behind corporate firewall',
    ],
    relatedCommands: [
      'ornn daemon status',
      'ornn logs',
    ],
    tips: [
      'OrnnSkills requires internet to communicate with LLM providers',
    ],
  },
  'PERMISSION_DENIED': {
    likelyCauses: [
      'Insufficient file system permissions',
      'File or directory is owned by another user',
      'Read-only file system',
    ],
    suggestedSteps: [
      '1. Check permissions: ls -la .ornn/',
      '2. Fix ownership: sudo chown -R $USER .ornn/',
      '3. Ensure project directory is writable',
    ],
    relatedCommands: [
      'ls -la .ornn/',
      'chmod -R 755 .ornn/',
    ],
    tips: [
      'OrnnSkills needs read/write access to .ornn directory',
    ],
  },
};

function getGenericDiagnostics(): ErrorDiagnostics {
  return {
    likelyCauses: [
      'An unexpected error occurred',
      'There may be a configuration issue',
      'The system may need to be restarted',
    ],
    suggestedSteps: [
      '1. Run "ornn daemon status" to check system state',
      '2. Try restarting the daemon: "ornn daemon stop && ornn daemon start"',
      '3. Check logs for more details: ~/.ornn/logs/error.log',
      '4. If problem persists, try "ornn init --force"',
    ],
    relatedCommands: [
      'ornn daemon status',
      'ornn daemon stop',
      'ornn daemon start',
    ],
    tips: [
      'Check the user guide for common issues: USER-GUIDE.md',
    ],
  };
}

/**
 * 格式化错误输出，包含解决方案
 */
export function formatErrorWithSolution(
  error: Error | string,
  context: ErrorContext,
  errorType?: string
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const diagnostics = errorType
    ? ERROR_DIAGNOSTICS[errorType] || getGenericDiagnostics()
    : inferDiagnostics(errorMessage);

  const lines: string[] = [];

  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║                     ❌ Error Occurred                        ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');

  lines.push(`🔴 ${context.operation} failed`);
  lines.push(`   ${errorMessage}`);

  if (context.skillId) {
    lines.push(`   📎 Skill: ${context.skillId}`);
  }
  if (context.projectPath) {
    lines.push(`   📁 Project: ${context.projectPath}`);
  }

  lines.push('');

  if (diagnostics.likelyCauses.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│ 💡 Possible Causes:                                         │');
    lines.push('└─────────────────────────────────────────────────────────────┘');
    for (const cause of diagnostics.likelyCauses) {
      lines.push(`   • ${cause}`);
    }
    lines.push('');
  }

  if (diagnostics.suggestedSteps.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│ 🔧 Suggested Steps:                                         │');
    lines.push('└─────────────────────────────────────────────────────────────┘');
    for (const step of diagnostics.suggestedSteps) {
      lines.push(`   ${step}`);
    }
    lines.push('');
  }

  if (diagnostics.relatedCommands.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│ 📝 Related Commands:                                        │');
    lines.push('└─────────────────────────────────────────────────────────────┘');
    for (const cmd of diagnostics.relatedCommands) {
      const formattedCmd = context.skillId
        ? cmd.replace('<skill-id>', context.skillId)
        : cmd;
      lines.push(`   $ ${formattedCmd}`);
    }
    lines.push('');
  }

  if (diagnostics.tips && diagnostics.tips.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│ 💎 Tips:                                                   │');
    lines.push('└─────────────────────────────────────────────────────────────┘');
    for (const tip of diagnostics.tips) {
      lines.push(`   💡 ${tip}`);
    }
    lines.push('');
  }

  if (diagnostics.docsSection) {
    lines.push(`📖 For more help, see: USER-GUIDE.md${diagnostics.docsSection}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 根据错误消息推断诊断信息
 */
function inferDiagnostics(errorMessage: string): ErrorDiagnostics {
  const message = errorMessage.toLowerCase();

  if (message.includes('not found') || message.includes('not exist') || message.includes('does not exist')) {
    if (message.includes('skill')) {
      return ERROR_DIAGNOSTICS['SKILL_NOT_FOUND'];
    }
    if (message.includes('.ornn') || message.includes('directory')) {
      return ERROR_DIAGNOSTICS['PROJECT_NOT_INITIALIZED'];
    }
    if (message.includes('origin')) {
      return ERROR_DIAGNOSTICS['ORIGIN_NOT_FOUND'];
    }
  }

  if (message.includes('invalid skill id') || message.includes('invalid characters')) {
    return ERROR_DIAGNOSTICS['INVALID_SKILL_ID'];
  }

  if (message.includes('revision')) {
    return ERROR_DIAGNOSTICS['INVALID_REVISION'];
  }

  if (message.includes('snapshot')) {
    return ERROR_DIAGNOSTICS['SNAPSHOT_NOT_FOUND'];
  }

  if (message.includes('path traversal') || message.includes('..')) {
    return ERROR_DIAGNOSTICS['PATH_TRAVERSAL'];
  }

  if (message.includes('daemon') && (message.includes('not running') || message.includes('not start'))) {
    return ERROR_DIAGNOSTICS['DAEMON_NOT_RUNNING'];
  }

  if (message.includes('permission') || message.includes('denied')) {
    return ERROR_DIAGNOSTICS['PERMISSION_DENIED'];
  }

  if (message.includes('api key') || message.includes('auth')) {
    return ERROR_DIAGNOSTICS['API_KEY_INVALID'];
  }

  if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
    return ERROR_DIAGNOSTICS['NETWORK_ERROR'];
  }

  return getGenericDiagnostics();
}

/**
 * 打印错误并退出进程
 */
export function printErrorAndExit(
  error: Error | string,
  context: ErrorContext,
  errorType?: string,
  exitCode: number = 1
): never {
  const formatted = formatErrorWithSolution(error, context, errorType);
  console.error(formatted);
  process.exit(exitCode);
}

