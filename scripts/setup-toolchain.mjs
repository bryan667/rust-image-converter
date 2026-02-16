import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const toolsDir = join(repoRoot, 'tools');
const version = '30.0';
const releaseTag = 'wasi-sdk-30';

const platformMap = {
  win32: 'x86_64-windows',
  linux: process.arch === 'arm64' ? 'arm64-linux' : 'x86_64-linux',
  darwin: process.arch === 'arm64' ? 'arm64-macos' : 'x86_64-macos',
};

const target = platformMap[process.platform];
if (!target) {
  console.error(`Unsupported OS: ${process.platform}`);
  process.exit(1);
}

const sdkFolder = `wasi-sdk-${version}-${target}`;
const archiveName = `${sdkFolder}.tar.gz`;
const sdkDir = join(toolsDir, sdkFolder);
const archivePath = join(toolsDir, archiveName);
const downloadUrl = `https://github.com/WebAssembly/wasi-sdk/releases/download/${releaseTag}/${archiveName}`;

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const commandExists = (cmd, args = ['--version']) => {
  const result = spawnSync(cmd, args, { stdio: 'ignore', shell: false });
  return result.status === 0;
};

const ensureWasiSdk = async () => {
  if (existsSync(sdkDir)) {
    console.log(`WASI SDK already present at ${sdkDir}`);
    return;
  }

  mkdirSync(toolsDir, { recursive: true });
  console.log(`Downloading ${archiveName}...`);
  const response = await fetch(downloadUrl);
  if (!response.ok || !response.body) {
    console.error(`Failed to download WASI SDK from ${downloadUrl}`);
    process.exit(1);
  }

  await pipeline(response.body, createWriteStream(archivePath));

  console.log(`Extracting ${archiveName}...`);
  run('tar', ['-xzf', archivePath, '-C', toolsDir]);
  rmSync(archivePath, { force: true });
};

const ensureRustTarget = () => {
  if (!commandExists('rustup')) {
    console.error('rustup not found. Install Rust from https://rustup.rs/');
    process.exit(1);
  }
  run('rustup', ['target', 'add', 'wasm32-unknown-unknown']);
};

const ensureWasmPack = () => {
  if (commandExists('wasm-pack')) {
    console.log('wasm-pack already installed');
    return;
  }
  if (!commandExists('cargo')) {
    console.error('cargo not found. Install Rust toolchain first.');
    process.exit(1);
  }
  run('cargo', ['install', 'wasm-pack', '--locked']);
};

const main = async () => {
  await ensureWasiSdk();
  ensureRustTarget();
  ensureWasmPack();
  console.log('Toolchain setup complete.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
