# Windows Packaging

IDLE is packaged as a Windows x64 NSIS installer using Electron Builder.

## Prerequisites

- Windows 10/11
- Node.js 22
- pnpm 10.15.0

## Build the installer

From the repository root:

```powershell
pnpm install
pnpm package:windows
```

The installer is written to `apps/desktop/release/`.

## What the packaging command does

1. Bundles the runtime entry point with esbuild so workspace TypeScript packages are included in the production runtime.
2. Builds the Electron desktop application with electron-vite.
3. Builds an x64 NSIS installer with Electron Builder.
4. Places the runtime bundle in the packaged application's `resources/runtime` directory.

The packaged desktop process resolves the runtime from `process.resourcesPath` while development continues to use the workspace runtime build.

## CI

`.github/workflows/windows-package.yml` runs on `windows-latest` for pushes and pull requests. It performs typecheck and tests before building the installer and uploads the generated `.exe` as a workflow artifact.
