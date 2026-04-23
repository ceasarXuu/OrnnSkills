import { mkdirSync, createWriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const outputPath = resolve('artifacts/promo/ornnskills-v2-promo.mp4');
const logPath = resolve(
  `logs/remotion-promo-render-${new Date().toISOString().replace(/[:.]/g, '-')}.log`,
);

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(logPath), { recursive: true });

const args = [
  'remotion',
  'render',
  'remotion/index.ts',
  'OrnnSkillsPromo',
  outputPath,
  '--codec=h264',
  '--crf=23',
];

const log = createWriteStream(logPath, { flags: 'a' });
log.write(`[render-promo] ${new Date().toISOString()}\n`);
log.write(`[render-promo] command: npx ${args.join(' ')}\n\n`);

const child = spawn('npx', args, {
  env: process.env,
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  log.write(chunk);
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  log.write(chunk);
});

child.on('close', (code) => {
  log.write(`\n[render-promo] exit_code=${code}\n`);
  log.write(`[render-promo] output=${outputPath}\n`);
  log.write(`[render-promo] log=${logPath}\n`);
  log.end();
  process.exit(code ?? 1);
});
