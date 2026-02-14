# Releasing (Local-Only Build Workflow)

This project does not rely on CI/CD for WASM generation. Build locally, commit artifacts, then deploy static output.

## 1. Verify Tooling
- `node -v` matches `.nvmrc` (`20.19.0`)
- `rustc --version` matches `rust-toolchain.toml` (`1.93.0`)
- `wasm-pack --version` is available

## 2. Build Release Artifacts
```bash
npm run release:local
```

Expected outputs:
- `wasm/pkg/*` (WASM package used by frontend)
- `dist/*` (production static site)

Notes:
- `npm run wasm:build` automatically removes generated `wasm/pkg/.gitignore` so package files can be committed.

## 3. Smoke Test
```bash
npm run preview
```

Validate:
- Upload/drag-drop works
- Convert works for JPEG/PNG/WebP
- Download individual file and ZIP

## 4. Commit Artifacts
Commit source changes and generated `wasm/pkg` artifacts together.

## 5. Deploy
Deploy `dist` as static files (for example Vercel).
