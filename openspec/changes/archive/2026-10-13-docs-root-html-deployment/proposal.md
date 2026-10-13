## Why

Visiting `https://blackbox.rambros3d.com/` currently returns HTTP 404 ("File not found") from GitHub Pages because the deployed artifact in `docs/` contains only `index.md` and no `index.html`. Because `docs/.nojekyll` is present and GitHub Actions uses `actions/deploy-pages@v4` (raw static file deployment), GitHub Pages does not run Jekyll to render markdown files.

Compiling `docs/index.md` into static `docs/index.html` during the automated GitHub Actions workflow will restore the documentation homepage at `https://blackbox.rambros3d.com/` while preserving the live telemetry dashboard at `/dashboard/`.

## What Changes

- Add a standalone documentation build script `docs/build_docs.py` using Python's `markdown` library and Primer CSS styling (shared with `docs/preview_docs.py`) to convert `docs/index.md` into a responsive, standalone `docs/index.html`.
- Update `.github/workflows/deploy-pages.yml` to install `markdown` and compile `docs/index.html` prior to uploading the GitHub Pages artifact.
- Pre-generate and track `docs/index.html` in the repository so local static serving and immediate deployments have a valid root page.

## Capabilities

### Modified Capabilities
- `dashboard-pages-deployment`: Require automated compilation of `docs/index.md` into `docs/index.html` before uploading the GitHub Pages artifact, ensuring both `/` (documentation) and `/dashboard/` (telemetry UI) resolve with HTTP 200.

## Impact

- Subsystem affected: `website` / `docs` & CI deployment workflow (`.github/workflows/deploy-pages.yml`).
- No changes to firmware (`flight_firmware`, `test_firmware`) or PCB/mechanical hardware.
