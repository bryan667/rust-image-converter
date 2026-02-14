# Rust Image Converter (Client-Side)

React + Vite frontend with a Rust -> WASM module for browser-only image conversion/compression.

## Stack
- Frontend: React + Vite
- Conversion: Rust (`image` crate) compiled to WASM
- Packaging: `wasm-pack`

## Toolchain
- Node: `20.19.0` (see `.nvmrc`)
- Rust: `1.93.0` with `wasm32-unknown-unknown` target (see `rust-toolchain.toml`)
- `wasm-pack` installed globally (`cargo install wasm-pack`)

## Development
```bash
npm run wasm:build
npm run dev
```

## Local Release Build
```bash
npm run release:local
```

This command:
1. Builds WASM package into `wasm/pkg`
2. Builds web app into `dist`
3. Runs lint checks
4. Normalizes `wasm/pkg` so generated artifacts are committable

## Deployment Model
- This repo is set up for static hosting (for example Vercel).
- `wasm/pkg` is intentionally versioned so deploys can use prebuilt WASM artifacts.
- `wasm/target` remains ignored.

For the full release checklist, see `RELEASING.md`.
