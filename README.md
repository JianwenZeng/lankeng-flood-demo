# 蓝坑 3D 洪水淹没演示

这是发布到 GitHub Pages 的 CesiumJS 在线演示页面。三维模型从 Cesium ion 加载，页面打开后会自动按原始地理参考定位，并自动执行贴地高程校准。

在线访问地址：

```text
https://JianwenZeng.github.io/lankeng-flood-demo/
```

## 当前版本

- 模型来源：Cesium ion 3D Tiles
- Asset ID：`5008047`
- 坐标来源：原始模型 `EPSG:4546` 与 `SRSOrigin = 618590, 2673551, 213`
- 页面打开后自动贴地校准，无需用户手动调东西偏移、南北偏移、高程、旋转或缩放
- 洪水淹没层默认关闭，用户勾选后再播放动态上涨演示
- Cesium ion token 为只读 token，已写入前端代码，建议在 Cesium ion 后台限制来源域名和可访问资产

## 本地开发

以后请在这个干净仓库里修改和发布：

```text
D:\project\repo\lankeng-flood-demo
```

本地预览：

```powershell
cd D:\project\repo\lankeng-flood-demo
python -m http.server 8000 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8000/
```

## 更新并发布到 GitHub Pages

每次修改后执行：

```powershell
cd D:\project\repo\lankeng-flood-demo
git status
git add index.html README.md viewer/cesium-app.js viewer/cesium-styles.css
git commit -m "Update demo"
git push
```

GitHub Pages 会在 push 后自动重新部署，通常几十秒到几分钟生效。

## 说明

当前洪水层是演示级水平水面上涨，不是严格二维水动力模型。若要做真实洪水过程，应基于 DSM/DEM、边界条件和降雨或流量过程线计算每个时刻的水深栅格，再把水深结果作为动态淹没贴图或水体网格叠加。

Cesium/Cesium ion 和地图数据的版权/署名信息应按服务条款保留。
