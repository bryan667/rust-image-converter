import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const wasiSdkRoot = path.join(repoRoot, 'tools', 'wasi-sdk-30.0-x86_64-windows');
const wasiBin = path.join(wasiSdkRoot, 'bin');
const clangPath = path.join(wasiBin, 'clang.exe');
const arPath = path.join(wasiBin, 'llvm-ar.exe');
const sysrootPath = path.join(wasiSdkRoot, 'share', 'wasi-sysroot');

if (!existsSync(clangPath)) {
  console.error(`Missing clang at ${clangPath}`);
  console.error('Install/extract wasi-sdk into tools/ before running wasm build.');
  process.exit(1);
}

if (!existsSync(sysrootPath)) {
  console.error(`Missing WASI sysroot at ${sysrootPath}`);
  process.exit(1);
}

const env = {
  ...process.env,
  PATH: `${wasiBin}${path.delimiter}${process.env.PATH ?? ''}`,
  CC_wasm32_unknown_unknown: clangPath,
  AR_wasm32_unknown_unknown: arPath,
  CFLAGS_wasm32_unknown_unknown:
    `--sysroot=${sysrootPath} ` +
    `-I${path.join(sysrootPath, 'include')} ` +
    `-I${path.join(sysrootPath, 'include', 'wasm32-wasi')}`,
};

const result = spawnSync(
  'wasm-pack',
  ['build', 'wasm', '--target', 'web', '--release'],
  { stdio: 'inherit', env },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
