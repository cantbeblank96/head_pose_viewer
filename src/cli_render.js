import * as THREE from "three";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";

const DEFAULT_CAMERA = {
  position: new THREE.Vector3(0, 0.05, 2.4),
  target: new THREE.Vector3(0, 0.05, 0),
};

const DEFAULT_MODEL = "/model/person_0/GLB/head_scan_13_photogrammetry_4k.glb";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe7e7e7);

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const canvas = document.querySelector("#viewer");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;

const loader = new GLTFLoader();
const modelRoot = new THREE.Group();
scene.add(modelRoot);

let loadedModel = null;
let loadedModelPath = "";

initLights();

function initLights() {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x606060, 2.2));

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, 3, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 1.2);
  fill.position.set(-3, 2, 2);
  scene.add(fill);
}

function normalizeModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  object.position.sub(center);

  const maxSide = Math.max(size.x, size.y, size.z);
  if (maxSide > 0) {
    object.scale.setScalar(1.65 / maxSide);
  }

  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.castShadow = false;
    child.receiveShadow = false;
    if (child.material) {
      child.material.side = THREE.FrontSide;
    }
  });
}

function resetCamera() {
  camera.position.copy(DEFAULT_CAMERA.position);
  camera.lookAt(DEFAULT_CAMERA.target);
}

function applyPose(pose) {
  modelRoot.rotation.set(
    degToRad(pose.basePitch + pose.pitch),
    degToRad(pose.baseYaw + pose.yaw),
    degToRad(pose.baseRoll + pose.roll),
    "YXZ",
  );
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function fileAngle(value) {
  return Number(value.toFixed(3)).toString().replace("-", "neg");
}

function makeFileName(pose, index = null) {
  const prefix = index === null ? "person_0" : `person_0_${String(index).padStart(4, "0")}`;
  return `${prefix}_yaw_${fileAngle(pose.yaw)}_pitch_${fileAngle(pose.pitch)}_roll_${fileAngle(pose.roll)}.png`;
}

function normalizePose(input = {}) {
  const read = (key) => {
    const value = Number(input[key]);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    yaw: read("yaw"),
    pitch: read("pitch"),
    roll: read("roll"),
    baseYaw: read("baseYaw"),
    basePitch: read("basePitch"),
    baseRoll: read("baseRoll"),
  };
}

function resolveModelPath(modelPath) {
  const path = modelPath || DEFAULT_MODEL;
  if (path.startsWith("/") || /^https?:\/\//.test(path)) {
    return path;
  }
  return `/${path.replace(/^\/+/, "")}`;
}

async function loadModel(modelPath) {
  const path = resolveModelPath(modelPath);
  if (loadedModel && loadedModelPath === path) {
    return;
  }

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        if (loadedModel) {
          modelRoot.remove(loadedModel);
          disposeObject(loadedModel);
        }
        loadedModel = gltf.scene;
        loadedModelPath = path;
        normalizeModel(loadedModel);
        modelRoot.add(loadedModel);
        resolve();
      },
      undefined,
      reject,
    );
  });
}

async function capturePngDataUrl(pose, options = {}) {
  if (!loadedModel) {
    throw new Error("Model is not loaded.");
  }

  const width = clampInt(options.width, 64, 8192, 1024);
  const height = clampInt(options.height, 64, 8192, 1024);

  applyPose(pose);
  resetCamera();

  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  canvas.width = width;
  canvas.height = height;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  await renderer.compileAsync(scene, camera);
  for (let frame = 0; frame < 3; frame += 1) {
    renderer.render(scene, camera);
    await nextFrame();
  }

  const dataUrl = renderer.domElement.toDataURL("image/png");
  return {
    dataUrl,
    fileName: makeFileName(pose, options.index ?? null),
    width,
    height,
  };
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value && value.isTexture) {
          value.dispose();
        }
      });
      material.dispose();
    });
  });
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function renderOne(options) {
  const opts = options ?? {};
  await loadModel(opts.modelPath);
  const pose = normalizePose(opts);
  return capturePngDataUrl(pose, opts);
}

async function renderBatch(options) {
  const opts = options ?? {};
  const rows = Array.isArray(opts.rows) ? opts.rows : [];
  if (!rows.length) {
    throw new Error("Batch rows are empty.");
  }

  await loadModel(opts.modelPath);
  const results = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const pose = normalizePose({
      ...opts,
      yaw: row.yaw,
      pitch: row.pitch,
      roll: row.roll,
    });
    const captured = await capturePngDataUrl(pose, {
      width: opts.width,
      height: opts.height,
      index: index + 1,
    });
    results.push(captured);
  }
  return results;
}

window.headPoseCli = {
  renderOne,
  renderBatch,
  loadModel,
};

window.dispatchEvent(new Event("head-pose-cli-ready"));
