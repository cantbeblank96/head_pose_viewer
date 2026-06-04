#!/usr/bin/env python3
"""Package the offline Head Pose Viewer release tarball."""

from __future__ import annotations

import argparse
import tarfile
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = PROJECT_ROOT / "dist"
PACKAGE_ROOT = "head_pose_viewer"

FILES = [
    "index.html",
    "README.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "requirements-cli.txt",
    "head_pose",
    "run.sh",
    "run_windows.bat",
    "cli/render.html",
    "data/angles.example.csv",
    "model/person_0/README.md",
    "model/person_0/GLB/head_scan_13_photogrammetry_1k.glb",
    "model/person_0/GLB/head_scan_13_photogrammetry_4k.glb",
    "model/person_0/GLB/head_scan_13_photogrammetry_8k.glb",
]

DIRECTORIES = [
    "src",
    "scripts",
    "vendor",
    "notes",
]

EXCLUDED_SCRIPT_NAMES = {
    "package_dist.py",
    "head_pose_cli.py",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Package Head Pose Viewer for offline distribution.")
    parser.add_argument(
        "--name",
        default=f"head_pose_viewer_{datetime.now().strftime('%Y%m%d_%H%M%S')}.tar",
        help="Output tar filename under dist/. Default: head_pose_viewer_YYYYmmdd_HHMMSS.tar",
    )
    return parser.parse_args()


def iter_package_paths() -> list[Path]:
    paths: list[Path] = []

    for relative in FILES:
        path = PROJECT_ROOT / relative
        if not path.is_file():
            raise FileNotFoundError(f"Required file not found: {relative}")
        paths.append(path)

    for relative in DIRECTORIES:
        directory = PROJECT_ROOT / relative
        if not directory.is_dir():
            raise FileNotFoundError(f"Required directory not found: {relative}")
        for path in sorted(directory.rglob("*")):
            if path.is_file() and path.name not in EXCLUDED_SCRIPT_NAMES:
                paths.append(path)

    return sorted(set(paths))


def add_file(tar: tarfile.TarFile, path: Path) -> None:
    relative = path.relative_to(PROJECT_ROOT)
    arcname = Path(PACKAGE_ROOT) / relative
    info = tar.gettarinfo(path, arcname=arcname)
    info.uid = 0
    info.gid = 0
    info.uname = ""
    info.gname = ""
    with path.open("rb") as file:
        tar.addfile(info, file)


def main() -> None:
    args = parse_args()
    output_name = args.name if args.name.endswith(".tar") else f"{args.name}.tar"
    output_path = DIST_DIR / output_name

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    package_paths = iter_package_paths()

    with tarfile.open(output_path, "w") as tar:
        for path in package_paths:
            add_file(tar, path)

    size_mb = output_path.stat().st_size / 1024 / 1024
    print(f"Created: {output_path}")
    print(f"Files: {len(package_paths)}")
    print(f"Size: {size_mb:.2f} MB")


if __name__ == "__main__":
    main()
