#!/usr/bin/env python3
"""Head Pose Viewer CLI — headless render via Playwright."""

from __future__ import annotations

import argparse
import base64
import re
import socket
import sys
import threading
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = "model/person_0/GLB/head_scan_13_photogrammetry_4k.glb"
RENDER_PAGE = "/cli/render.html"
CHROMIUM_ARGS = [
    "--ignore-gpu-blocklist",
    "--use-gl=angle",
    "--enable-webgl",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render head pose images from yaw/pitch/roll without opening a browser.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    render_parser = subparsers.add_parser("render", help="Render a single PNG.")
    add_pose_args(render_parser)
    render_parser.add_argument("-o", "--output", required=True, help="Output PNG path.")

    batch_parser = subparsers.add_parser("batch", help="Render PNGs from a CSV angle list.")
    add_pose_args(batch_parser, require_pose=False)
    batch_parser.add_argument(
        "--angles",
        required=True,
        help="CSV file with yaw,pitch,roll per line.",
    )
    batch_parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory to write PNG files.",
    )

    subparsers.add_parser(
        "install-browsers",
        help="Download Playwright Chromium (run once per machine).",
    )

    return parser.parse_args()


def add_pose_args(parser: argparse.ArgumentParser, require_pose: bool = True) -> None:
    parser.add_argument("--yaw", type=float, default=0.0)
    parser.add_argument("--pitch", type=float, default=0.0)
    parser.add_argument("--roll", type=float, default=0.0)
    parser.add_argument("--base-yaw", type=float, default=0.0)
    parser.add_argument("--base-pitch", type=float, default=0.0)
    parser.add_argument("--base-roll", type=float, default=0.0)
    parser.add_argument("--model", default=DEFAULT_MODEL, help="GLB path relative to project root.")
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1024)
    if require_pose:
        return


def pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@contextmanager
def serve_project(root: Path):
    port = pick_free_port()

    def handler(*args, **kwargs):
        return SimpleHTTPRequestHandler(*args, directory=str(root), **kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def resolve_path(path_text: str) -> Path:
    path = Path(path_text)
    if path.is_absolute():
        return path
    return (PROJECT_ROOT / path).resolve()


def parse_batch_angles(path: Path) -> list[dict[str, float]]:
    text = path.read_text(encoding="utf-8")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []

    has_header = bool(re.search(r"[a-zA-Z]", lines[0]))
    data_lines = lines[1:] if has_header else lines

    rows: list[dict[str, float]] = []
    for index, line in enumerate(data_lines, start=1):
        parts = [part for part in re.split(r"[,\s]+", line) if part]
        if len(parts) < 3:
            raise ValueError(f"Line {index} needs yaw,pitch,roll: {line}")
        try:
            yaw, pitch, roll = (float(parts[0]), float(parts[1]), float(parts[2]))
        except ValueError as error:
            raise ValueError(f"Line {index} has non-numeric angles: {line}") from error
        rows.append({"yaw": yaw, "pitch": pitch, "roll": roll})
    return rows


def normalize_model_path(model_text: str) -> str:
    path = model_text.strip().replace("\\", "/")
    if path.startswith("/") or path.startswith("http://") or path.startswith("https://"):
        return path
    return f"/{path.lstrip('/')}"


def build_render_options(args: argparse.Namespace, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    options: dict[str, Any] = {
        "modelPath": normalize_model_path(args.model),
        "yaw": args.yaw,
        "pitch": args.pitch,
        "roll": args.roll,
        "baseYaw": args.base_yaw,
        "basePitch": args.base_pitch,
        "baseRoll": args.base_roll,
        "width": args.width,
        "height": args.height,
    }
    if extra:
        options.update(extra)
    return options


def decode_data_url(data_url: str) -> bytes:
    if not data_url.startswith("data:image/png;base64,"):
        raise ValueError("Renderer did not return a PNG data URL.")
    return base64.b64decode(data_url.split(",", 1)[1])


def ensure_playwright():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise SystemExit(
            "Playwright is not installed. Run:\n"
            "  pip install -r requirements-cli.txt\n"
            "  python scripts/head_pose_cli.py install-browsers\n",
        ) from error
    return sync_playwright


def wait_for_cli(page) -> None:
    page.wait_for_function(
        "() => Boolean(window.headPoseCli && typeof window.headPoseCli.renderOne === 'function')",
    )


def launch_browser(playwright):
    """参数：Playwright 实例。返回：已配置 WebGL 的 Chromium 浏览器。"""
    return playwright.chromium.launch(headless=True, args=CHROMIUM_ARGS)


def run_render(page, base_url: str, options: dict[str, Any]) -> dict[str, Any]:
    page.goto(f"{base_url}{RENDER_PAGE}", wait_until="load", timeout=120_000)
    wait_for_cli(page)
    return page.evaluate(
        """async (opts) => {
            const result = await window.headPoseCli.renderOne(opts);
            return {
                dataUrl: result.dataUrl,
                fileName: result.fileName,
                width: result.width,
                height: result.height,
            };
        }""",
        options,
    )


def run_batch(page, base_url: str, options: dict[str, Any], rows: list[dict[str, float]]) -> list[dict[str, Any]]:
    page.goto(f"{base_url}{RENDER_PAGE}", wait_until="load", timeout=120_000)
    wait_for_cli(page)
    return page.evaluate(
        """async (opts) => {
            const results = await window.headPoseCli.renderBatch(opts);
            return results.map((item) => ({
                dataUrl: item.dataUrl,
                fileName: item.fileName,
                width: item.width,
                height: item.height,
            }));
        }""",
        {**options, "rows": rows},
    )


def command_render(args: argparse.Namespace) -> int:
    output_path = resolve_path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    sync_playwright = ensure_playwright()
    options = build_render_options(args)

    with serve_project(PROJECT_ROOT) as base_url, sync_playwright() as playwright:
        browser = launch_browser(playwright)
        page = browser.new_page(viewport={"width": args.width, "height": args.height})
        page.set_default_timeout(120_000)
        try:
            result = run_render(page, base_url, options)
            output_path.write_bytes(decode_data_url(result["dataUrl"]))
        finally:
            browser.close()

    print(f"Saved: {output_path}")
    return 0


def command_batch(args: argparse.Namespace) -> int:
    angles_path = resolve_path(args.angles)
    output_dir = resolve_path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    rows = parse_batch_angles(angles_path)
    if not rows:
        raise SystemExit(f"No angles found in {angles_path}")

    sync_playwright = ensure_playwright()
    options = build_render_options(args)

    with serve_project(PROJECT_ROOT) as base_url, sync_playwright() as playwright:
        browser = launch_browser(playwright)
        page = browser.new_page(viewport={"width": args.width, "height": args.height})
        page.set_default_timeout(120_000)
        try:
            results = run_batch(page, base_url, options, rows)
            for item in results:
                target = output_dir / item["fileName"]
                target.write_bytes(decode_data_url(item["dataUrl"]))
                print(f"Saved: {target}")
        finally:
            browser.close()

    print(f"Batch complete: {len(results)} images in {output_dir}")
    return 0


def command_install_browsers() -> int:
    ensure_playwright()
    import subprocess

    completed = subprocess.run(
        [sys.executable, "-m", "playwright", "install", "chromium"],
        check=False,
    )
    return completed.returncode


def main() -> int:
    args = parse_args()
    if args.command == "render":
        return command_render(args)
    if args.command == "batch":
        return command_batch(args)
    if args.command == "install-browsers":
        return command_install_browsers()
    raise SystemExit(f"Unknown command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
