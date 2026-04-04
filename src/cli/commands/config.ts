import { Command } from 'commander';
import { runConfigWizard } from '../../config/wizard.js';
import {
  listConfiguredProviders,
  getDefaultProvider,
  setDefaultProvider,
} from '../../config/manager.js';
import { cliInfo } from '../../utils/cli-output.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { validateProjectRootOrExit } from '../lib/cli-setup.js';

interface ConfigOptions {
  project?: string;
  list?: boolean;
  use?: string;
}

/**
 * Create the config command
 */
export function createConfigCommand(): Command {
  const config = new Command('config');

  config
    .description('Manage OrnnSkills configuration')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-l, --list', 'List all configured providers', false)
    .option('-u, --use <provider>', 'Set default provider', '')
    .action(async (options: ConfigOptions) => {
      try {
        const projectPath = options.project || process.cwd();
        const projectRoot = validateProjectRootOrExit(projectPath, 'config');

        // Handle list option
        if (options.list) {
          const providers = await listConfiguredProviders(projectRoot);
          const defaultProvider = await getDefaultProvider(projectRoot);

          if (providers.length === 0) {
            cliInfo('No providers configured yet.');
            cliInfo('Run "ornn config" to add a provider.');
            return;
          }

          cliInfo('📋 Configured providers:');
          for (const provider of providers) {
            const isDefault = provider.provider === defaultProvider;
            cliInfo(
              `  ${isDefault ? '✓' : ' '} ${provider.provider} (${provider.modelName})${isDefault ? ' [default]' : ''}`
            );
          }
          return;
        }

        // Handle use option (set default)
        if (options.use) {
          const success = await setDefaultProvider(projectRoot, options.use);
          if (!success) {
            printErrorAndExit(
              `Failed to set default provider to "${options.use}". Make sure the provider is configured.`,
              { operation: 'Set default provider', projectPath: projectRoot },
              'CONFIG_INVALID'
            );
          }
          cliInfo(`✓ Default provider set to: ${options.use}`);
          return;
        }

        // Run configuration wizard
        await runConfigWizard(projectRoot);
        cliInfo('\n✅ Configuration updated successfully!');
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Manage config', projectPath: options.project }
        );
      }
    });

  return config;
}
