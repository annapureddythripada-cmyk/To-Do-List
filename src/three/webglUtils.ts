import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createStudioRenderer(
  width: number,
  height: number,
  isSoftwareGl: boolean
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  );
  renderer.setSize(Math.max(width, 1), Math.max(height, 1));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function applyStudioEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();
  return envTex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.5
    );
    grad.addColorStop(0, 'rgba(20, 8, 42, 0.52)');
    grad.addColorStop(0.55, 'rgba(20, 8, 42, 0.22)');
    grad.addColorStop(1, 'rgba(20, 8, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTerraceTextures(renderer: THREE.WebGLRenderer): {
  albedo: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
} {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  if (aCtx && rCtx) {
    aCtx.fillStyle = '#251742';
    aCtx.fillRect(0, 0, size, size);

    rCtx.fillStyle = '#888888';
    rCtx.fillRect(0, 0, size, size);

    const step = 64;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const shade = ((x + y) / step) % 2 === 0 ? '#2c1c4e' : '#241640';
        aCtx.fillStyle = shade;
        aCtx.fillRect(x + 2, y + 2, step - 4, step - 4);

        rCtx.fillStyle = ((x + y) / step) % 2 === 0 ? '#6e6e6e' : '#808080';
        rCtx.fillRect(x + 2, y + 2, step - 4, step - 4);
      }
    }

    aCtx.strokeStyle = '#3f2c68';
    aCtx.lineWidth = 2;
    for (let i = 0; i <= size; i += step) {
      aCtx.beginPath();
      aCtx.moveTo(i, 0);
      aCtx.lineTo(i, size);
      aCtx.stroke();

      aCtx.beginPath();
      aCtx.moveTo(0, i);
      aCtx.lineTo(size, i);
      aCtx.stroke();
    }
  }

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(8, 8);
  albedo.anisotropy = maxAniso;

  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.colorSpace = THREE.NoColorSpace;
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(8, 8);
  roughness.anisotropy = maxAniso;

  return { albedo, roughness };
}

export function scheduleAfterDraw(
  renderer: THREE.WebGLRenderer,
  cb: () => void,
  registerHandle: (id: number) => void
): void {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  if (!gl || typeof gl.fenceSync !== 'function') {
    const id = window.setTimeout(cb, 80);
    registerHandle(id);
    return;
  }
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
    if (state === gl.UNSIGNALED) {
      const id = window.setTimeout(poll, 5);
      registerHandle(id);
    } else {
      if (sync) gl.deleteSync(sync);
      const id = window.setTimeout(cb, 80);
      registerHandle(id);
    }
  };
  const id = window.setTimeout(poll, 5);
  registerHandle(id);
}
