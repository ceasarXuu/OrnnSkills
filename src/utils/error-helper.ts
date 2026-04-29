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


import { ERROR_DIAGNOSTICS, getGenericDiagnostics } from './error-diagnostics-catalog.js';

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
      return ERROR_DIAGNOSTICS['SKILL_NOT_FOUND']!;
    }
    if (message.includes('.ornn') || message.includes('directory')) {
      return ERROR_DIAGNOSTICS['PROJECT_NOT_INITIALIZED']!;
    }
    if (message.includes('origin')) {
      return ERROR_DIAGNOSTICS['ORIGIN_NOT_FOUND']!;
    }
  }

  if (message.includes('invalid skill id') || message.includes('invalid characters')) {
    return ERROR_DIAGNOSTICS['INVALID_SKILL_ID']!;
  }

  if (message.includes('revision')) {
    return ERROR_DIAGNOSTICS['INVALID_REVISION']!;
  }

  if (message.includes('snapshot')) {
    return ERROR_DIAGNOSTICS['SNAPSHOT_NOT_FOUND']!;
  }

  if (message.includes('path traversal') || message.includes('..')) {
    return ERROR_DIAGNOSTICS['PATH_TRAVERSAL']!;
  }

  if (message.includes('daemon') && (message.includes('not running') || message.includes('not start'))) {
    return ERROR_DIAGNOSTICS['DAEMON_NOT_RUNNING']!;
  }

  if (message.includes('permission') || message.includes('denied')) {
    return ERROR_DIAGNOSTICS['PERMISSION_DENIED']!;
  }

  if (message.includes('api key') || message.includes('auth')) {
    return ERROR_DIAGNOSTICS['API_KEY_INVALID']!;
  }

  if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
    return ERROR_DIAGNOSTICS['NETWORK_ERROR']!;
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

