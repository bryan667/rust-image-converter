# Hosted in Vercel

[rust-image-converter.vercel.app](https://rust-image-converter.vercel.app/)

# Rust Image Converter (Client-Side)

React + Vite frontend with a Rust - WASM module for browser-only image conversion/compression. Runs parallel WASM workers based on browser's navigator.hardwareConcurrency.

## Stack

- Frontend: React + Vite
- Conversion: Rust (`image` crate) and C libwebp compiled to WASM
- Packaging: `wasm-pack`

## Toolchain

- Node: `20.19.0` (see `.nvmrc`)
- Rust: `1.93.0` with `wasm32-unknown-unknown` target (see `rust-toolchain.toml`)
- run script `toolchain:setup` to install WASI SDK in `tools/` (downloaded by setup script)

## First-Time Setup for Local Dev (New Computer)

Install prerequisites first:

1. Install Node.js `20.19.0` (or newer compatible version)
2. Install Rust via `rustup` from `https://rustup.rs/`
3. Ensure `tar` is available in terminal (default on macOS/Linux, included in modern Windows)

Then run:

```bash
git clone <your-repo-url>
cd rust-image-converter
npm install
npm run toolchain:setup
npm run wasm:build
npm run dev
```

## What `toolchain:setup` Installs

- `wasm32-unknown-unknown` Rust target
- `wasm-pack` (if missing)
- WASI SDK under `tools/`

## Useful Scripts

```bash
npm run toolchain:setup # install toolchain required for build
npm run wasm:build   # build wasm/pkg artifacts
npm run build        # production web build
npm run dev          # Vite dev server
```

`npm run wasm:build` builds WASM package into `wasm/pkg` and normalizes the folder for commits.

## Deployment Model

- This repo is set up for static hosting (for example Vercel).
- `wasm/pkg` is intentionally versioned so deploys can use prebuilt WASM artifacts.
- `wasm/target` remains ignored.

## Why Rust?

why not Rust?
