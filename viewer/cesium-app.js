// const ION_ASSET_ID = 5008047;
const ION_ASSET_ID = 5011020;
const ION_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjZGFkYWNkOS1jNmRiLTQ1ZmUtODExMi1hN2E2NTNkYTQ2MzgiLCJpZCI6MTQ0NzkwLCJpYXQiOjE2ODYwMjk5MTd9.UQB3F_dFJVONKtmnPBHGoiN3Myd2Ncus9noUj3nQOeo";

const SRS_ORIGIN = {
  easting: 618590,
  northing: 2673551,
  height: 213
};

const MODEL_BOUNDS = {
  minX: 38.8659,
  maxX: 923.4814,
  minY: 22.3782,
  maxY: 754.5969,
  minZ: 0,
  maxZ: 55.8675
};

const LOWEST_MODEL_POINT = {
  x: 135.5912,
  y: 27.5034,
  z: 0
};

const CGCS2000 = {
  a: 6378137,
  f: 1 / 298.257222101,
  k0: 1,
  falseEasting: 500000,
  falseNorthing: 0,
  lon0: Cesium.Math.toRadians(111)
};
CGCS2000.e2 = CGCS2000.f * (2 - CGCS2000.f);
CGCS2000.ep2 = CGCS2000.e2 / (1 - CGCS2000.e2);

const FLOOD_SCENARIOS = {
  minor: { target: 8, speed: 0.8 },
  medium: { target: 18, speed: 1.0 },
  major: { target: 32, speed: 1.4 },
  extreme: { target: 52, speed: 2.0 }
};

const state = {
  georef: {
    offsetEast: 0,
    offsetNorth: 0,
    offsetHeight: 0,
    heading: 0,
    scale: 1
  },
  flood: {
    level: 0,
    target: FLOOD_SCENARIOS.medium.target,
    speed: FLOOD_SCENARIOS.medium.speed,
    opacity: 0.55,
    playing: false,
    visible: false
  },
  lastTickMs: performance.now()
};

const elements = {
  status: document.querySelector("#load-state"),
  flyModel: document.querySelector("#fly-model"),
  floodToggle: document.querySelector("#flood-toggle"),
  floodScenario: document.querySelector("#flood-scenario"),
  floodPlay: document.querySelector("#flood-play"),
  floodReset: document.querySelector("#flood-reset"),
  fitFlood: document.querySelector("#fit-flood"),
  floodLevel: document.querySelector("#flood-level"),
  floodSpeed: document.querySelector("#flood-speed"),
  floodOpacity: document.querySelector("#flood-opacity"),
  floodLevelValue: document.querySelector("#flood-level-value"),
  floodSpeedValue: document.querySelector("#flood-speed-value"),
  floodReadout: document.querySelector("#flood-readout")
};

Cesium.Ion.defaultAccessToken = ION_ACCESS_TOKEN;

const blankBaseLayerViewModel = new Cesium.ProviderViewModel({
  name: "黑色背景",
  tooltip: "不加载地图底图，只显示黑色背景和三维模型。",
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='black'/%3E%3Cpath d='M10 44 27 25l9 10 8-12 10 21H10Z' fill='%23212a33'/%3E%3C/svg%3E",
  creationFunction: () => Cesium.SingleTileImageryProvider.fromUrl(
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='2' height='2' fill='black'/%3E%3C/svg%3E",
    { rectangle: Cesium.Rectangle.MAX_VALUE }
  )
});

const imageryProviderViewModels = [
  blankBaseLayerViewModel,
  ...Cesium.createDefaultImageryProviderViewModels()
];

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain({ requestWaterMask: true, requestVertexNormals: true }),
  skyBox: false,
  skyAtmosphere: false,
  animation: false,
  timeline: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  baseLayerPicker: true,
  selectedImageryProviderViewModel: blankBaseLayerViewModel,
  imageryProviderViewModels,
  navigationHelpButton: false,
  fullscreenButton: true,
  infoBox: false,
  selectionIndicator: false,
  shouldAnimate: true
});

viewer.scene.backgroundColor = Cesium.Color.BLACK;
viewer.scene.globe.baseColor = Cesium.Color.BLACK;
viewer.scene.globe.depthTestAgainstTerrain = true;
viewer.scene.fog.enabled = false;
viewer.scene.light = new Cesium.SunLight();
viewer.scene.postProcessStages.fxaa.enabled = true;

let tileset = null;
let floodEntity = null;

function setStatus(text) {
  elements.status.textContent = text;
}

function projectedToLonLat(easting, northing) {
  const { a, e2, ep2, k0, falseEasting, falseNorthing, lon0 } = CGCS2000;
  const x = easting - falseEasting;
  const y = northing - falseNorthing;
  const m = y / k0;
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const j1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const j2 = (21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32;
  const j3 = (151 * e1 ** 3) / 96;
  const j4 = (1097 * e1 ** 4) / 512;
  const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);
  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);
  const c1 = ep2 * cosFp * cosFp;
  const t1 = tanFp * tanFp;
  const n1 = a / Math.sqrt(1 - e2 * sinFp * sinFp);
  const r1 = (a * (1 - e2)) / Math.pow(1 - e2 * sinFp * sinFp, 1.5);
  const d = x / (n1 * k0);
  const lat =
    fp -
    ((n1 * tanFp) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon =
    lon0 +
    (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) /
      cosFp;
  return { lon: Cesium.Math.toDegrees(lon), lat: Cesium.Math.toDegrees(lat) };
}

