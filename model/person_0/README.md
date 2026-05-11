# person_0 模型文件

模型来源：

```text
https://sketchfab.com/3d-models/head-scan-13-photogrammetry-5e6d2804405449e6b3bd96cd12d8b1ab
```

原页面标注为 Creative Commons Attribution，使用和分发时请保留作者署名。

## 下载方式

1. 打开上面的 Sketchfab 页面。
2. 点击页面中的 Download。
3. 推荐下载 `GLB` 格式，至少下载 `Texture size: 4k` 版本。
4. 如果需要更快加载，也可以同时下载 `GLB 1k`；如果需要最高纹理质量，可以下载 `GLB 8k`。

## 放置方式

将下载后的 GLB 文件放到：

```text
model/person_0/GLB/
```

项目默认会查找这些文件名：

```text
model/person_0/GLB/head_scan_13_photogrammetry_1k.glb
model/person_0/GLB/head_scan_13_photogrammetry_4k.glb
model/person_0/GLB/head_scan_13_photogrammetry_8k.glb
```

其中 `4k` 版本是页面默认加载的模型。如果下载后的文件名不同，请重命名为上面的对应文件名，或者修改 `index.html` 中模型下拉框的路径。

## 可选格式

如果需要保留 Sketchfab 原始下载内容，可以按格式放置：

```text
model/person_0/FBX/
model/person_0/glTF/
model/person_0/USDZ/
```

当前 Web 页面只直接加载 `GLB` 文件，其他格式用于备份或后续转换。
