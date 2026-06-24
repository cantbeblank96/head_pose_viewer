import * as THREE from "three";
import { OrbitControls } from "../vendor/three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";

const dom = {
  canvas: document.querySelector("#viewer"),
  status: document.querySelector("#status"),
  modelPath: document.querySelector("#modelPath"),
  loadModel: document.querySelector("#loadModel"),
  yaw: document.querySelector("#yaw"),
  pitch: document.querySelector("#pitch"),
  roll: document.querySelector("#roll"),
  baseYaw: document.querySelector("#baseYaw"),
  basePitch: document.querySelector("#basePitch"),
  baseRoll: document.querySelector("#baseRoll"),
  resetPose: document.querySelector("#resetPose"),
  exportWidth: document.querySelector("#exportWidth"),
  exportHeight: document.querySelector("#exportHeight"),
  fixedCamera: document.querySelector("#fixedCamera"),
  exportCurrent: document.querySelector("#exportCurrent"),
  batchAngles: document.querySelector("#batchAngles"),
  exportBatch: document.querySelector("#exportBatch"),
};

const DEFAULT_CAMERA = {
  position: new THREE.Vector3(0, 0.05, 2.4),
  target: new THREE.Vector3(0, 0.05, 0),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe7e7e7);

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
// 鼠标拖动直接驱动模型姿态（而非相机轨道），这样拖动结果会同步回 yaw/pitch/roll
// 输入框，并与精确输入、批量导出保持同一数据源。缩放/平移仍交给 OrbitControls。
controls.enableRotate = false;

const DRAG_SENSITIVITY = 0.4;
const dragState = { active: false, lastX: 0, lastY: 0, rollMode: false };

const loader = new GLTFLoader();
const modelRoot = new THREE.Group();
scene.add(modelRoot);

let loadedModel = null;
let currentModelPath = "";

initLights();
resetCamera();
resizeRenderer();
loadModel(dom.modelPath.value);
animate();

window.addEventListener("resize", resizeRenderer);
dom.loadModel.addEventListener("click", () => loadModel(dom.modelPath.value));
dom.resetPose.addEventListener("click", resetPose);
dom.exportCurrent.addEventListener("click", () => exportCurrentImage());
dom.exportBatch.addEventListener("click", () => exportBatchImages());

[
  dom.yaw,
  dom.pitch,
  dom.roll,
  dom.baseYaw,
  dom.basePitch,
  dom.baseRoll,
].forEach((input) => input.addEventListener("input", applyPose));

setupPoseDrag();

function setupPoseDrag() {
  dom.canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    dragState.active = true;
    dragState.rollMode = event.shiftKey;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;
    dom.canvas.setPointerCapture(event.pointerId);
  });

  dom.canvas.addEventListener("pointermove", (event) => {
    if (!dragState.active) {
      return;
    }
    const dx = event.clientX - dragState.lastX;
    const dy = event.clientY - dragState.lastY;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;

    if (dragState.rollMode) {
      setAngleInput(dom.roll, readNumber(dom.roll) + dx * DRAG_SENSITIVITY);
    } else {
      setAngleInput(dom.yaw, readNumber(dom.yaw) + dx * DRAG_SENSITIVITY);
      setAngleInput(dom.pitch, readNumber(dom.pitch) + dy * DRAG_SENSITIVITY);
    }
    applyPose();
  });

  const endDrag = (event) => {
    if (!dragState.active) {
      return;
    }
    dragState.active = false;
    try {
      dom.canvas.releasePointerCapture(event.pointerId);
    } catch (error) {
      // 指针已释放时忽略。
    }
  };

  dom.canvas.addEventListener("pointerup", endDrag);
  dom.canvas.addEventListener("pointercancel", endDrag);
}

function setAngleInput(input, value) {
  input.value = wrapDeg(value);
}

function wrapDeg(value) {
  const wrapped = (((value + 180) % 360) + 360) % 360 - 180;
  return Math.round(wrapped);
}

function initLights() {
  const ambient = new THREE.HemisphereLight(0xffffff, 0x606060, 2.2);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, 3, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 1.2);
  fill.position.set(-3, 2, 2);
  scene.add(fill);
}

function loadModel(path) {
  currentModelPath = path;
  setBusy(true);
  setStatus(`正在加载模型：${path}`);

  loader.load(
    path,
    (gltf) => {
      if (loadedModel) {
        modelRoot.remove(loadedModel);
        disposeObject(loadedModel);
      }

      loadedModel = gltf.scene;
      normalizeModel(loadedModel);
      modelRoot.add(loadedModel);
      applyPose();
      resetCamera();
      setStatus(`模型加载完成：${path}`);
      setBusy(false);
    },
    (event) => {
      if (!event.total) {
        return;
      }
      const percent = Math.round((event.loaded / event.total) * 100);
      setStatus(`正在加载模型：${percent}%`);
    },
    (error) => {
      console.error(error);
      setStatus(`模型加载失败：${path}`);
      setBusy(false);
    },
  );
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
  controls.target.copy(DEFAULT_CAMERA.target);
  controls.update();
}

