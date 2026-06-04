# 分发说明

把打包脚本生成的 tar 文件发给同事即可。解压后目录结构大致如下：

```text
head_pose_viewer/
├── index.html
├── run.sh
├── run_windows.bat
├── scripts/
├── src/
├── data/
├── vendor/
├── model/
└── README.md
```

注意事项：

- 不建议直接双击 `index.html`，浏览器安全策略可能阻止模型或 ES module 加载。
- `vendor/` 目录包含 Three.js、OrbitControls、GLTFLoader 及其工具依赖，离线分发时不能删除。
- Windows 同事即使没有 Python，也可以双击 `run_windows.bat` 运行。
- Linux/macOS 同事需要本机有 `python3` 或 `python`，然后运行 `./run.sh`。
- 分发包只包含运行需要的 GLB 模型，不包含原始 FBX、glTF zip 或 USDZ 下载包。
- 服务器上可使用 `./head_pose render ...` 命令行工具批量出图，需先安装 `requirements-cli.txt` 并执行 `install-browsers`。
