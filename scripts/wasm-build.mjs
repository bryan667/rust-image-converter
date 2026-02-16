import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const wasiTargetByPlatform = {
  win32: 'x86_64-windows',
  linux: process.arch === 'arm64' ? 'arm64-linux' : 'x86_64-linux',
  darwin: process.arch === 'arm64' ? 'arm64-macos' : 'x86_64-macos',
};

const wasiTarget = wasiTargetByPlatform[process.platform];
if (!wasiTarget) {
  console.error(`Unsupported platform: ${process.platform}`);
  process.exit(1);
}

const wasiSdkRoot = path.join(repoRoot, 'tools', `wasi-sdk-30.0-${wasiTarget}`);
const wasiBin = path.join(wasiSdkRoot, 'bin');
const exeSuffix = process.platform === 'win32' ? '.exe' : '';
const clangPath = path.join(wasiBin, `clang${exeSuffix}`);
const arPath = path.join(wasiBin, `llvm-ar${exeSuffix}`);
const sysrootPath = path.join(wasiSdkRoot, 'share', 'wasi-sysroot');

if (!existsSync(clangPath)) {
  console.error(`Missing clang at ${clangPath}`);
  console.error('Run `npm run toolchain:setup` before `npm run wasm:build`.');
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
