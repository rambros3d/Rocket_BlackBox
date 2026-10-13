## 1. Documentation Build Script

- [x] 1.1 Create `docs/build_docs.py` to compile `docs/index.md` into static `docs/index.html` with GitHub Primer CSS styling and anchor links.
- [x] 1.2 Execute `python3 docs/build_docs.py` in repository root to generate `docs/index.html` and verify the generated output.

## 2. GitHub Actions Deployment Workflow

- [x] 2.1 Update `.github/workflows/deploy-pages.yml` to install Python `markdown` and run `python3 docs/build_docs.py` before uploading the Pages artifact.
- [x] 2.2 Validate syntax and test running `docs/build_docs.py`.