function transformLocalPoint(x, y) {
  const heading = Cesium.Math.toRadians(state.georef.heading);
  const scaledX = x * state.georef.scale;
  const scaledY = y * state.georef.scale;
  return {
    x: scaledX * Math.cos(heading) - scaledY * Math.sin(heading) + state.georef.offsetEast,
    y: scaledX * Math.sin(heading) + scaledY * Math.cos(heading) + state.georef.offsetNorth
  };
}

function localToLonLat(x, y) {
  const point = transformLocalPoint(x, y);
  return projectedToLonLat(SRS_ORIGIN.easting + point.x, SRS_ORIGIN.northing + point.y);
}

function getOriginLonLat() {
  return projectedToLonLat(
    SRS_ORIGIN.easting + state.georef.offsetEast,
    SRS_ORIGIN.northing + state.georef.offsetNorth
  );
}

function getModelCenterLonLat() {
  return localToLonLat(
    (MODEL_BOUNDS.minX + MODEL_BOUNDS.maxX) / 2,
    (MODEL_BOUNDS.minY + MODEL_BOUNDS.maxY) / 2
  );
}

function getModelCenterHeight() {
  return SRS_ORIGIN.height + state.georef.offsetHeight + (MODEL_BOUNDS.minZ + MODEL_BOUNDS.maxZ) / 2;
}

function buildModelMatrix() {
  const origin = getOriginLonLat();
  const originCartesian = Cesium.Cartesian3.fromDegrees(
    origin.lon,
    origin.lat,
    SRS_ORIGIN.height + state.georef.offsetHeight
  );
  const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(state.georef.heading), 0, 0);
  const frame = Cesium.Transforms.headingPitchRollToFixedFrame(originCartesian, hpr);
  const scaleMatrix = Cesium.Matrix4.fromUniformScale(state.georef.scale);
  return Cesium.Matrix4.multiply(frame, scaleMatrix, new Cesium.Matrix4());
}

function applyTilesetTransform() {
  if (tileset) {
    tileset.modelMatrix = buildModelMatrix();
  }
}

async function calibrateHeightToTerrain() {
  setStatus("贴地校准");
  try {
    const lowestPoint = localToLonLat(LOWEST_MODEL_POINT.x, LOWEST_MODEL_POINT.y);
    const positions = [Cesium.Cartographic.fromDegrees(lowestPoint.lon, lowestPoint.lat)];
    const sampled = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
    const terrainHeight = sampled[0]?.height;
    if (!Number.isFinite(terrainHeight)) {
      throw new Error("Terrain height unavailable");
    }
    state.georef.offsetHeight = terrainHeight - (SRS_ORIGIN.height + LOWEST_MODEL_POINT.z);
    applyTilesetTransform();
    updateFloodReadout();
    setStatus("贴地完成");
  } catch (error) {
    console.error(error);
    setStatus("校准失败");
  }
}

async function loadIonTileset() {
  setStatus("加载模型");
  elements.flyModel.disabled = true;
  try {
    tileset = await Cesium.Cesium3DTileset.fromIonAssetId(ION_ASSET_ID, {
      maximumScreenSpaceError: 2,
      dynamicScreenSpaceError: true
    });
    tileset.modelMatrix = buildModelMatrix();
    viewer.scene.primitives.add(tileset);
    await calibrateHeightToTerrain();
    await viewer.zoomTo(tileset, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 1200));
    setStatus("演示就绪");
  } catch (error) {
    console.error(error);
    setStatus("模型错误");
    flyToModelArea();
  } finally {
    elements.flyModel.disabled = false;
  }
}

function flyToModelArea() {
  if (tileset) {
    viewer.flyTo(tileset, {
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 1200)
    });
    return;
  }

  const center = getModelCenterLonLat();
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(center.lon, center.lat, getModelCenterHeight() + 900),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-55),
      roll: 0
    }
  });
}

function getFloodHierarchy() {
  const pad = 80;
  const points = [
    localToLonLat(MODEL_BOUNDS.minX - pad, MODEL_BOUNDS.minY - pad),
    localToLonLat(MODEL_BOUNDS.maxX + pad, MODEL_BOUNDS.minY - pad),
    localToLonLat(MODEL_BOUNDS.maxX + pad, MODEL_BOUNDS.maxY + pad),
    localToLonLat(MODEL_BOUNDS.minX - pad, MODEL_BOUNDS.maxY + pad)
  ];
  return new Cesium.PolygonHierarchy(
    Cesium.Cartesian3.fromDegreesArray(points.flatMap((point) => [point.lon, point.lat]))
  );
}

