/* ─────────────────────────────────────────────────────────────
   main.js
   Three.js scene setup and render loop. Owns the mesh and
   coordinates updates between geometry, controls, and renderer.
   ───────────────────────────────────────────────────────────── */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildForm, FORMS } from './geometry.js';
import { Controls, DEFAULT_PARAMS } from './controls.js';

/* ───── Palette (mirrors CSS variables) ───── */
const COLORS = {
  bg:     0x1A1A18,
  purple: 0x7F77DD,
  teal:   0x5DCAA5,
  ink:    0xE8E6DE,
  faint:  0x2A2A26,
};

/* ───── App state ───── */
const params = { ...DEFAULT_PARAMS };
let scene, camera, renderer, orbit;
let formGroup;     // holds the current visualisation (mesh + wireframe)
let mainMesh;      // the actual filled surface (for export)
let edgeLines;     // wireframe overlay
let gridHelper;
let pointLights = [];

/* ───── Init ───── */
function init() {
  const container = document.getElementById('canvas-container');

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(COLORS.bg, 1);
  renderer.shadowMap.enabled = false; // wireframe-first; shadows hurt the look
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.Fog(COLORS.bg, 12, 26);

  // Camera
  camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(5.5, 3.5, 6.5);
  camera.lookAt(0, 0, 0);

  // Orbit
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.06;
  orbit.minDistance = 2;
  orbit.maxDistance = 18;
  orbit.autoRotate = params.autoRotate;
  orbit.autoRotateSpeed = 0.6;
  orbit.target.set(0, 0, 0);

  // Lighting — soft, with two coloured accents
  const hemi = new THREE.HemisphereLight(COLORS.ink, COLORS.bg, 0.45);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);

  const keyLight = new THREE.PointLight(COLORS.purple, 1.2, 30, 1.6);
  keyLight.position.set(4, 5, 4);
  scene.add(keyLight);
  pointLights.push(keyLight);

  const fillLight = new THREE.PointLight(COLORS.teal, 0.7, 20, 1.6);
  fillLight.position.set(-5, -2, -3);
  scene.add(fillLight);
  pointLights.push(fillLight);

  // Grid floor
  buildGrid();

  // Build initial form
  formGroup = new THREE.Group();
  scene.add(formGroup);
  rebuildForm();

  // Resize handling
  window.addEventListener('resize', onResize);

  // Hide splash once we're rendering
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.getElementById('splash').classList.add('is-hidden');
    }, 300);
  });
}

/* ───── Grid floor ───── */
function buildGrid() {
  const size = 20;
  const divisions = 40;
  gridHelper = new THREE.GridHelper(size, divisions, COLORS.faint, COLORS.faint);
  gridHelper.position.y = -3.5;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.45;
  scene.add(gridHelper);

  // Decorative inner circle on the grid plane
  const ringGeo = new THREE.RingGeometry(2.0, 2.02, 96);
  const ringMat = new THREE.MeshBasicMaterial({
    color: COLORS.purple,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -3.49;
  scene.add(ring);

  const ring2Geo = new THREE.RingGeometry(4.0, 4.015, 128);
  const ring2 = new THREE.Mesh(ring2Geo, ringMat.clone());
  ring2.material.opacity = 0.12;
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = -3.49;
  scene.add(ring2);
}

/* ───── Build (or rebuild) the form ───── */
function rebuildForm() {
  // Dispose previous
  if (mainMesh) {
    mainMesh.geometry.dispose();
    if (Array.isArray(mainMesh.material)) {
      mainMesh.material.forEach(m => m.dispose());
    } else {
      mainMesh.material.dispose();
    }
    formGroup.remove(mainMesh);
  }
  if (edgeLines) {
    edgeLines.geometry.dispose();
    edgeLines.material.dispose();
    formGroup.remove(edgeLines);
  }

  // Build new geometry
  const geometry = buildForm(params.form, params);

  // Materials per mode
  const solidMat = new THREE.MeshStandardMaterial({
    color: COLORS.purple,
    roughness: 0.35,
    metalness: 0.15,
    flatShading: false,
    side: THREE.DoubleSide
  });

  const xrayMat = new THREE.MeshBasicMaterial({
    color: COLORS.purple,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const wireframeFillMat = new THREE.MeshBasicMaterial({
    color: COLORS.bg,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  // Choose primary material based on mode
  let primaryMat;
  if (params.mode === 'solid') primaryMat = solidMat;
  else if (params.mode === 'xray') primaryMat = xrayMat;
  else primaryMat = wireframeFillMat; // wireframe mode: fill = bg, edges drawn separately

  mainMesh = new THREE.Mesh(geometry, primaryMat);
  formGroup.add(mainMesh);

  // Edge wireframe overlay
  // For wireframe and xray modes, we add bright edges.
  // For solid mode, we skip the wireframe overlay.
  if (params.mode === 'wireframe' || params.mode === 'xray') {
    const edgeGeom = new THREE.WireframeGeometry(geometry);
    const edgeColor = params.mode === 'xray' ? COLORS.teal : COLORS.purple;
    const edgeMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: params.mode === 'xray' ? 0.55 : 0.85,
      linewidth: 1
    });
    edgeLines = new THREE.LineSegments(edgeGeom, edgeMat);
    formGroup.add(edgeLines);
  } else {
    edgeLines = null;
  }

  // Update stats
  updateStats(geometry);
}

/* ───── Stats display ───── */
function updateStats(geometry) {
  const verts = geometry.attributes.position.count;
  const faces = geometry.index ? geometry.index.count / 3 : verts / 3;

  document.getElementById('stat-form').textContent = FORMS[params.form].name;
  document.getElementById('stat-verts').textContent = verts.toLocaleString();
  document.getElementById('stat-faces').textContent = Math.floor(faces).toLocaleString();
}

/* ───── Resize ───── */
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

/* ───── Render loop ───── */
let lastFps = 0;
let frameCount = 0;
let fpsTimer = performance.now();

function animate() {
  requestAnimationFrame(animate);

  orbit.update();

  // Light orbit — adds dynamism in solid mode
  const t = performance.now() * 0.0005;
  pointLights[0].position.set(
    Math.cos(t) * 5,
    4 + Math.sin(t * 0.7) * 1,
    Math.sin(t) * 5
  );

  renderer.render(scene, camera);

  // FPS calc
  frameCount++;
  const now = performance.now();
  if (now - fpsTimer > 500) {
    lastFps = Math.round((frameCount * 1000) / (now - fpsTimer));
    frameCount = 0;
    fpsTimer = now;
    const el = document.getElementById('stat-fps');
    if (el) el.textContent = lastFps;
  }
}

/* ───── Wire up Controls ───── */
function setupControls() {
  new Controls(params, {
    onParamChange: () => rebuildForm(),
    onFormChange: () => rebuildForm(),
    onModeChange: () => rebuildForm(),
    onAutoRotate: () => { orbit.autoRotate = params.autoRotate; },
    getMesh: () => mainMesh
  });
}

/* ───── Boot ───── */
init();
setupControls();
animate();
