# Rust Image Converter (Client-Side)

React + Vite frontend with a Rust → WASM module that converts and compresses images entirely in the browser.

## Features
- Drag & drop or file picker
- Convert PNG, JPEG, WebP
- Optional resize to max dimensions
- Lossy / lossless toggle
- Download individually or as ZIP
- Query params: `?from=png&to=webp`

## Prereqs
- Node 20+
- Rust toolchain
- `wasm-pack` (`cargo install wasm-pack`)

## Development
1. Build the WASM module:
```bash
wasm-pack build wasm --target web --release
```
2. Start the Vite dev server:
```bash
npm run dev
```

If you change Rust code, re-run `wasm-pack build` and refresh the app.

## Production build
```bash
wasm-pack build wasm --target web --release
npm run build
```
