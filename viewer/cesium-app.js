const ION_ASSET_ID = 5008047;
// const ION_ASSET_ID = 5007907;
const ION_TOKEN_STORAGE_KEY = "lankengCesiumIonToken";

function getIonAccessToken() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("ionToken");
  if (urlToken && urlToken.trim()) {
    const token = urlToken.trim();
    localStorage.setItem(ION_TOKEN_STORAGE_KEY, token);
    window.history.replaceState({}, document.title, window.location.pathname);
    return token;
  }

  const storedToken = localStorage.getItem(ION_TOKEN_STORAGE_KEY);
  if (storedToken && storedToken.trim()) {
    return storedToken.trim();
  }

  const enteredToken = window.prompt("请输入 Cesium ion access token。建议使用只读、限制域名的 token。", "");
  if (enteredToken && enteredToken.trim()) {
    const token = enteredToken.trim();
    localStorage.setItem(ION_TOKEN_STORAGE_KEY, token);
    return token;
  }

  return "";
}

const ION_ACCESS_TOKEN = getIonAccessToken();

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
    visible: true
  },
  lastTickMs: performance.now()
};

const elements = {
  status: document.querySelector("#load-state"),
  flyModel: document.querySelector("#fly-model"),
  resetLocation: document.querySelector("#reset-location"),
  calibrateHeight: document.querySelector("#calibrate-height"),
  offsetEast: document.querySelector("#offset-east"),
  offsetNorth: document.querySelector("#offset-north"),
  offsetHeight: document.querySelector("#offset-height"),
  heading: document.querySelector("#heading"),
  scale: document.querySelector("#scale"),
  offsetEastValue: document.querySelector("#offset-east-value"),
  offsetNorthValue: document.querySelector("#offset-north-value"),
  offsetHeightValue: document.querySelector("#offset-height-value"),
  headingValue: document.querySelector("#heading-value"),
  scaleValue: document.querySelector("#scale-value"),
  locationReadout: document.querySelector("#location-readout"),
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

if (ION_ACCESS_TOKEN) {
  Cesium.Ion.defaultAccessToken = ION_ACCESS_TOKEN;
}

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: ION_ACCESS_TOKEN
    ? Cesium.Terrain.fromWorldTerrain({ requestWaterMask: true, requestVertexNormals: true })
    : new Cesium.EllipsoidTerrainProvider(),
  animation: false,
  timeline: false,
  geocoder: true,
  homeButton: true,
  sceneModePicker: true,
  baseLayerPicker: true,
  navigationHelpButton: false,
  fullscreenButton: true,
  infoBox: false,
  selectionIndicator: false,
  shouldAnimate: true
});

viewer.scene.globe.depthTestAgainstTerrain = true;
viewer.scene.skyAtmosphere.show = true;
viewer.scene.fog.enabled = true;

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

function updateLocationControlsFromState() {
  elements.offsetEast.value = state.georef.offsetEast;
  elements.offsetNorth.value = state.georef.offsetNorth;
  elements.offsetHeight.value = state.georef.offsetHeight;
  elements.heading.value = state.georef.heading;
  elements.scale.value = state.georef.scale;
  elements.offsetEastValue.textContent = `${state.georef.offsetEast.toFixed(0)} m`;
  elements.offsetNorthValue.textContent = `${state.georef.offsetNorth.toFixed(0)} m`;
  elements.offsetHeightValue.textContent = `${state.georef.offsetHeight.toFixed(1)} m`;
  elements.headingValue.textContent = `${state.georef.heading.toFixed(1)}°`;
  elements.scaleValue.textContent = state.georef.scale.toFixed(2);

  const origin = getOriginLonLat();
  const center = getModelCenterLonLat();
  elements.locationReadout.textContent =
    `原点 ${origin.lon.toFixed(6)}, ${origin.lat.toFixed(6)} | ` +
    `中心 ${center.lon.toFixed(6)}, ${center.lat.toFixed(6)} | ` +
    `高程 ${getModelCenterHeight().toFixed(1)} m`;
}

function applyTilesetTransform() {
  updateLocationControlsFromState();
  if (tileset) {
    tileset.modelMatrix = buildModelMatrix();
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
    tileset.show = true;
    viewer.scene.primitives.add(tileset);
    setStatus("模型完成");
    await viewer.zoomTo(tileset, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 1200));
  } catch (error) {
    console.error(error);
    setStatus("模型错误");
    flyToModelArea();
  } finally {
    elements.flyModel.disabled = false;
  }
}


