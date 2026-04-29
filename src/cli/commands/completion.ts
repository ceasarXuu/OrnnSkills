/**
 * Shell Completion Command
 * Generates shell completion scripts for bash, zsh, and fish
 */

import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { generateBashCompletion } from './completion-bash.js';
import { generateZshCompletion } from './completion-zsh.js';
import { generateFishCompletion } from './completion-fish.js';

interface CompletionOptions {
  shell: string;
  output?: string;
}

function getInstallInstructions(shell: string): string {
  const instructions: Record<string, string> = {
    bash: [
      '# Bash Completion Installation',
      '',
      '## Option 1: Source directly (temporary)',
      'source <(ornn completion bash)',
      '',
      '## Option 2: Install system-wide (recommended)',
      '# Linux:',
      'sudo ornn completion bash > /etc/bash_completion.d/ornn',
      '',
      '# macOS with Homebrew:',
      'ornn completion bash > $(brew --prefix)/etc/bash_completion.d/ornn',
      '',
      '## Option 3: User-local installation',
      'mkdir -p ~/.bash_completion.d',
      'ornn completion bash > ~/.bash_completion.d/ornn',
      "echo 'source ~/.bash_completion.d/ornn' >> ~/.bashrc",
    ].join('\n'),
    zsh: [
      '# Zsh Completion Installation',
      '',
      '## Option 1: Add to fpath (recommended)',
      'mkdir -p ~/.zsh/completions',
      'ornn completion zsh > ~/.zsh/completions/_ornn',
      '',
      '# Add to ~/.zshrc if not already present:',
      '# fpath+=(~/.zsh/completions)',
      '',
      '## Option 2: Use with oh-my-zsh',
      'mkdir -p ~/.oh-my-zsh/completions',
      'ornn completion zsh > ~/.oh-my-zsh/completions/_ornn',
      '',
      '## Option 3: Source directly (temporary)',
      'source <(ornn completion zsh)',
    ].join('\n'),
    fish: [
      '# Fish Completion Installation',
      '',
      '## Automatic installation (recommended)',
      'mkdir -p ~/.config/fish/completions',
      'ornn completion fish > ~/.config/fish/completions/ornn.fish',
      '',
      '# Fish will automatically load the completions',
    ].join('\n'),
  };

  return instructions[shell] || '';
}

/**
 * Create the completion command
 */
export function createCompletionCommand(): Command {
  const completion = new Command('completion');

  completion
    .description('Generate shell completion scripts')
    .argument('<shell>', 'Shell type (bash, zsh, fish)')
    .option('-o, --output <file>', 'Output file path (default: stdout)')
    .addHelpText(
      'after',
      [
        'Examples:',
        '  $ ornn completion bash                    # Output to stdout',
        '  $ ornn completion bash > /etc/bash_completion.d/ornn',
        '  $ ornn completion zsh -o ~/.zsh/completions/_ornn',
        '  $ ornn completion fish --output ~/.config/fish/completions/ornn.fish',
        '',
        'Installation:',
        '  Bash:  source <(ornn completion bash)',
        '  Zsh:   source <(ornn completion zsh)',
        '  Fish:  ornn completion fish > ~/.config/fish/completions/ornn.fish',
      ].join('\n')
    )
    .action((shell: string, options: CompletionOptions) => {
      const validShells = ['bash', 'zsh', 'fish'];

      if (!validShells.includes(shell)) {
        printErrorAndExit(
          `Invalid shell "${shell}". Valid options: ${validShells.join(', ')}`,
          { operation: 'Generate completion script' }
        );
      }

      let script: string;
      switch (shell) {
        case 'bash':
          script = generateBashCompletion();
          break;
        case 'zsh':
          script = generateZshCompletion();
          break;
        case 'fish':
          script = generateFishCompletion();
          break;
        default:
          script = '';
      }

      if (options.output) {
        try {
          // Ensure directory exists
          const dir = dirname(options.output);
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          writeFileSync(options.output, script, 'utf-8');
          cliInfo(`Completion script written to: ${options.output}`);

          // Show installation instructions
          const instructions = getInstallInstructions(shell);
          if (instructions) {
            cliInfo('\n' + instructions);
          }
        } catch (error) {
          printErrorAndExit(
            `Failed to write completion script to "${options.output}": ${
              error instanceof Error ? error.message : String(error)
            }`,
            { operation: 'Write completion script' },
            'PERMISSION_DENIED'
          );
        }
      } else {
        // Output to stdout
        cliInfo(script);
      }
    });

  return completion;
}
