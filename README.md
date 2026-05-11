# Head Pose Viewer

一个本地浏览器工具，用于加载 Sketchfab 下载的人头 GLB 模型，输入精确的 `yaw / pitch / roll` 角度进行预览，并导出单张或批量姿态截图。

## 运行

### 一键启动

Linux/macOS：

```bash
./run.sh
```

Windows：

```text
双击 run_windows.bat
```

Windows 启动脚本使用系统自带 PowerShell 提供本地静态文件服务，不需要安装 Python。

项目已经内置 Three.js 相关前端依赖，启动和使用过程不需要联网。

### 手动启动

如果已经安装 Python，也可以在项目根目录启动静态文件服务：

```bash
python -m http.server 8000
```

然后在浏览器打开：

```text
http://localhost:8000/
```

页面默认加载：

```text
model/person_0/GLB/head_scan_13_photogrammetry_4k.glb
```

如果加载较慢，可以在页面模型下拉框切换到 `1k` 版本。

## 打包

生成离线分发 tar 包：

```bash
python scripts/package_dist.py
```

输出位置：

```text
dist/head_pose_viewer_*.tar
```

详细分发说明见 `notes/distribution.md`。

## 角度定义

- `yaw`：绕竖直 `Y` 轴旋转。
- `pitch`：绕水平 `X` 轴旋转。
- `roll`：绕视线方向 `Z` 轴旋转。

页面还提供 `Base Yaw / Base Pitch / Base Roll`。如果模型初始方向不是严格正脸，可以先调整基础校准角，让当前 `yaw=0, pitch=0, roll=0` 对应你想要的正脸方向。

## 导出截图

单张导出会根据当前角度生成 PNG，文件名包含姿态信息，例如：

```text
person_0_yaw_30_pitch_0_roll_0.png
```

截图分辨率由页面里的宽度和高度输入框控制，默认是 `1024 x 1024`。默认勾选“导出前使用固定相机”，这样鼠标拖动预览视角不会影响生成的数据集图片。

## 批量导出

批量角度输入框支持 CSV 或空白分隔，每行一组：

```csv
yaw,pitch,roll
0,0,0
30,0,0
-30,0,0
0,15,0
```

点击“批量导出截图”后，浏览器会逐张下载 PNG。示例角度文件见：

```text
data/angles.example.csv
```

## 模型来源

模型来自 Sketchfab：

```text
https://sketchfab.com/3d-models/head-scan-13-photogrammetry-5e6d2804405449e6b3bd96cd12d8b1ab
```

原页面标注为 CC Attribution，使用和分发时请保留作者署名。
