# 蓝坑三维洪水淹没 Cesium 演示

当前默认入口 `index.html` 已切换为 CesiumJS 在线版：模型从 Cesium ion 资产 `5007870` 加载，不再依赖本地 OBJ/JPG 模型文件。旧的 Three.js 本地 OBJ 版本已备份为 `index-local-three.html`。

## 启动方式

双击 `start-viewer.bat`，浏览器会打开：

```text
http://127.0.0.1:8000/
```

也可以在当前目录手动运行：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

然后打开 `http://127.0.0.1:8000/`。

## 在线模型定位

模型使用原始数据中的地理参考进行客户端定位：

```text
SRS: EPSG:4546
SRSOrigin: 618590, 2673551, 213
Cesium ion Asset ID: 5007870
```

代码会把 EPSG:4546 投影坐标转换为经纬度，并通过 Cesium `modelMatrix` 把未地理参考的 3D Tiles 放到地球上。若模型和底图仍有偏差，可在页面右侧“模型定位”中调整东西偏移、南北偏移、高程偏移、水平旋转和缩放。


## 高程漂移说明

如果模型经纬度对了但整体漂浮或下沉，通常是垂直基准不一致导致的。Cesium 的经纬度高度使用椭球高；无人机建模元数据里的 `SRSOrigin` 第三个值 `213` 可能是正高、项目高程或地方高程基准，并不一定等同于 Cesium 地形的高度基准。

页面右侧提供“贴地校准”按钮，会在原始 OBJ 的最低点附近采样 Cesium World Terrain，并自动计算高程偏移。也可以手动调整“高程偏移”，现在范围为 `-500 m` 到 `500 m`。
## 洪水演示

- “洪水淹没演示”提供低水位、中等、高水位和极端淹没四种情景。
- 点击“播放上涨”后，半透明水面会按设定速度动态上涨。
- 也可以手动拖动当前水位。
- 水位单位为模型相对高程米，读数中同时显示 `213 m + 相对水位` 的绝对高程。

## 注意事项

- 当前正射影像未接入 Cesium ion，因此默认入口暂不加载本地 DOM 正射影像。
- 当前洪水层是演示级水平水面上涨，不是严格二维水动力模型。
- 若要做真实洪水过程，应基于 DSM/DEM、边界条件和降雨或流量过程线计算每个时刻的水深栅格，再把水深结果作为动态淹没贴图或水体网格叠加。
- 当前仓库代码不再写死 Cesium ion token。页面首次打开时会提示输入 token，并保存到浏览器 localStorage。公开给别人访问时，建议在 Cesium ion 后台创建只读、限制来源域名的 token，再把 token 通过单独渠道发给访问者，或在确认风险后改成公开受限 token。


## GitHub Pages 发布

不要直接推送包含旧提交历史的当前 `main`，因为旧历史里曾经包含过明文 Cesium ion token。推荐用干净历史发布，只包含这些文件：

```text
index.html
README.md
.nojekyll
.gitignore
viewer/cesium-app.js
viewer/cesium-styles.css
```

如果公开部署，先在 Cesium ion 创建只读并限制来源域名的 token。GitHub Pages 发布地址通常是：

```text
https://JianwenZeng.github.io/lankeng-flood-demo/
```
