import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const app = document.getElementById("app");

const logBox = document.createElement("div");
logBox.style.position = "absolute";
logBox.style.left = "16px";
logBox.style.top = "16px";
logBox.style.maxWidth = "45vw";
logBox.style.padding = "8px 10px";
logBox.style.fontSize = "12px";
logBox.style.color = "#ffb4b4";
logBox.style.background = "rgba(60,0,0,0.45)";
logBox.style.border = "1px solid rgba(255,120,120,0.35)";
logBox.style.borderRadius = "8px";
logBox.style.zIndex = "20";
logBox.style.display = "none";
document.body.appendChild(logBox);

function showError(msg) {
  logBox.style.display = "block";
  logBox.textContent = `Runtime Error: ${msg}`;
}

window.addEventListener("error", (e) => showError(e.message || "unknown error"));
window.addEventListener("unhandledrejection", (e) => showError(String(e.reason || "promise rejected")));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x020202, 1);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);

// 相机：更小 FOV + 斜视初始位姿，贴近 Cybermap 低轨道视角
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 23.5, 25.5);
camera.lookAt(0, 7.4, 0.08);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 7.4, 0.08);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
// 需要允许有限平移，否则 OrbitControls 只能绕固定 target 旋转，无法把北半球顶部圆心拉到画面中。
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.panSpeed = 0.38;
controls.minDistance = 16.5;
controls.maxDistance = 40;
// 放宽上仰角：phi 越小越靠近北极方向，允许真正看向北半球顶部圆心。
controls.minPolarAngle = THREE.MathUtils.degToRad(6);
controls.maxPolarAngle = THREE.MathUtils.degToRad(78);
controls.rotateSpeed = 0.62;

const orbitCenter = new THREE.Vector3(0, 0, 0);
const orbitEquatorAnchor = new THREE.Vector3(0, 7.4, 0.08); // target 接近北半球顶部圆心，避免只锁在赤道/中纬度
const orbitFramingHeadroomOffset = new THREE.Vector3(0, 0.0, 0.0); // 不再把 target 往下拉，避免顶部被推出画面
const orbitTmpOffset = new THREE.Vector3();
const orbitTmpSurface = new THREE.Vector3();
const orbitTmpDesiredPos = new THREE.Vector3();
const orbitTmpSpherical = new THREE.Spherical();
let orbitSnapInitialized = false;

function updateConstrainedOrbitCamera(forceSnapNorth = false) {
  // 关键修正：这里只做“初始对准 + 越界保护”，不要每帧强行重写 controls.target。
  // 否则用户永远拖不到北半球顶部圆心点。
  if (forceSnapNorth || !orbitSnapInitialized) {
    controls.target.copy(orbitEquatorAnchor).add(orbitFramingHeadroomOffset);
    camera.position.set(0, 23.5, 25.5);
    camera.lookAt(controls.target);
    orbitSnapInitialized = true;
  }

  const dist = camera.position.distanceTo(controls.target);
  const zoomT = THREE.MathUtils.clamp(
    (controls.maxDistance - dist) / Math.max(1e-6, controls.maxDistance - controls.minDistance),
    0,
    1,
  );

  // 近距离时也允许上看北半球顶部，但避免完全翻到俯视平面。
  controls.minPolarAngle = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(6, 10, zoomT));
  controls.maxPolarAngle = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(78, 68, zoomT));

  // 允许有限 pan，但把 target 限制在球体附近，防止拖飞。
  // 关键：y 上限必须接近 globeRadius，否则永远无法把 target 拉到北半球顶部圆心。
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -globeRadius * 0.48, globeRadius * 0.48);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, -globeRadius * 0.18, globeRadius * 1.04);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -globeRadius * 0.42, globeRadius * 0.58);

  // 只在距离/角度越界时修正相机位置，不改变用户当前 target。
  orbitTmpOffset.copy(camera.position).sub(controls.target);
  orbitTmpSpherical.setFromVector3(orbitTmpOffset);
  orbitTmpSpherical.radius = THREE.MathUtils.clamp(orbitTmpSpherical.radius, controls.minDistance, controls.maxDistance);
  orbitTmpSpherical.phi = THREE.MathUtils.clamp(orbitTmpSpherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
  orbitTmpDesiredPos.setFromSpherical(orbitTmpSpherical).add(controls.target);
  camera.position.lerp(orbitTmpDesiredPos, 0.16);

  // 北半球顶部可见保护：相机必须比 target 更高，避免继续贴地平线。
  const minCameraY = controls.target.y + globeRadius * THREE.MathUtils.lerp(0.62, 0.78, zoomT);
  if (camera.position.y < minCameraY) {
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, minCameraY, 0.18);
  }

  camera.lookAt(controls.target);
}

renderer.domElement.addEventListener(
  "wheel",
  () => {
    updateConstrainedOrbitCamera(false);
  },
  { passive: true },
);
controls.addEventListener("change", () => updateConstrainedOrbitCamera(false));

const ambient = new THREE.AmbientLight(0x330000, 0.4);
scene.add(ambient);
const globeRadius = 9.0;
const globeMesh = new THREE.Mesh(
  new THREE.SphereGeometry(globeRadius, 64, 32),
  new THREE.MeshBasicMaterial({
    color: 0x143846,
    transparent: true,
    opacity: 0.22,
    wireframe: true,
  }),
);
globeMesh.visible = false;
scene.add(globeMesh);
updateConstrainedOrbitCamera(true);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.35, 0.1);
bloomPass.strength = 1.6;
bloomPass.radius = 0.28;
bloomPass.threshold = 0.02;
composer.addPass(bloomPass);

const ui = {
  maxWidth: document.getElementById("maxWidth"),
  brightness: document.getElementById("brightness"),
  travelTime: document.getElementById("travelTime"),
  pulseSpeed: document.getElementById("pulseSpeed"),
  pulseHeight: document.getElementById("pulseHeight"),
  pulseFrequency: document.getElementById("pulseFrequency"),
  gridCount: document.getElementById("gridCount"),
  gridSize: document.getElementById("gridSize"),
  cycleGridDarken: document.getElementById("cycleGridDarken"),
  cycleTrailLength: document.getElementById("cycleTrailLength"),
  curveHeight: document.getElementById("curveHeight"),
  segments: document.getElementById("segments"),
  color: document.getElementById("color"),
  pointBrightness: document.getElementById("pointBrightness"),
  pointCoreSize: document.getElementById("pointCoreSize"),
  globeMode: document.getElementById("globeMode"),
  maxWidthValue: document.getElementById("maxWidthValue"),
  brightnessValue: document.getElementById("brightnessValue"),
  travelTimeValue: document.getElementById("travelTimeValue"),
  pulseSpeedValue: document.getElementById("pulseSpeedValue"),
  pulseHeightValue: document.getElementById("pulseHeightValue"),
  pulseFrequencyValue: document.getElementById("pulseFrequencyValue"),
  gridCountValue: document.getElementById("gridCountValue"),
  gridSizeValue: document.getElementById("gridSizeValue"),
  gridDarkenValue: document.getElementById("gridDarkenValue"),
  trailLengthValue: document.getElementById("trailLengthValue"),
  curveHeightValue: document.getElementById("curveHeightValue"),
  segmentsValue: document.getElementById("segmentsValue"),
  pointBrightnessValue: document.getElementById("pointBrightnessValue"),
  pointCoreSizeValue: document.getElementById("pointCoreSizeValue"),
  applyFixedPreset: document.getElementById("applyFixedPreset"),
  togglePulseMode: document.getElementById("togglePulseMode"),
};