function getFloodAbsoluteHeight() {
  return SRS_ORIGIN.height + state.georef.offsetHeight + state.flood.level;
}

function getFloodMaterialColor() {
  return Cesium.Color.fromCssColorString("#21a8e8").withAlpha(state.flood.opacity);
}

function createFloodLayer() {
  floodEntity = viewer.entities.add({
    name: "动态洪水淹没水面",
    show: state.flood.visible,
    polygon: {
      hierarchy: new Cesium.CallbackProperty(getFloodHierarchy, false),
      height: new Cesium.CallbackProperty(getFloodAbsoluteHeight, false),
      material: new Cesium.ColorMaterialProperty(
        new Cesium.CallbackProperty(getFloodMaterialColor, false)
      ),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#b9f2ff"),
      outlineWidth: 2
    }
  });
}

function updateFloodReadout() {
  if (!state.flood.visible) {
    elements.floodReadout.textContent = "洪水层未开启";
  } else {
    const absoluteElevation = getFloodAbsoluteHeight();
    const remainingSeconds = state.flood.speed > 0 ? Math.max(0, (state.flood.target - state.flood.level) / state.flood.speed) : 0;
    elements.floodReadout.textContent =
      `绝对高程 ${absoluteElevation.toFixed(1)} m | ` +
      `目标 ${state.flood.target.toFixed(1)} m | ` +
      `预计 ${remainingSeconds.toFixed(1)} s`;
  }
  elements.floodLevel.value = state.flood.level.toFixed(1);
  elements.floodSpeed.value = state.flood.speed.toFixed(1);
  elements.floodLevelValue.textContent = `${state.flood.level.toFixed(1)} m`;
  elements.floodSpeedValue.textContent = `${state.flood.speed.toFixed(1)} m/s`;
}

function setFloodLevel(level) {
  state.flood.level = Math.min(Math.max(level, MODEL_BOUNDS.minZ), 56);
  updateFloodReadout();
}

function setFloodScenario(name) {
  const scenario = FLOOD_SCENARIOS[name];
  state.flood.target = scenario.target;
  state.flood.speed = scenario.speed;
  updateFloodReadout();
}

function showFloodLayer(visible) {
  state.flood.visible = visible;
  elements.floodToggle.checked = visible;
  if (floodEntity) {
    floodEntity.show = visible;
  }
  updateFloodReadout();
}

function toggleFloodPlayback() {
  if (!state.flood.visible) {
    showFloodLayer(true);
  }
  if (state.flood.playing) {
    state.flood.playing = false;
    elements.floodPlay.textContent = "播放上涨";
    return;
  }
  if (state.flood.level >= state.flood.target) {
    setFloodLevel(0);
  }
  state.flood.playing = true;
  elements.floodPlay.textContent = "暂停";
}

function resetFlood() {
  state.flood.playing = false;
  elements.floodPlay.textContent = "播放上涨";
  setFloodLevel(0);
}

function fitFlood() {
  showFloodLayer(true);
  if (floodEntity) {
    viewer.flyTo(floodEntity, {
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-50), 1400)
    });
  }
}

function tickFlood() {
  const now = performance.now();
  const deltaSeconds = Math.min((now - state.lastTickMs) / 1000, 0.25);
  state.lastTickMs = now;
  if (!state.flood.playing) {
    return;
  }

  const nextLevel = Math.min(state.flood.target, state.flood.level + state.flood.speed * deltaSeconds);
  setFloodLevel(nextLevel);
  if (nextLevel >= state.flood.target) {
    state.flood.playing = false;
    elements.floodPlay.textContent = "播放上涨";
  }
}

function bindEvents() {
  elements.flyModel.addEventListener("click", flyToModelArea);
  elements.floodToggle.addEventListener("change", () => showFloodLayer(elements.floodToggle.checked));
  elements.floodScenario.addEventListener("change", () => setFloodScenario(elements.floodScenario.value));
  elements.floodPlay.addEventListener("click", toggleFloodPlayback);
  elements.floodReset.addEventListener("click", resetFlood);
  elements.fitFlood.addEventListener("click", fitFlood);
  elements.floodLevel.addEventListener("input", () => {
    state.flood.playing = false;
    elements.floodPlay.textContent = "播放上涨";
    showFloodLayer(true);
    setFloodLevel(Number(elements.floodLevel.value));
  });
  elements.floodSpeed.addEventListener("input", () => {
    state.flood.speed = Number(elements.floodSpeed.value);
    updateFloodReadout();
  });
  elements.floodOpacity.addEventListener("input", () => {
    state.flood.opacity = Number(elements.floodOpacity.value);
    updateFloodReadout();
  });
}

function initFloodDefaults() {
  state.flood.opacity = Number(elements.floodOpacity.value);
  setFloodScenario(elements.floodScenario.value);
  setFloodLevel(Number(elements.floodLevel.value));
  showFloodLayer(false);
  createFloodLayer();
}

async function init() {
  bindEvents();
  initFloodDefaults();
  viewer.scene.preRender.addEventListener(tickFlood);
  await loadIonTileset();
}

init();