function resetPose() {
  dom.yaw.value = 0;
  dom.pitch.value = 0;
  dom.roll.value = 0;
  applyPose();
}

function applyPose() {
  const pose = readAngles();
  // 约定：yaw 绕 Y 轴，pitch 绕 X 轴，roll 绕 Z 轴。
  modelRoot.rotation.set(
    degToRad(pose.basePitch + pose.pitch),
    degToRad(pose.baseYaw + pose.yaw),
    degToRad(pose.baseRoll + pose.roll),
    "YXZ",
  );
  setStatus(
    `当前姿态 yaw=${displayAngle(pose.yaw)}, pitch=${displayAngle(pose.pitch)}, roll=${displayAngle(pose.roll)}`,
  );
}

async function exportCurrentImage() {
  if (!loadedModel) {
    setStatus("模型尚未加载完成，无法导出。");
    return;
  }

  setBusy(true);
  const pose = readAngles();
  const fileName = makeFileName(pose);
  await capturePng(fileName);
  setStatus(`已导出：${fileName}`);
  setBusy(false);
}

async function exportBatchImages() {
  if (!loadedModel) {
    setStatus("模型尚未加载完成，无法批量导出。");
    return;
  }

  let rows;
  try {
    rows = parseBatchAngles(dom.batchAngles.value);
  } catch (error) {
    setStatus(error.message);
    return;
  }

  if (!rows.length) {
    setStatus("批量角度为空。");
    return;
  }

  setBusy(true);
  const originalPose = readAngles();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    dom.yaw.value = row.yaw;
    dom.pitch.value = row.pitch;
    dom.roll.value = row.roll;
    applyPose();
    const pose = readAngles();
    const fileName = makeFileName(pose, index + 1);
    setStatus(`正在导出 ${index + 1}/${rows.length}：${fileName}`);
    await capturePng(fileName);
    await sleep(180);
  }

  dom.yaw.value = originalPose.yaw;
  dom.pitch.value = originalPose.pitch;
  dom.roll.value = originalPose.roll;
  applyPose();

  setStatus(`批量导出完成：${rows.length} 张。`);
  setBusy(false);
}

async function capturePng(fileName) {
  const oldSize = new THREE.Vector2();
  const oldPixelRatio = renderer.getPixelRatio();
  renderer.getSize(oldSize);

  const width = clampInt(dom.exportWidth.value, 64, 8192, 1024);
  const height = clampInt(dom.exportHeight.value, 64, 8192, 1024);

  if (dom.fixedCamera.checked) {
    resetCamera();
  }

  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  await nextFrame();

  const blob = await new Promise((resolve) => {
    renderer.domElement.toBlob(resolve, "image/png");
  });
  downloadBlob(blob, fileName);

  renderer.setPixelRatio(oldPixelRatio);
  renderer.setSize(oldSize.x, oldSize.y, false);
  resizeRenderer();
}

function parseBatchAngles(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const hasHeader = /[a-zA-Z]/.test(lines[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const parts = line.split(/[,\s]+/).filter(Boolean);
    if (parts.length < 3) {
      throw new Error(`第 ${index + 1} 行角度不足，需要 yaw,pitch,roll。`);
    }

    const [yaw, pitch, roll] = parts.map(Number);
    if (![yaw, pitch, roll].every(Number.isFinite)) {
      throw new Error(`第 ${index + 1} 行包含非数字角度：${line}`);
    }

    return { yaw, pitch, roll };
  });
}

function readAngles() {
  return {
    yaw: readNumber(dom.yaw),
    pitch: readNumber(dom.pitch),
    roll: readNumber(dom.roll),
    baseYaw: readNumber(dom.baseYaw),
    basePitch: readNumber(dom.basePitch),
    baseRoll: readNumber(dom.baseRoll),
  };
}

function readNumber(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : 0;
}

function resizeRenderer() {
  const rect = dom.canvas.parentElement.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
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

function makeFileName(pose, index = null) {
  const prefix = index === null ? "person_0" : `person_0_${String(index).padStart(4, "0")}`;
  return `${prefix}_yaw_${fileAngle(pose.yaw)}_pitch_${fileAngle(pose.pitch)}_roll_${fileAngle(pose.roll)}.png`;
}

function downloadBlob(blob, fileName) {
  if (!blob) {
    setStatus("截图生成失败。");
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setBusy(isBusy) {
  [
    dom.loadModel,
    dom.exportCurrent,
    dom.exportBatch,
    dom.modelPath,
  ].forEach((element) => {
    element.disabled = isBusy;
  });
}

function setStatus(message) {
  dom.status.textContent = message;
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

function displayAngle(value) {
  return Number(value.toFixed(3)).toString();
}

function fileAngle(value) {
  return Number(value.toFixed(3)).toString().replace("-", "neg");
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