const detectionTypeColors = {
  1: "#38b349", // OAS
  2: "#ed1c24", // ODS
  3: "#f26522", // MAV
  4: "#0087f4", // WAV
  5: "#ec008c", // IDS
  6: "#fbf267", // VUL
  7: "#855ff4", // KAS
  9: "#0000ff", // RMW
};

const basePresets = [
  {
    detectionType: 1,
    start: new THREE.Vector3(-9, -2.4, -2),
    end: new THREE.Vector3(9.5, 2.0, 1.5),
    sideOffset: new THREE.Vector3(0, 0, 1.2),
    widthScale: 1.0,
    heightScale: 1.0,
    phase: 0.0,
    trail: 0.24,
  },
  {
    detectionType: 2,
    start: new THREE.Vector3(-11, 1.4, 1.3),
    end: new THREE.Vector3(7.8, -1.2, -0.8),
    sideOffset: new THREE.Vector3(0, 0, -1.5),
    widthScale: 0.75,
    heightScale: 0.8,
    phase: 0.33,
    trail: 0.2,
  },
  {
    detectionType: 3,
    start: new THREE.Vector3(-8, 3.4, -1.0),
    end: new THREE.Vector3(10.8, -3.3, 0.3),
    sideOffset: new THREE.Vector3(0, 0, 1.0),
    widthScale: 1.35,
    heightScale: 1.2,
    phase: 0.66,
    trail: 0.28,
  },
  {
    detectionType: 4,
    start: new THREE.Vector3(-10.5, 0.1, -3.2),
    end: new THREE.Vector3(8.8, 3.7, -1.2),
    sideOffset: new THREE.Vector3(0, 0, 1.7),
    widthScale: 0.95,
    heightScale: 1.15,
    phase: 0.12,
    trail: 0.21,
  },
  {
    detectionType: 5,
    start: new THREE.Vector3(-6.7, -3.5, 1.8),
    end: new THREE.Vector3(10.4, 1.8, -2.2),
    sideOffset: new THREE.Vector3(0, 0, -1.4),
    widthScale: 1.1,
    heightScale: 0.9,
    phase: 0.45,
    trail: 0.24,
  },
  {
    detectionType: 6,
    start: new THREE.Vector3(-10.8, 2.8, 2.6),
    end: new THREE.Vector3(6.9, -2.5, 2.2),
    sideOffset: new THREE.Vector3(0, 0, 1.1),
    widthScale: 0.7,
    heightScale: 0.75,
    phase: 0.78,
    trail: 0.19,
  },
  {
    detectionType: 7,
    start: new THREE.Vector3(-9.4, -2.9, 2.4),
    end: new THREE.Vector3(9.1, 2.9, -1.0),
    sideOffset: new THREE.Vector3(0, 0, -1.2),
    widthScale: 0.95,
    heightScale: 1.05,
    phase: 0.25,
    trail: 0.22,
  },
  {
    detectionType: 9,
    start: new THREE.Vector3(-10.2, 1.7, -2.8),
    end: new THREE.Vector3(7.6, -3.1, 2.3),
    sideOffset: new THREE.Vector3(0, 0, 1.4),
    widthScale: 0.8,
    heightScale: 0.9,
    phase: 0.58,
    trail: 0.26,
  },
];

const attackRouteConfig = {
  singleOriginMode: true,
  originLat: 40.7128, // New York
  originLon: -74.006,
  originJitterDeg: 1.1,
};

function latLonToVector3(latDeg, lonDeg, radius = globeRadius) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const x = radius * Math.cos(lat) * Math.sin(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.cos(lon);
  return new THREE.Vector3(x, y, z);
}

function seededRand01(seed) {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return s - Math.floor(s);
}

function buildSingleOriginPresets(count) {
  const types = Object.keys(detectionTypeColors).map((k) => Number(k));
  const presets = [];
  for (let i = 0; i < count; i++) {
    const jitterLat = (seededRand01(i * 3 + 1) * 2 - 1) * attackRouteConfig.originJitterDeg;
    const jitterLon = (seededRand01(i * 3 + 2) * 2 - 1) * attackRouteConfig.originJitterDeg;
    const start = latLonToVector3(
      attackRouteConfig.originLat + jitterLat,
      attackRouteConfig.originLon + jitterLon,
      globeRadius,
    );

    const endLat = seededRand01(i * 7 + 13) * 150 - 75; // 避开极点
    const endLon = seededRand01(i * 7 + 17) * 360 - 180;
    const end = latLonToVector3(endLat, endLon, globeRadius);

    presets.push({
      detectionType: types[i % types.length],
      start,
      end,
      sideOffset: new THREE.Vector3(0, 0, (seededRand01(i * 5 + 23) * 2 - 1) * 1.5),
      widthScale: 0.78 + seededRand01(i * 5 + 29) * 0.32,
      heightScale: 0.82 + seededRand01(i * 5 + 31) * 0.36,
      phase: seededRand01(i * 11 + 37),
      trail: 0.18 + seededRand01(i * 11 + 41) * 0.1,
    });
  }
  return presets;
}

const runtimePresets = attackRouteConfig.singleOriginMode
  ? buildSingleOriginPresets(basePresets.length)
  : basePresets;

const ribbons = [];
const endpointMarkers = [];
const aPulseSystems = [];
const aGroundGridSystems = [];
const bPulseSystems = [];
const bGroundGridSystems = [];

// =========================
// 轨迹渲染 Shader（轨迹 + 彗星透明基础）
// - aProgress: 顶点在整条轨迹中的进度 [0,1]
// - vAlpha: 使用 sin(PI*t) 让轨迹两端透明、中间更亮
// =========================
const vertexShader = `
  attribute float aProgress;
  varying float vProgress;
  varying float vAlpha;
  void main() {
    vProgress = aProgress;
    vAlpha = sin(3.14159265 * aProgress);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// =========================
// 彗星头部 + 拖尾核心实现（在轨迹带上移动）
// - uHead: 当前彗星头部在轨迹上的位置进度
// - uTrail: 拖尾长度
// - trailMask + headGlow: 组合成“头亮尾衰减”的彗星视觉
// =========================
const fragmentShader = `
  uniform vec3 uColor;
  uniform float uBrightness;
  uniform float uHead;
  uniform float uTrail;
  uniform float uAlphaMul;
  varying float vProgress;
  varying float vAlpha;
  void main() {
    float centerBoost = pow(sin(3.14159265 * vProgress), 1.45);
    float alphaProfile = clamp(vAlpha, 0.0, 1.0);
    float trailDist = uHead - vProgress;
    if (trailDist < 0.0) trailDist += 1.0;
    float trailMask = 1.0 - smoothstep(0.0, uTrail, trailDist);
    float headGlow = exp(-trailDist * 24.0);
    float alpha = alphaProfile * max(trailMask, headGlow * 0.95);
    vec3 color = uColor * (0.35 + uBrightness * (centerBoost * trailMask + headGlow));
    gl_FragColor = vec4(color, alpha * uAlphaMul);
  }
`;

function formatValue(value, digits = 2) {
  return Number(value).toFixed(digits);
}

// 底部 A 点井字特效：颜色加深系数（0~1 越小越深）
let gridDarkenIndex = 2;
const gridDarkenSteps = [1.0, 0.85, 0.7, 0.55, 0.42];
// 固定可调参数（按你的需求：直接改数值）
const FIXED_TRAIL_LENGTH_PERCENT = 145; // 彗星尾巴长度固定值（百分比）
const FIXED_GLOBE_ARC_HEIGHT = 2.8; // 球面飞行离地峰值高度（世界单位）
let trailLengthIndex = 0;
const trailLengthSteps = [FIXED_TRAIL_LENGTH_PERCENT / 100];

function getGridDarkenFactor() {
  return gridDarkenSteps[Math.max(0, Math.min(gridDarkenSteps.length - 1, gridDarkenIndex))];
}

function getTrailLengthFactor() {
  return trailLengthSteps[Math.max(0, Math.min(trailLengthSteps.length - 1, trailLengthIndex))];
}

function multiplyHexColor(hex, factor) {
  // 用 HSL 降亮度 + 轻微提饱和，让“加深”更像深色能量线而不是发灰
  const f = Math.max(0, Math.min(1, Number(factor)));
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const darkStrength = 1 - f;
  hsl.l = Math.max(0.04, hsl.l * (1 - darkStrength * 0.78));
  hsl.s = Math.min(1, hsl.s + darkStrength * 0.18);
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return `#${c.getHexString()}`;
}