function getLowestPointLonLat() {
  return localToLonLat(LOWEST_MODEL_POINT.x, LOWEST_MODEL_POINT.y);
}

async function calibrateHeightToTerrain() {
  setStatus("校准高程");
  elements.calibrateHeight.disabled = true;
  try {
    const lowestPoint = getLowestPointLonLat();
    const positions = [Cesium.Cartographic.fromDegrees(lowestPoint.lon, lowestPoint.lat)];
    const sampled = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
    const terrainHeight = sampled[0]?.height;
    if (!Number.isFinite(terrainHeight)) {
      throw new Error("terrain height unavailable");
    }
    const modelLowestHeight = SRS_ORIGIN.height + LOWEST_MODEL_POINT.z;
    state.georef.offsetHeight = terrainHeight - modelLowestHeight;
    applyTilesetTransform();
    updateFloodReadout();
    setStatus(`高程校准 ${state.georef.offsetHeight.toFixed(1)}m`);
  } catch (error) {
    console.error(error);
    setStatus("校准失败");
  } finally {
    elements.calibrateHeight.disabled = false;
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

function resetLocation() {
  state.georef.offsetEast = 0;
  state.georef.offsetNorth = 0;
  state.georef.offsetHeight = 0;
  state.georef.heading = 0;
  state.georef.scale = 1;
  applyTilesetTransform();
  flyToModelArea();
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
  return Cesium.Color.fromCssColorString("#24a7df").withAlpha(state.flood.opacity);
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
  const absoluteElevation = getFloodAbsoluteHeight();
  const remainingSeconds = state.flood.speed > 0 ? Math.max(0, (state.flood.target - state.flood.level) / state.flood.speed) : 0;
  elements.floodLevel.value = state.flood.level.toFixed(1);
  elements.floodSpeed.value = state.flood.speed.toFixed(1);
  elements.floodLevelValue.textContent = `${state.flood.level.toFixed(1)} m`;
  elements.floodSpeedValue.textContent = `${state.flood.speed.toFixed(1)} m/s`;
  elements.floodReadout.textContent =
    `绝对高程 ${absoluteElevation.toFixed(1)} m | ` +
    `目标 ${state.flood.target.toFixed(1)} m | ` +
    `预计 ${remainingSeconds.toFixed(1)} s`;
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

function toggleFloodPlayback() {
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
  elements.resetLocation.addEventListener("click", resetLocation);
  elements.calibrateHeight.addEventListener("click", calibrateHeightToTerrain);

  elements.offsetEast.addEventListener("input", () => {
    state.georef.offsetEast = Number(elements.offsetEast.value);
    applyTilesetTransform();
  });
  elements.offsetNorth.addEventListener("input", () => {
    state.georef.offsetNorth = Number(elements.offsetNorth.value);
    applyTilesetTransform();
  });
  elements.offsetHeight.addEventListener("input", () => {
    state.georef.offsetHeight = Number(elements.offsetHeight.value);
    applyTilesetTransform();
    updateFloodReadout();
  });
  elements.heading.addEventListener("input", () => {
    state.georef.heading = Number(elements.heading.value);
    applyTilesetTransform();
  });
  elements.scale.addEventListener("input", () => {
    state.georef.scale = Number(elements.scale.value);
    applyTilesetTransform();
  });

  elements.floodToggle.addEventListener("change", () => {
    state.flood.visible = elements.floodToggle.checked;
    if (floodEntity) {
      floodEntity.show = state.flood.visible;
    }
  });
  elements.floodScenario.addEventListener("change", () => setFloodScenario(elements.floodScenario.value));
  elements.floodPlay.addEventListener("click", toggleFloodPlayback);
  elements.floodReset.addEventListener("click", resetFlood);
  elements.fitFlood.addEventListener("click", fitFlood);
  elements.floodLevel.addEventListener("input", () => {
    state.flood.playing = false;
    elements.floodPlay.textContent = "播放上涨";
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
  createFloodLayer();
}

async function init() {
  if (!window.Cesium) {
    setStatus("Cesium 未加载");
    return;
  }
  if (!ION_ACCESS_TOKEN) {
    setStatus("缺少 token");
    return;
  }
  bindEvents();
  updateLocationControlsFromState();
  initFloodDefaults();
  viewer.scene.preRender.addEventListener(tickFlood);
  await loadIonTileset();
}

init();



