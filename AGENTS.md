# AGENTS.md

## Cursor Cloud specific instructions

Head Pose Viewer is a **static browser tool** (no build step) plus a **Python + Playwright CLI** that headlessly renders the same Three.js scene to PNG. There is no formal lint/test framework, no `package.json`, and no CI in this repo.

### Services / how to run

- **Web viewer**: served as static files. Run `python3 -m http.server 8000` from the repo root, then open `http://localhost:8000/`. Three.js is vendored under `vendor/`, so no install or network is needed for the web app. See `README.md` and `run.sh`.
- **CLI renderer** (`scripts/head_pose_cli.py`, wrapper `./head_pose`): requires the `playwright` package and a Chromium browser. The update script installs these into a `.venv` virtualenv at the repo root. Run CLI commands with `.venv/bin/python scripts/head_pose_cli.py render|batch ...` (the `./head_pose` wrapper uses the system `python3`, which does NOT have Playwright — prefer `.venv/bin/python`). Example: `.venv/bin/python scripts/head_pose_cli.py render --yaw 30 --pitch 10 --model <glb> -o result/pose.png`.

### Important gotcha: the GLB models are missing

The head models under `model/person_0/**` are **Git LFS** pointers, and the LFS objects currently return **404 on the remote** (`git lfs pull` fails with "Object does not exist on the server"). The default model path `model/person_0/GLB/head_scan_13_photogrammetry_4k.glb` therefore does NOT load out of the box.

There is a committed lightweight stand-in model at `model/sample_head.glb` (a small asymmetric head: sphere + nose cone + eyes + mouth, so yaw/pitch/roll are visibly distinguishable). It is a plain git file (NOT LFS — the `.gitattributes` LFS rules only match `model/person_0/**`). The web viewer defaults its dropdown to this sample so the app works out of the box without the LFS assets.

To run/test rendering without the real models:
- Web: just use the default "内置示例 / Sample head" dropdown option.
- CLI: pass `--model model/sample_head.glb` (the path must resolve under the repo root so the built-in static server can serve it).
- If you ever need a substitute over the real LFS path, copy a `.glb` over it and restore the pointer with `git checkout -- <path>` afterward — do NOT commit a model over the LFS pointer.

`trimesh`/`numpy` were used only to generate `model/sample_head.glb` and are not needed by the app.

### Lint / "tests"

No linters or tests are configured. For a basic sanity check use `.venv/bin/python -m py_compile scripts/*.py` and `node --check src/*.js`.

### Notes

- `requirements-cli.txt` pins only `playwright`. The Chromium download is large; on a fresh machine also run `.venv/bin/python -m playwright install chromium` (the update script does this) and, once per machine, the OS deps via `playwright install-deps chromium` (needs sudo apt; already baked into the cloud snapshot).
- Generated images and the virtualenv (`result/`, `dist/`, `.venv/`) are gitignored.