function updateLabels() {
  ui.maxWidthValue.textContent = formatValue(ui.maxWidth.value, 2);
  ui.brightnessValue.textContent = formatValue(ui.brightness.value, 2);
  ui.travelTimeValue.textContent = `${formatValue(ui.travelTime.value, 1)}s`;
  ui.pulseSpeedValue.textContent = `${formatValue(ui.pulseSpeed.value, 1)}x`;
  ui.pulseHeightValue.textContent = formatValue(ui.pulseHeight.value, 1);
  ui.pulseFrequencyValue.textContent = `${formatValue(ui.pulseFrequency.value, 1)}Hz`;
  ui.gridCountValue.textContent = String(ui.gridCount.value);
  ui.gridSizeValue.textContent = formatValue(ui.gridSize.value, 1);
  ui.gridDarkenValue.textContent = `${Math.round(getGridDarkenFactor() * 100)}%`;
  ui.trailLengthValue.textContent = `${Math.round(getTrailLengthFactor() * 100)}%`;
  ui.pointBrightnessValue.textContent = formatValue(ui.pointBrightness.value, 1);
  ui.pointCoreSizeValue.textContent = formatValue(ui.pointCoreSize.value, 2);
  ui.curveHeightValue.textContent = formatValue(ui.curveHeight.value, 1);
  ui.segmentsValue.textContent = String(ui.segments.value);
}

function buildCurve(start, end, height, sideOffset, segments) {
  if (ui.globeMode.checked) {
    const aDir = start.clone().normalize();
    const bDir = end.clone().normalize();
    if (aDir.dot(bDir) > 0.9995) {
      // 几乎同方向时，为避免切线退化，用一个很小的旋转生成曲线点
      const axis = new THREE.Vector3(0, 1, 0).cross(aDir).normalize();
      if (axis.lengthSq() < 1e-6) {
        axis.set(1, 0, 0).cross(aDir).normalize();
      }
      const eps = 0.08; // 小角度
      const p0 = aDir.clone().multiplyScalar(globeRadius);
      const p1 = aDir.clone().applyAxisAngle(axis, eps * 0.5).multiplyScalar(globeRadius);
      const p2 = bDir.clone().multiplyScalar(globeRadius);
      return new THREE.CatmullRomCurve3([p0, p1, p2], false);
    }

    // Vector3.slerp 在某些 three 版本中不存在，因此这里手写球面插值
    // - aDir/bDir: 归一化方向向量
    // - t: [0,1]
    function slerpDir(a, b, t) {
      const dot = Math.min(1, Math.max(-1, a.dot(b)));
      const omega = Math.acos(dot);
      if (omega < 1e-5) return a.clone();
      const sinOmega = Math.sin(omega);
      const s1 = Math.sin((1 - t) * omega) / sinOmega;
      const s2 = Math.sin(t * omega) / sinOmega;
      return a.clone().multiplyScalar(s1).add(b.clone().multiplyScalar(s2));
    }

    const pts = [];
    const count = Math.max(24, segments);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const dir = slerpDir(aDir, bDir, t).normalize();
      // 固定离地高度：中段最高，端点回落到球面（可直接改 FIXED_GLOBE_ARC_HEIGHT）
      const arcLift = Math.sin(Math.PI * t) * FIXED_GLOBE_ARC_HEIGHT;
      pts.push(dir.multiplyScalar(globeRadius + arcLift));
    }
    return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.05);
  }

  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3().subVectors(end, start).normalize();
  const side = new THREE.Vector3().crossVectors(dir, up).normalize();

  const controlA = start.clone()
    .lerp(mid, 0.5)
    .add(up.clone().multiplyScalar(height))
    .add(side.clone().multiplyScalar(sideOffset.z))
    .add(sideOffset.clone().setY(sideOffset.y).setZ(0));

  const controlB = end.clone()
    .lerp(mid, 0.5)
    .add(up.clone().multiplyScalar(height * 0.8))
    .add(side.clone().multiplyScalar(-sideOffset.z))
    .add(sideOffset.clone().setY(sideOffset.y).setZ(0));

  return new THREE.CubicBezierCurve3(start.clone(), controlA, controlB, end.clone());
}

