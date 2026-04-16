import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

function runCommand(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });
}

function normalizePickedPath(output: string): string | null {
  const trimmed = String(output || '').trim();
  return trimmed ? resolve(trimmed) : null;
}

async function pickOnDarwin(): Promise<string | null> {
  const output = await runCommand('osascript', [
    '-e',
    'try',
    '-e',
    'POSIX path of (choose folder with prompt "Select an Ornn project folder")',
    '-e',
    'on error number -128',
    '-e',
    'return ""',
    '-e',
    'end try',
  ]);
  return normalizePickedPath(output);
}

async function pickOnWindows(): Promise<string | null> {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$dialog.Description = "Select an Ornn project folder"',
    '$dialog.UseDescriptionForTitle = $true',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  Write-Output $dialog.SelectedPath',
    '}',
  ].join('; ');
  const output = await runCommand('powershell', ['-NoProfile', '-STA', '-Command', script]);
  return normalizePickedPath(output);
}

async function pickOnLinux(): Promise<string | null> {
  const script = [
    'if command -v zenity >/dev/null 2>&1; then',
    '  zenity --file-selection --directory --title="Select an Ornn project folder" || true',
    'elif command -v kdialog >/dev/null 2>&1; then',
    `  kdialog --getexistingdirectory "${homedir()}" --title "Select an Ornn project folder" || true`,
    'else',
    '  printf "__ORN_NO_NATIVE_PICKER__"',
    'fi',
  ].join('\n');
  const output = await runCommand('sh', ['-lc', script]);
  if (!output) return null;
  if (output === '__ORN_NO_NATIVE_PICKER__') {
    throw new Error('No native directory picker is available on this system');
  }
  return normalizePickedPath(output);
}

export async function pickProjectDirectory(): Promise<string | null> {
  if (process.platform === 'darwin') return pickOnDarwin();
  if (process.platform === 'win32') return pickOnWindows();
  return pickOnLinux();
}