// =========================
// 轨迹几何核心实现（不是 THREE.Line）
// 手动构建 BufferGeometry 带状网格：
// 1) 沿曲线采样 points
// 2) 每个采样点生成 left/right 两个顶点
// 3) 相邻采样点拼接成两个三角形
// 4) width = maxWidth * sin(PI*t)
// =========================
function createRibbonGeometry(curve, segments, maxWidth) {
  const points = curve.getPoints(segments);
  const vertCount = points.length * 2;
  const positions = new Float32Array(vertCount * 3);
  const progress = new Float32Array(vertCount);
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  const fallback = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i < points.length; i++) {
    const t = i / (points.length - 1);
    const p = points[i];

    let tangent;
    if (ui.globeMode.checked) {
      // 球面模式：用相邻点差分估计切线，并投影到切平面，确保 side = normal x tangent 可靠
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      tangent = next.clone().sub(prev);
      const normalForTangent = p.clone().normalize();
      // 去掉法线分量，得到切平面内切向量
      tangent.sub(normalForTangent.clone().multiplyScalar(tangent.dot(normalForTangent)));
      tangent = tangent.normalize();
    } else {
      tangent = curve.getTangent(Math.min(1, Math.max(0, t))).normalize();
    }

    let side;
    if (ui.globeMode.checked) {
      // 球面贴合：左右偏移方向必须在“球体切平面”内
      // - normal: 球心指向当前点（球面法线）
      // - side: 在切平面内，且与切线正交（side = normal x tangent）
      const normal = p.clone().normalize();
      side = new THREE.Vector3().crossVectors(normal, tangent).normalize();
      if (side.lengthSq() < 1e-6) {
        side = new THREE.Vector3().crossVectors(fallback, tangent).normalize();
      }
    } else {
      // 自由空间模式：使用世界 up 生成横向侧向量
      side = new THREE.Vector3().crossVectors(up, tangent).normalize();
      if (side.lengthSq() < 1e-6) {
        side = new THREE.Vector3().crossVectors(fallback, tangent).normalize();
      }
    }

    // width = maxWidth * sin(PI*t) * 0.72: 两头细，中段更细（maxWidth=0.12 时也更收敛）
    const width = maxWidth * Math.sin(Math.PI * t) * 0.3;
    let left = p.clone().addScaledVector(side, width);
    let right = p.clone().addScaledVector(side, -width);

    // 球面模式：投影回“当前轨迹半径层”（而不是固定 globeRadius），保持离地高度
    if (ui.globeMode.checked) {
      const radiusAtPoint = p.length();
      left.normalize().multiplyScalar(radiusAtPoint);
      right.normalize().multiplyScalar(radiusAtPoint);
    }

    const li = i * 2;
    const ri = i * 2 + 1;

    positions[li * 3 + 0] = left.x;
    positions[li * 3 + 1] = left.y;
    positions[li * 3 + 2] = left.z;
    positions[ri * 3 + 0] = right.x;
    positions[ri * 3 + 1] = right.y;
    positions[ri * 3 + 2] = right.z;

    progress[li] = t;
    progress[ri] = t;

    if (i < points.length - 1) {
      const nli = (i + 1) * 2;
      const nri = (i + 1) * 2 + 1;
      indices.push(li, ri, nli);
      indices.push(ri, nri, nli);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aProgress", new THREE.BufferAttribute(progress, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

// 轨迹 Mesh 组装：把“轨迹几何 + 彗星Shader材质”组合在一起
function createRibbonMesh({ start, end, sideOffset, widthScale, heightScale, phase, trail, detectionType }) {
  const segments = Number(ui.segments.value);
  const maxWidth = Number(ui.maxWidth.value) * widthScale;
  const curveHeight = Number(ui.curveHeight.value) * heightScale;
  const colorHex = detectionTypeColors[detectionType] || ui.color.value;
  const color = new THREE.Color(colorHex);
  const brightness = Number(ui.brightness.value);

  const curve = buildCurve(start, end, curveHeight, sideOffset, segments);
  const geometry = createRibbonGeometry(curve, segments, maxWidth);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uBrightness: { value: brightness },
      uHead: { value: 0.0 },
      uTrail: { value: (trail ?? 0.22) * getTrailLengthFactor() },
      uAlphaMul: { value: 1.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.phase = phase ?? 0.0;
  mesh.userData.detectionType = detectionType;
  return mesh;
}

function resolveEndpointsOnMode(start, end) {
  if (!ui.globeMode.checked) {
    return { start: start.clone(), end: end.clone() };
  }
  return {
    start: start.clone().normalize().multiplyScalar(globeRadius),
    end: end.clone().normalize().multiplyScalar(globeRadius),
  };
}

// =========================
// 点位标签实现（A / B 字母）
// =========================
function createTextSprite(text, color = "#ffffff", brightness = 1.0) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 64px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // brightness 用于调节字的 alpha，避免 MeshBasicMaterial 不吃光照导致无法“变亮”
  const b = Math.max(0.0, Number(brightness));
  const alpha = Math.min(1.0, Math.max(0.0, b));
  // 把 hex 转成 rgb
  const hex = color.replace("#", "");
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
  const bl = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
  ctx.fillStyle = `rgba(${r},${g},${bl},${alpha})`;
  ctx.fillText(text, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  material.opacity = Math.min(1.0, Math.max(0.0, b));
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.8, 0.8, 0.8);
  return sprite;
}

// 贴球体表面的“对齐”实现：
// - 球心在 (0,0,0)，position 是球面点
// - 把 object 的本地法线（默认 +Z）旋转到该点的球面外法线方向
function alignToSphereSurface(object, position, fromNormalLocal = new THREE.Vector3(0, 0, 1)) {
  const normal = position.clone().normalize();
  const from = fromNormalLocal.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(from, normal);
  object.position.copy(position);
  object.quaternion.copy(quaternion);
}

// =========================
// 点位实现（A/B 点）
// - 核心小球 + 发光环 + 文本标签
// =========================
function createEndpointMarker(position, label, colorHex) {
  const group = new THREE.Group();
  const pointBrightness = Number(ui.pointBrightness.value);
  const coreRadius = Number(ui.pointCoreSize.value);

  const coreGeo = new THREE.SphereGeometry(coreRadius, 16, 16);
  const coreMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 1.0,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  // ring: 与 core 等比例缩放（减少“点本体变了但光环不跟着变”的违和感）
  const ringInner = coreRadius * 1.5;
  const ringOuter = coreRadius * 2.15;
  const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: Math.min(1.0, Math.max(0.0, 0.45 * pointBrightness)),
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  // globeMode: 环平面必须贴合球面切平面（法线=球心外法线）
  // 非 globeMode: 保持原来“水平环”的表现
  if (ui.globeMode.checked) {
    // 默认 RingGeometry 在 XY 平面（本地 +Z 为法线）
    group.add(ring);
    alignToSphereSurface(group, position, new THREE.Vector3(0, 0, 1));
  } else {
    ring.rotation.x = -Math.PI * 0.5;
    group.add(ring);
  }

  const text = createTextSprite(label, colorHex, pointBrightness);
  if (ui.globeMode.checked) {
    // 沿球面外法线方向偏移（局部 +Z）
    text.position.set(0, 0, coreRadius * 4.7);
  } else {
    text.position.set(0, coreRadius * 4.7, 0);
  }
  group.add(text);

  if (!ui.globeMode.checked) {
    group.position.copy(position);
  }
  // 随机点亮模式需要“从出现到最大辐射再淡出消失”，这里缓存基础透明度与材质引用
  group.userData.markerMats = { core: coreMat, ring: ringMat, sprite: text.material };
  group.userData.markerBaseOpacity = {
    core: 1.0,
    ring: ringMat.opacity,
    sprite: text.material.opacity,
  };
  return group;
}

// A点“分层轮廓光圈”几何：用于三角/多边形/星形等线框
function createPolygonLoopGeometry(radius = 0.55, sides = 3) {
  const points = [];
  const stepCount = Math.max(3, Math.floor(sides));
  for (let i = 0; i < stepCount; i++) {
    const a = (i / stepCount) * Math.PI * 2 - Math.PI / 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function createStarLoopGeometry(outerRadius = 0.55, innerRadius = 0.3, points = 5) {
  const pts = [];
  const p = Math.max(2, Math.floor(points));
  const total = p * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const a = (i / total) * Math.PI * 2 - Math.PI / 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function createRegularPolygonRingLines(outerRadius, innerRadius, sides, colorHex) {
  const lineMat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const innerMat = lineMat.clone();

  const outerLine = new THREE.LineLoop(createPolygonLoopGeometry(outerRadius, sides), lineMat);
  const innerLine = new THREE.LineLoop(createPolygonLoopGeometry(innerRadius, sides), innerMat);

  const ringGroup = new THREE.Group();
  ringGroup.add(outerLine, innerLine);
  ringGroup.userData.materials = [lineMat, innerMat];
  return ringGroup;
}

function createStarRingLines(outerRadius, innerRadius, points, colorHex) {
  const lineMat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const innerMat = lineMat.clone();

  const outerLine = new THREE.LineLoop(createStarLoopGeometry(outerRadius, innerRadius, points), lineMat);
  const innerLine = new THREE.LineLoop(createStarLoopGeometry(innerRadius, innerRadius * 0.6, points), innerMat);

  const ringGroup = new THREE.Group();
  ringGroup.add(outerLine, innerLine);
  ringGroup.userData.materials = [lineMat, innerMat];
  return ringGroup;
}

function createDetectionTypeRingLines(detectionType, outerRadius, innerRadius, colorHex) {
  // 按检测类型：颜色 + 不同形状轮廓
  switch (Number(detectionType)) {
    case 1: // OAS：三角
      return createRegularPolygonRingLines(outerRadius, innerRadius, 3, colorHex);
    case 2: // ODS：正方形
      return createRegularPolygonRingLines(outerRadius, innerRadius, 4, colorHex);
    case 3: // MAV：五边形
      return createRegularPolygonRingLines(outerRadius, innerRadius, 5, colorHex);
    case 4: // WAV：圆形近似（多边形）
      return createRegularPolygonRingLines(outerRadius, innerRadius, 18, colorHex);
    case 5: // IDS：五角星
      return createStarRingLines(outerRadius, innerRadius, 5, colorHex);
    case 6: // VUL：六边形
      return createRegularPolygonRingLines(outerRadius, innerRadius, 6, colorHex);
    case 7: // KAS：八边形
      return createRegularPolygonRingLines(outerRadius, innerRadius, 8, colorHex);
    case 9: // RMW：七边形
      return createRegularPolygonRingLines(outerRadius, innerRadius, 7, colorHex);
    default:
      return createRegularPolygonRingLines(outerRadius, innerRadius, 3, colorHex);
  }
}

// A点特效实现：向上(Y轴)喷射的分层轮廓脉冲系统
function createAPulseSystem(position, detectionType, primaryColorHex = "#ff4d3d") {
  const group = new THREE.Group();
  group.position.copy(position);
  // 非球体模式：稍微抬起；球体模式：沿球面法线推一点，避免脱离球面
  if (ui.globeMode.checked) {
    const n = position.clone().normalize();
    group.position.addScaledVector(n, 0.03);
    // LineLoop 默认在 XY 平面（本地 +Z 为法线），将 +Z 对齐到球面外法线
    alignToSphereSurface(group, group.position, new THREE.Vector3(0, 0, 1));
  } else {
    group.position.y += 0.03;
  }

  const pulseLayers = [];
  const layerCount = 6;
  const colorHex = new THREE.Color(primaryColorHex).getHex();

  for (let i = 0; i < layerCount; i++) {
    const ring = createDetectionTypeRingLines(detectionType, 0.55, 0.36, colorHex);
    ring.scale.setScalar(0.35);
    ring.rotation.z = i * 0.55;
    group.add(ring);

    pulseLayers.push({
      mesh: ring,
      offset: i / layerCount,
      spin: (i % 2 === 0 ? 1 : -1) * (0.35 + i * 0.05),
    });
  }

  return { group, pulseLayers, detectionType: Number(detectionType) };
}

// A点底部特效：地面网格脉冲（围绕点扩散）
function createAGroundGridSystem(position, detectionType, primaryColorHex = "#ff4d3d", count = 6, size = 2.8) {
  // 目标：井字形状 + 外发射（向外的波前）+ 逐渐消失
  // 做法：
  // 1) 在该点的“局部切平面”生成井字网格线段（两组正交直线）
  // 2) globeMode 下把采样点做“径向投影”贴到球面上
  // 3) 根据线段中点半径分层，让动画形成外发射波前
  const group = new THREE.Group();
  group.position.set(0, 0, 0);

  const normal = ui.globeMode.checked ? position.clone().normalize() : new THREE.Vector3(0, 1, 0);
  const center = position.clone();

  // 切平面基向量（U/V）
  const worldUp = new THREE.Vector3(0, 1, 0);
  let tangentU = new THREE.Vector3().crossVectors(normal, worldUp);
  if (tangentU.lengthSq() < 1e-6) tangentU = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(1, 0, 0));
  tangentU.normalize();
  const tangentV = new THREE.Vector3().crossVectors(normal, tangentU).normalize();

  const gridLines = Math.max(2, Math.floor(count));
  const samplesAlong = Math.max(14, gridLines * 4);
  const span = Math.max(0.3, size);

  const segments = []; // { a: Vector3, b: Vector3, rNorm: number }
  const projectPoint = (posPlane) => {
    let p = posPlane;
    if (ui.globeMode.checked) {
      // 径向投影到球面：球心(0,0,0) -> 方向 * globeRadius
      p = p.normalize().multiplyScalar(globeRadius);
    } else {
      // 平面模式：贴近局部“地面”，避免 z-fighting
      p = p.clone();
      p.y += -0.02;
    }
    return p;
  };

  const pushStripSegments = (fixedOffset, alongMax, dirAlong, dirOffset) => {
    let prevPos = null;
    let prevRNorm = 0;
    for (let s = 0; s <= samplesAlong; s++) {
      const along = -alongMax + (2 * alongMax * s) / samplesAlong;
      const r = Math.sqrt(along * along + fixedOffset * fixedOffset);
      const rNorm = r / span;
      const posPlane = center
        .clone()
        .add(dirAlong.clone().multiplyScalar(along))
        .add(dirOffset.clone().multiplyScalar(fixedOffset));
      const pos = projectPoint(posPlane);

      if (prevPos) {
        segments.push({
          a: prevPos,
          b: pos,
          rNorm: (prevRNorm + rNorm) * 0.5,
        });
      }
      prevPos = pos;
      prevRNorm = rNorm;
    }
  };

  // 方向1：沿 tangentU 的线，沿 tangentV 做偏移（在半径 circle 内取线段）
  for (let i = 0; i <= gridLines; i++) {
    const offsetV = -span + (2 * span * i) / gridLines;
    const under = Math.max(0, span * span - offsetV * offsetV);
    const alongUMax = Math.sqrt(under);
    pushStripSegments(offsetV, alongUMax, tangentU, tangentV);
  }

  // 方向2：沿 tangentV 的线，沿 tangentU 做偏移（在半径 circle 内取线段）
  for (let j = 0; j <= gridLines; j++) {
    const offsetU = -span + (2 * span * j) / gridLines;
    const under = Math.max(0, span * span - offsetU * offsetU);
    const alongVMax = Math.sqrt(under);
    pushStripSegments(offsetU, alongVMax, tangentV, tangentU);
  }

  const gridLayers = [];
  const layerCount = Math.max(2, Math.floor(count / 2));
  const eps = 0.035; // 给 band 一点宽度，避免空带

  // 按“切平面半径带”拆分多层，让动画从内向外出现（线段版）
  for (let i = 0; i < layerCount; i++) {
    const bandStart = i / layerCount;
    const bandEnd = (i + 1) / layerCount;

    const positions = [];
    for (const seg of segments) {
      if (seg.rNorm + eps >= bandStart && seg.rNorm - eps < bandEnd) {
        positions.push(seg.a.x, seg.a.y, seg.a.z, seg.b.x, seg.b.y, seg.b.z);
      }
    }

    const layerGeometry = new THREE.BufferGeometry();
    if (positions.length >= 6) {
      layerGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    } else {
      // 避免空几何导致渲染异常
      layerGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array([center.x, center.y, center.z, center.x, center.y, center.z]), 3),
      );
    }

    const mat = new THREE.LineBasicMaterial({
      color: primaryColorHex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lineSegs = new THREE.LineSegments(layerGeometry, mat);
    group.add(lineSegs);
    gridLayers.push({
      mesh: lineSegs,
      offset: i / layerCount,
    });
  }

  return { group, gridLayers, detectionType: Number(detectionType) };
}

// 场景重建：轨迹、A/B点、A点脉冲都在这里统一创建/销毁
function rebuildRibbons() {
  globeMesh.visible = ui.globeMode.checked;
  for (const ribbon of ribbons) {
    ribbon.geometry.dispose();
    ribbon.material.dispose();
    scene.remove(ribbon);
  }
  ribbons.length = 0;
  for (const marker of endpointMarkers) {
    scene.remove(marker);
  }
  endpointMarkers.length = 0;
  for (const pulseSystem of aPulseSystems) {
    scene.remove(pulseSystem.group);
  }
  aPulseSystems.length = 0;
  for (const gridSystem of aGroundGridSystems) {
    // Dispose each layer geometry/materials (Points)
    if (gridSystem.gridLayers) {
      for (const layer of gridSystem.gridLayers) {
        if (layer.mesh) {
          if (layer.mesh.material) layer.mesh.material.dispose();
          if (layer.mesh.geometry) layer.mesh.geometry.dispose();
        }
      }
    }
    scene.remove(gridSystem.group);
  }
  aGroundGridSystems.length = 0;
  for (const pulseSystem of bPulseSystems) {
    scene.remove(pulseSystem.group);
  }
  bPulseSystems.length = 0;
  for (const gridSystem of bGroundGridSystems) {
    if (gridSystem.gridLayers) {
      for (const layer of gridSystem.gridLayers) {
        if (layer.mesh) {
          if (layer.mesh.material) layer.mesh.material.dispose();
          if (layer.mesh.geometry) layer.mesh.geometry.dispose();
        }
      }
    }
    scene.remove(gridSystem.group);
  }
  bGroundGridSystems.length = 0;

  for (const preset of runtimePresets) {
    const endpoints = resolveEndpointsOnMode(preset.start, preset.end);
    const mesh = createRibbonMesh({
      ...preset,
      start: endpoints.start,
      end: endpoints.end,
    });
    ribbons.push(mesh);
    scene.add(mesh);

    const markerColor = detectionTypeColors[preset.detectionType] || "#ff8844";
    const aMarker = createEndpointMarker(endpoints.start, "A", markerColor);
    const bMarker = createEndpointMarker(endpoints.end, "B", markerColor);
    endpointMarkers.push(aMarker, bMarker);
    scene.add(aMarker, bMarker);

    aMarker.userData.detectionType = preset.detectionType;
    bMarker.userData.detectionType = preset.detectionType;

    const pulse = createAPulseSystem(endpoints.start, preset.detectionType, markerColor);
    aPulseSystems.push(pulse);
    scene.add(pulse.group);

    const gridColor = multiplyHexColor(markerColor, getGridDarkenFactor());
    const groundGrid = createAGroundGridSystem(
      endpoints.start,
      preset.detectionType,
      gridColor,
      Number(ui.gridCount.value),
      Number(ui.gridSize.value),
    );
    aGroundGridSystems.push(groundGrid);
    scene.add(groundGrid.group);

    const bPulse = createAPulseSystem(endpoints.end, preset.detectionType, markerColor);
    bPulseSystems.push(bPulse);
    scene.add(bPulse.group);

    const bGroundGrid = createAGroundGridSystem(
      endpoints.end,
      preset.detectionType,
      gridColor,
      Number(ui.gridCount.value),
      Number(ui.gridSize.value),
    );
    bGroundGridSystems.push(bGroundGrid);
    scene.add(bGroundGrid.group);
  }
}

function onControlChange() {
  updateLabels();
  rebuildRibbons();
  restartParticles();
}

function applyFixedPresetValues() {
  ui.maxWidth.value = "0.45";
  ui.brightness.value = "2.10";
  ui.travelTime.value = "1.0";
  ui.pulseHeight.value = "1.6";
  ui.pulseFrequency.value = "0.5";
  ui.gridCount.value = "2";
  ui.gridSize.value = "0.8";
  ui.curveHeight.value = "4.8";
  ui.segments.value = "120";
  ui.pointBrightness.value = "1.0";
  ui.pointCoreSize.value = "0.16";
  onControlChange();
}

for (const key of ["maxWidth", "brightness", "travelTime", "pulseSpeed", "pulseHeight", "pulseFrequency", "gridCount", "gridSize", "curveHeight", "segments", "color", "globeMode", "pointBrightness", "pointCoreSize"]) {
  ui[key].addEventListener("input", onControlChange);
}
ui.globeMode.addEventListener("change", onControlChange);
ui.applyFixedPreset.addEventListener("click", applyFixedPresetValues);
ui.cycleGridDarken.addEventListener("click", () => {
  gridDarkenIndex = (gridDarkenIndex + 1) % gridDarkenSteps.length;
  ui.cycleGridDarken.textContent = `调色深度(${Math.round(getGridDarkenFactor() * 100)}%)`;
  onControlChange();
});
ui.cycleTrailLength.addEventListener("click", () => {
  trailLengthIndex = (trailLengthIndex + 1) % trailLengthSteps.length;
  ui.cycleTrailLength.textContent = `调尾巴长度(${Math.round(getTrailLengthFactor() * 100)}%)`;
  onControlChange();
});

let pulseDisplayMode = "random"; // "all" | "random"

// =========================
// 数据池 + 渲染槽位
// - particles: 攻击事件池（可扩到 500+）
// - renderSlots: 可视化槽位（复用已有 preset 资产）
// =========================
const eventPoolSize = 500;
const presetCount = runtimePresets.length;
const renderSlotCount = presetCount;

const particles = []; // 事件池：{ presetIndex, slotIndex, state }
const renderSlots = [...Array(renderSlotCount)].map((_, presetIndex) => ({ presetIndex, eventIndex: -1 }));

// 给“网络攻击数据点”更像持续随机闪现的节奏
const spawnTimeRange = { min: 0.0, max: 2.2 }; // seconds
const lifetimeRange = { min: 0.35, max: 1.65 }; // seconds
const respawnDelayRange = { min: 0.25, max: 3.25 }; // seconds

// fadeIn + hold + fadeOut（以 lifetime 为基准的分段比）
const fadeInRatio = 0.18;
const holdRatio = 0.52;

const randRange = (min, max) => min + Math.random() * (max - min);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;

function calcParticleOpacity(state) {
  const lifetime = Math.max(1e-6, state.lifetime);
  const age = Math.min(lifetime, Math.max(0, state.age));
  const fadeIn = Math.max(1e-6, lifetime * fadeInRatio);
  const hold = Math.max(1e-6, lifetime * holdRatio);
  const fadeOut = Math.max(1e-6, lifetime - fadeIn - hold);

  if (age <= fadeIn) return easeOutCubic(age / fadeIn);
  if (age <= fadeIn + hold) return 1.0;
  const t = (age - (fadeIn + hold)) / fadeOut; // [0,1]
  return 1.0 - easeInCubic(clamp01(t));
}

function getAHideDurations(travelTime) {
  // 按 travelTime 做弱缩放，保证不同速度下顺序仍清晰
  return {
    pulse: Math.max(0.12, travelTime * 0.18), // 先淡出辐射光圈
    point: Math.max(0.12, travelTime * 0.18), // 再淡出 A 点本体
    grid: Math.max(0.18, travelTime * 0.25), // 最后淡出底部网格
  };
}

function getBHideDurations(travelTime) {
  const d = getAHideDurations(travelTime);
  const total = d.pulse + d.point + d.grid;
  const minTotal = 1.5; // B 点分层消失至少 1.5 秒
  if (total >= minTotal) return d;
  const k = minTotal / Math.max(1e-6, total);
  return {
    pulse: d.pulse * k,
    point: d.point * k,
    grid: d.grid * k,
  };
}

function getStagedHideMultipliers(age, startAge, durations, initialVisible) {
  const d1 = Math.max(1e-6, durations.pulse);
  const d2 = Math.max(1e-6, durations.point);
  const d3 = Math.max(1e-6, durations.grid);
  const endAge = startAge + d1 + d2 + d3;

  if (age < startAge) {
    return initialVisible
      ? { pulse: 1, point: 1, grid: 1, done: false }
      : { pulse: 0, point: 0, grid: 0, done: false };
  }
  if (age >= endAge) {
    return { pulse: 0, point: 0, grid: 0, done: true };
  }

  const t = age - startAge;
  if (t < d1) {
    return { pulse: 1 - t / d1, point: 1, grid: 1, done: false };
  }
  if (t < d1 + d2) {
    return { pulse: 0, point: 1 - (t - d1) / d2, grid: 1, done: false };
  }
  return { pulse: 0, point: 0, grid: 1 - (t - d1 - d2) / d3, done: false };
}

function resetPresetToHidden(presetIndex) {
  const ribbon = ribbons[presetIndex];
  if (ribbon && ribbon.material && ribbon.material.uniforms) {
    ribbon.material.uniforms.uAlphaMul.value = 0.0;
    ribbon.visible = false;
  }

  const markerA = endpointMarkers[presetIndex * 2];
  const markerB = endpointMarkers[presetIndex * 2 + 1];
  for (const marker of [markerA, markerB]) {
    if (!marker) continue;
    const mats = marker.userData.markerMats;
    const base = marker.userData.markerBaseOpacity;
    if (mats && base) {
      mats.core.opacity = 0.0;
      mats.ring.opacity = 0.0;
      mats.sprite.opacity = 0.0;
    }
    marker.visible = false;
  }

  const pulse = aPulseSystems[presetIndex];
  if (pulse && pulse.pulseLayers) {
    for (const layer of pulse.pulseLayers) {
      if (ui.globeMode.checked) {
        layer.mesh.position.y = 0;
        layer.mesh.position.z = 0;
      } else {
        layer.mesh.position.y = 0;
        layer.mesh.position.z = 0;
      }
      // 复用 preset 时，重置旋转，避免前一个粒子的累加影响下一个粒子
      layer.mesh.rotation.z = 0;
      layer.mesh.scale.setScalar(0.28);
      for (const mat of layer.mesh.userData.materials) mat.opacity = 0.0;
    }
  }

  const gridSystem = aGroundGridSystems[presetIndex];
  if (gridSystem && gridSystem.gridLayers) {
    for (const layer of gridSystem.gridLayers) {
      layer.mesh.material.opacity = 0.0;
    }
  }
  const bPulse = bPulseSystems[presetIndex];
  if (bPulse && bPulse.pulseLayers) {
    for (const layer of bPulse.pulseLayers) {
      if (ui.globeMode.checked) {
        layer.mesh.position.y = 0;
        layer.mesh.position.z = 0;
      } else {
        layer.mesh.position.y = 0;
        layer.mesh.position.z = 0;
      }
      layer.mesh.rotation.z = 0;
      layer.mesh.scale.setScalar(0.28);
      for (const mat of layer.mesh.userData.materials) mat.opacity = 0.0;
    }
  }
  const bGrid = bGroundGridSystems[presetIndex];
  if (bGrid && bGrid.gridLayers) {
    for (const layer of bGrid.gridLayers) {
      layer.mesh.material.opacity = 0.0;
    }
  }
}

function setupEventTimelineOnPreset(particle, presetIndex, travelTime) {
  const state = particle.state;
  const ribbon = ribbons[presetIndex];
  const phase = ribbon?.userData?.phase ?? 0;
  const phaseNorm = ((phase % 1) + 1) % 1;
  const headNow = ((state.age / travelTime) + phaseNorm) % 1;
  const remToBNorm = ((1 - headNow) + 1) % 1;
  const travelDuration = Math.max(1e-6, remToBNorm * travelTime);

  state.travelStartAge = state.age;
  state.travelDuration = travelDuration;
  const travelEndAge = state.travelStartAge + travelDuration;

  const aDur = getAHideDurations(travelTime);
  const bDur = getBHideDurations(travelTime);
  const aHideTotal = aDur.pulse + aDur.point + aDur.grid;
  const bHideTotal = bDur.pulse + bDur.point + bDur.grid;
  state.travelLifetime = travelEndAge;
  state.aHideStartAge = state.travelStartAge + travelDuration * 0.5;
  state.aHidePulseDuration = aDur.pulse;
  state.aHidePointDuration = aDur.point;
  state.aHideGridDuration = aDur.grid;
  state.bHideStartAge = travelEndAge;
  state.bHidePulseDuration = bDur.pulse;
  state.bHidePointDuration = bDur.point;
  state.bHideGridDuration = bDur.grid;
  state.totalLifetime = Math.max(state.aHideStartAge + aHideTotal, state.bHideStartAge + bHideTotal);
  state.opacity = 1.0;
}

function applyParticleToPreset(particle, presetIndex, travelTime, pulseFrequency, pulseSpeed, pulseHeight) {
  const state = particle.state;
  const baseAlpha = state.opacity;
  const effectiveAge = state.age;
  const travelEndAge = state.travelLifetime ?? Number.POSITIVE_INFINITY;
  const ribbonAlphaMul = state.age < travelEndAge ? baseAlpha : 0.0;

  const aStage = getStagedHideMultipliers(
    state.age,
    state.aHideStartAge ?? Number.POSITIVE_INFINITY,
    {
      pulse: state.aHidePulseDuration ?? 0.2,
      point: state.aHidePointDuration ?? 0.2,
      grid: state.aHideGridDuration ?? 0.3,
    },
    true,
  );
  const bStage = getStagedHideMultipliers(
    state.age,
    state.bHideStartAge ?? Number.POSITIVE_INFINITY,
    {
      pulse: state.bHidePulseDuration ?? 0.2,
      point: state.bHidePointDuration ?? 0.2,
      grid: state.bHideGridDuration ?? 0.3,
    },
    false,
  );

  const markerAAlphaMul = baseAlpha * aStage.point;
  const markerBAlphaMul = baseAlpha * bStage.point;
  const aPulseAlphaMul = baseAlpha * aStage.pulse;
  const aGridAlphaMul = baseAlpha * aStage.grid;
  const bPulseAlphaMul = baseAlpha * bStage.pulse;
  const bGridAlphaMul = baseAlpha * bStage.grid;

  const ribbon = ribbons[presetIndex];
  if (ribbon && ribbon.material && ribbon.material.uniforms) {
    const head = ((state.age / travelTime) + ribbon.userData.phase) % 1;
    ribbon.material.uniforms.uHead.value = head;
    ribbon.material.uniforms.uBrightness.value = Number(ui.brightness.value) * (0.92 + 0.12 * Math.sin(state.age * 2.0));
    ribbon.material.uniforms.uAlphaMul.value = ribbonAlphaMul;
    ribbon.visible = ribbonAlphaMul > 0.001;
  }

  const markerA = endpointMarkers[presetIndex * 2];
  const markerB = endpointMarkers[presetIndex * 2 + 1];
  for (const [marker, alphaMul] of [
    [markerA, markerAAlphaMul],
    [markerB, markerBAlphaMul],
  ]) {
    if (!marker) continue;
    const mats = marker.userData.markerMats;
    const base = marker.userData.markerBaseOpacity;
    if (mats && base) {
      mats.core.opacity = base.core * alphaMul;
      mats.ring.opacity = base.ring * alphaMul;
      mats.sprite.opacity = base.sprite * alphaMul;
    }
    marker.visible = alphaMul > 0.001;
  }

  const pulse = aPulseSystems[presetIndex];
  if (pulse && pulse.pulseLayers) {
    for (const layer of pulse.pulseLayers) {
      const localLife = Math.min(1, Math.max(0, effectiveAge * pulseFrequency - (layer.offset ?? 0)));
      const yOffset = localLife * pulseHeight * pulseSpeed;
      const scale = 0.28 + yOffset * 0.85;

      if (ui.globeMode.checked) {
        layer.mesh.position.y = 0;
        layer.mesh.position.z = yOffset;
      } else {
        layer.mesh.position.y = yOffset;
        layer.mesh.position.z = 0;
      }
      layer.mesh.scale.setScalar(scale);

      const layerAlpha =
        localLife === 0 ? 0.0 : Math.pow(localLife, 0.7) * Math.pow(1.0 - localLife, 1.7) * 0.95;
      const finalAlpha = layerAlpha * aPulseAlphaMul;

      for (const mat of layer.mesh.userData.materials) mat.opacity = finalAlpha;
      if (finalAlpha > 0.001) layer.mesh.rotation.z += 0.004 * layer.spin;
    }
  }

  const gridSystem = aGroundGridSystems[presetIndex];
  if (gridSystem && gridSystem.gridLayers) {
    for (const layer of gridSystem.gridLayers) {
      const layerFade = 1.0 - layer.offset * 0.75;
      const localLife = Math.min(1, Math.max(0, effectiveAge * pulseFrequency - (layer.offset ?? 0)));
      const layerAlpha =
        localLife === 0
          ? 0.0
          : Math.pow(localLife, 0.65) * Math.pow(1.0 - localLife, 2.0) * 0.8 * Math.max(0.0, layerFade);
      layer.mesh.material.opacity = layerAlpha * aGridAlphaMul;
    }
  }

  const bPulse = bPulseSystems[presetIndex];
  if (bPulse && bPulse.pulseLayers) {
    for (const layer of bPulse.pulseLayers) {
      const localLife = Math.min(1, Math.max(0, effectiveAge * pulseFrequency - (layer.offset ?? 0)));
      const yOffset = localLife * pulseHeight * pulseSpeed;
      const scale = 0.28 + yOffset * 0.85;
      if (ui.globeMode.checked) {
        layer.mesh.position.y = 0;
        layer.mesh.position.z = yOffset;
      } else {
        layer.mesh.position.y = yOffset;
        layer.mesh.position.z = 0;
      }
      layer.mesh.scale.setScalar(scale);
      const layerAlpha =
        localLife === 0 ? 0.0 : Math.pow(localLife, 0.7) * Math.pow(1.0 - localLife, 1.7) * 0.95;
      const finalAlpha = layerAlpha * bPulseAlphaMul;
      for (const mat of layer.mesh.userData.materials) mat.opacity = finalAlpha;
      if (finalAlpha > 0.001) layer.mesh.rotation.z += 0.004 * layer.spin;
    }
  }

  const bGrid = bGroundGridSystems[presetIndex];
  if (bGrid && bGrid.gridLayers) {
    for (const layer of bGrid.gridLayers) {
      const layerFade = 1.0 - layer.offset * 0.75;
      const localLife = Math.min(1, Math.max(0, effectiveAge * pulseFrequency - (layer.offset ?? 0)));
      const layerAlpha =
        localLife === 0
          ? 0.0
          : Math.pow(localLife, 0.65) * Math.pow(1.0 - localLife, 2.0) * 0.8 * Math.max(0.0, layerFade);
      layer.mesh.material.opacity = layerAlpha * bGridAlphaMul;
    }
  }
}

function restartParticles() {
  particles.length = 0;

  // 清空槽位并隐藏上一轮可视对象
  for (const slot of renderSlots) {
    slot.eventIndex = -1;
    resetPresetToHidden(slot.presetIndex);
  }

  for (let i = 0; i < eventPoolSize; i++) {
    particles.push({
      presetIndex: -1,
      slotIndex: -1,
      state: {
        active: false,
        age: 0,
        lifetime: randRange(lifetimeRange.min, lifetimeRange.max),
        delay: randRange(spawnTimeRange.min, spawnTimeRange.max), // spawnTime => 初始 delay
        opacity: 0,
      },
    });
  }

  if (pulseDisplayMode === "all") {
    // 同时显示：占满可视槽位；其余事件留在池中等待
    for (let i = 0; i < renderSlotCount; i++) {
      const particle = particles[i];
      const presetIndex = renderSlots[i].presetIndex;
      renderSlots[i].eventIndex = i;
      particle.presetIndex = presetIndex;
      particle.slotIndex = i;
      particle.state.active = true;
      particle.state.delay = 0;
      particle.state.lifetime = 9999; // 极长生命周期，保证视觉上持续
      // 在 fadeIn + hold 中间附近，让 opacity 基本保持为 1
      particle.state.age = particle.state.lifetime * (fadeInRatio + holdRatio * 0.5);
      particle.state.opacity = calcParticleOpacity(particle.state);
    }
  }
}

ui.togglePulseMode.addEventListener("click", () => {
  pulseDisplayMode = pulseDisplayMode === "all" ? "random" : "all";
  ui.togglePulseMode.textContent = pulseDisplayMode === "all" ? "显示模式：同时显示" : "显示模式：随机闪现";
  restartParticles();
});

ui.togglePulseMode.textContent = "显示模式：随机闪现";
ui.cycleGridDarken.textContent = `调色深度(${Math.round(getGridDarkenFactor() * 100)}%)`;
ui.cycleTrailLength.textContent = `调尾巴长度(${Math.round(getTrailLengthFactor() * 100)}%)`;

restartParticles();
onControlChange();

let lastFrameTime = performance.now() * 0.001;
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  // 只在 OrbitControls 更新后做一次越界保护，不再前后两次抢控制权。
  updateConstrainedOrbitCamera();
  const time = performance.now() * 0.001;
  let dt = time - lastFrameTime;
  lastFrameTime = time;
  dt = Math.max(0, Math.min(0.12, dt));

  const travelTime = Math.max(0.1, Number(ui.travelTime.value));
  const pulseFrequency = Number(ui.pulseFrequency.value);
  const pulseSpeed = Number(ui.pulseSpeed.value);
  const pulseHeight = Number(ui.pulseHeight.value);

  if (pulseDisplayMode === "all") {
    for (let i = 0; i < renderSlotCount; i++) {
      const eventIndex = renderSlots[i].eventIndex;
      if (eventIndex < 0) continue;
      const particle = particles[eventIndex];
      const state = particle.state;
      state.active = true;
      state.age += dt;
      state.opacity = calcParticleOpacity(state);
      applyParticleToPreset(particle, renderSlots[i].presetIndex, travelTime, pulseFrequency, pulseSpeed, pulseHeight);
    }
    composer.render();
    return;
  }

  // 先更新等待态事件的延迟（500 数据池）
  for (const particle of particles) {
    if (!particle.state.active && particle.slotIndex < 0) {
      particle.state.delay -= dt;
    }
  }

  for (const slot of renderSlots) {
    if (slot.eventIndex >= 0) {
      const particle = particles[slot.eventIndex];
      const state = particle.state;
      state.age += dt;

      if (state.travelLifetime != null && state.age <= state.travelLifetime) {
        state.opacity = 1.0;
      }

      if (state.totalLifetime != null && state.age >= state.totalLifetime) {
        resetPresetToHidden(slot.presetIndex);
        slot.eventIndex = -1;

        particle.presetIndex = -1;
        particle.slotIndex = -1;
        state.active = false;
        state.age = 0;
        state.opacity = 0;
        state.delay = randRange(respawnDelayRange.min, respawnDelayRange.max);
        state.lifetime = randRange(lifetimeRange.min, lifetimeRange.max);
        state.travelLifetime = null;
        state.travelStartAge = null;
        state.travelDuration = null;
        state.totalLifetime = null;
        state.aHideStartAge = null;
        state.aHidePulseDuration = null;
        state.aHidePointDuration = null;
        state.aHideGridDuration = null;
        state.bHideStartAge = null;
        state.bHidePulseDuration = null;
        state.bHidePointDuration = null;
        state.bHideGridDuration = null;
      } else {
        applyParticleToPreset(particle, slot.presetIndex, travelTime, pulseFrequency, pulseSpeed, pulseHeight);
      }
      continue;
    }

    // 槽位空闲时，从事件池取一个“已到时”的事件
    const readyIndex = particles.findIndex((p) => !p.state.active && p.slotIndex < 0 && p.state.delay <= 0);
    if (readyIndex < 0) continue;

    const particle = particles[readyIndex];
    const state = particle.state;
    const spawnAge = -state.delay;
    state.active = true;
    state.age = spawnAge;
    state.delay = 0;
    state.opacity = 1.0;
    particle.slotIndex = slot.presetIndex;
    particle.presetIndex = slot.presetIndex;
    setupEventTimelineOnPreset(particle, slot.presetIndex, travelTime);
    slot.eventIndex = readyIndex;
    applyParticleToPreset(particle, slot.presetIndex, travelTime, pulseFrequency, pulseSpeed, pulseHeight);
  }

  composer.render();
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

