import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Layers,
  Sun,
  Moon,
  CheckCircle2,
} from 'lucide-react';
import type { Task, TaskStatus } from '../types/task';
import {
  applyStudioEnvironment,
  createContactShadowTexture,
  createStudioRenderer,
  createTerraceTextures,
  detectSoftwareWebGL,
  scheduleAfterDraw,
} from '../three/webglUtils';

interface ThreeSceneViewProps {
  tasks: Task[];
  onToggleTaskStatus: (task: Task, nextStatus: TaskStatus) => Promise<void>;
}

type LightingPreset = 'dusk' | 'daylight';
type CameraPreset = 'overview' | 'astrolabe' | 'overhead';

const _scratchVec = new THREE.Vector3();
const _scratchMat = new THREE.Matrix4();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();
const _scratchColor = new THREE.Color();

export function ThreeSceneView({
  tasks,
  onToggleTaskStatus,
}: ThreeSceneViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;

  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('dusk');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [inspectedTask, setInspectedTask] = useState<Task | null>(null);
  const [webglFallback, setWebglFallback] = useState(false);

  const explodeTargetRef = useRef(0);
  explodeTargetRef.current = explodeFactor;

  const lightingRef = useRef<LightingPreset>('dusk');
  lightingRef.current = lightingPreset;

  const cameraPresetTargetRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(0, 8.5, 15.5),
    target: new THREE.Vector3(0, 1.8, 0),
  });

  const applyCameraPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    if (preset === 'overview') {
      cameraPresetTargetRef.current.pos.set(0, 8.5, 15.5);
      cameraPresetTargetRef.current.target.set(0, 1.8, 0);
    } else if (preset === 'astrolabe') {
      cameraPresetTargetRef.current.pos.set(4.6, 3.8, 5.4);
      cameraPresetTargetRef.current.target.set(0, 2.3, 0);
    } else {
      cameraPresetTargetRef.current.pos.set(0, 18.5, 0.1);
      cameraPresetTargetRef.current.target.set(0, 0, 0);
    }
    cameraPresetTargetRef.current.active = true;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const testCanvas = document.createElement('canvas');
    const hasGl = Boolean(
      testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')
    );
    if (!hasGl) {
      setWebglFallback(true);
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 580;

    const renderer = createStudioRenderer(width, height, isSoftwareGl);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const duskBg = new THREE.Color('#19102e');
    const dayBg = new THREE.Color('#eae4f7');
    scene.background = duskBg.clone();
    scene.fog = new THREE.FogExp2('#19102e', 0.022);

    const envTexture = applyStudioEnvironment(scene, renderer);
    const contactTex = createContactShadowTexture();
    const terraceTex = createTerraceTextures(renderer);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 160);
    camera.position.set(0, 8.5, 15.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 4;
    controls.maxDistance = 28;
    controls.target.set(0, 1.8, 0);
    controls.addEventListener('start', () => {
      cameraPresetTargetRef.current.active = false;
    });

    // Studio 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight('#c4b5fd', '#2e1065', 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fff4e6', 2.1);
    keyLight.position.set(10, 16, 10);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#a78bfa', 1.1);
    rimLight.position.set(-10, 8, -12);
    scene.add(rimLight);

    // Sculpted ground terrace
    const terraceGroup = new THREE.Group();
    const platformGeo = new THREE.CylinderGeometry(13, 14.2, 0.6, 64);
    const platformMat = new THREE.MeshStandardMaterial({
      map: terraceTex.albedo,
      roughnessMap: terraceTex.roughness,
      roughness: 0.72,
      metalness: 0.12,
    });
    const platformMesh = new THREE.Mesh(platformGeo, platformMat);
    platformMesh.position.y = -0.3;
    platformMesh.receiveShadow = true;
    terraceGroup.add(platformMesh);

    const outerFloorGeo = new THREE.CircleGeometry(65, 48);
    outerFloorGeo.rotateX(-Math.PI / 2);
    const outerFloorMat = new THREE.MeshStandardMaterial({
      color: '#170f2b',
      roughness: 0.92,
      metalness: 0.05,
    });
    const outerFloor = new THREE.Mesh(outerFloorGeo, outerFloorMat);
    outerFloor.position.y = -0.62;
    outerFloor.receiveShadow = true;
    terraceGroup.add(outerFloor);

    // Instanced perimeter stone monoliths (> 20 items)
    const monolithCount = 24;
    const monolithGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.2, 6);
    const monolithMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.78,
      metalness: 0.14,
    });
    const monoliths = new THREE.InstancedMesh(
      monolithGeo,
      monolithMat,
      monolithCount
    );
    monoliths.castShadow = !isSoftwareGl;
    monoliths.receiveShadow = true;

    for (let i = 0; i < monolithCount; i++) {
      const angle = (i / monolithCount) * Math.PI * 2;
      const radius = 12.1 + (i % 2) * 0.45;
      const scaleH = 0.85 + ((i * 37) % 30) / 100;
      _scratchVec.set(
        Math.cos(angle) * radius,
        (2.2 * scaleH) / 2,
        Math.sin(angle) * radius
      );
      _scratchQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
      _scratchScale.set(1, scaleH, 1);
      _scratchMat.compose(_scratchVec, _scratchQuat, _scratchScale);
      monoliths.setMatrixAt(i, _scratchMat);
      _scratchColor.setHSL(0.73 + (i % 4) * 0.015, 0.35, 0.32 + (i % 3) * 0.05);
      monoliths.setColorAt(i, _scratchColor);
    }
    monoliths.computeBoundingSphere();
    terraceGroup.add(monoliths);
    scene.add(terraceGroup);

    // Composite 8-part Hero Centerpiece: Task Astrolabe
    const astrolabe = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#ede9fe',
      roughness: 0.68,
      metalness: 0.08,
    });
    const plumMetalMat = new THREE.MeshStandardMaterial({
      color: '#3b0764',
      roughness: 0.32,
      metalness: 0.72,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#e6b85c',
      roughness: 0.18,
      metalness: 0.92,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#ddd6fe',
      roughness: 0.08,
      metalness: 0.0,
      transmission: isSoftwareGl ? 0 : 0.86,
      transparent: true,
      opacity: isSoftwareGl ? 0.38 : 1,
      ior: 1.52,
      thickness: 1.1,
      depthWrite: false,
    });

    // 1. Base tier
    const baseTier1 = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.6, 0.35, 32),
      stoneMat
    );
    baseTier1.position.y = 0.175;
    baseTier1.castShadow = true;
    baseTier1.receiveShadow = true;
    astrolabe.add(baseTier1);

    // 2. Lathe fluted collar
    const collarPoints = [
      new THREE.Vector2(1.5, 0),
      new THREE.Vector2(1.75, 0.15),
      new THREE.Vector2(1.35, 0.45),
      new THREE.Vector2(1.15, 0.85),
      new THREE.Vector2(1.4, 1.05),
      new THREE.Vector2(0.0, 1.05),
    ];
    const collarMesh = new THREE.Mesh(
      new THREE.LatheGeometry(collarPoints, 32),
      plumMetalMat
    );
    collarMesh.position.y = 0.35;
    collarMesh.castShadow = true;
    astrolabe.add(collarMesh);

    // 3. Contact shadow under astrolabe
    const astroShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 6.2),
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        depthWrite: false,
      })
    );
    astroShadow.rotation.x = -Math.PI / 2;
    astroShadow.position.y = 0.02;
    astrolabe.add(astroShadow);

    // 4-6. Three concentric orbital rings
    const ringOuter = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.075, 16, 64),
      goldMat
    );
    ringOuter.position.y = 2.65;
    ringOuter.castShadow = true;
    astrolabe.add(ringOuter);

    const ringMid = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.065, 16, 56),
      plumMetalMat
    );
    ringMid.position.y = 2.65;
    ringMid.castShadow = true;
    astrolabe.add(ringMid);

    const ringInner = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.055, 16, 48),
      goldMat
    );
    ringInner.position.y = 2.65;
    astrolabe.add(ringInner);

    // 7. Inner glowing amethyst crystal core
    const coreMat = new THREE.MeshStandardMaterial({
      color: '#8b5cf6',
      emissive: '#6d28d9',
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0.35,
    });
    const coreCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      coreMat
    );
    coreCrystal.position.y = 2.65;
    astrolabe.add(coreCrystal);

    // 8. Glass dome shell
    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.88, 32, 24),
      glassMat
    );
    glassDome.position.y = 2.65;
    glassDome.renderOrder = 2;
    astrolabe.add(glassDome);

    // Cardinal beveled pillars
    const finialShape = new THREE.Shape();
    finialShape.moveTo(-0.12, 0);
    finialShape.lineTo(0.12, 0);
    finialShape.lineTo(0.06, 0.75);
    finialShape.lineTo(-0.06, 0.75);
    finialShape.closePath();
    const finialGeo = new THREE.ExtrudeGeometry(finialShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    finialGeo.center();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const finial = new THREE.Mesh(finialGeo, goldMat);
      finial.position.set(Math.cos(a) * 1.9, 0.72, Math.sin(a) * 1.9);
      finial.rotation.y = -a;
      finial.castShadow = true;
      astrolabe.add(finial);
    }

    scene.add(astrolabe);

    // Task Beacons Group
    const beaconsGroup = new THREE.Group();
    scene.add(beaconsGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let clickableMeshes: THREE.Object3D[] = [];
    let beaconEntries: Array<{
      group: THREE.Group;
      spire: THREE.Mesh;
      halo: THREE.Mesh;
      baseRadius: number;
      angle: number;
      task: Task;
    }> = [];

    const rebuildBeacons = (currentTasks: Task[]) => {
      while (beaconsGroup.children.length > 0) {
        const child = beaconsGroup.children[0];
        beaconsGroup.remove(child);
      }
      clickableMeshes = [];
      beaconEntries = [];

      const displayTasks = currentTasks.slice(0, 18);
      if (displayTasks.length === 0) return;

      displayTasks.forEach((task, idx) => {
        const angle = (idx / displayTasks.length) * Math.PI * 2;
        const baseRadius = 5.4 + (idx % 2) * 1.3;
        const g = new THREE.Group();
        g.position.set(
          Math.cos(angle) * baseRadius,
          0,
          Math.sin(angle) * baseRadius
        );

        const statusColor =
          task.status === 'Completed'
            ? '#16a34a'
            : task.status === 'In Progress'
            ? '#7c3aed'
            : task.priority === 'High'
            ? '#e11d48'
            : '#d97706';

        // Part 1: Stone plinth
        const plinth = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.56, 0.28, 8),
          stoneMat
        );
        plinth.position.y = 0.14;
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        g.add(plinth);

        // Part 2: Metallic collar
        const bCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.4, 0.14, 8),
          plumMetalMat
        );
        bCollar.position.y = 0.35;
        g.add(bCollar);

        // Part 3: Crystal spire
        const spireHeight =
          task.priority === 'High' ? 1.55 : task.priority === 'Medium' ? 1.2 : 0.95;
        const spireMat = new THREE.MeshStandardMaterial({
          color: statusColor,
          emissive: statusColor,
          emissiveIntensity: task.status === 'Completed' ? 0.25 : 0.45,
          roughness: 0.2,
          metalness: 0.28,
        });
        const spire = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.36, 0),
          spireMat
        );
        spire.scale.set(1, spireHeight / 0.72, 1);
        spire.position.y = 0.55 + spireHeight * 0.55;
        spire.castShadow = true;
        spire.userData.taskId = task.id;
        g.add(spire);
        clickableMeshes.push(spire);

        // Part 4: Priority halo
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.52, 0.035, 10, 32),
          goldMat
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 0.55 + spireHeight * 0.55;
        g.add(halo);

        // Contact shadow
        const bShadow = new THREE.Mesh(
          new THREE.PlaneGeometry(1.5, 1.5),
          new THREE.MeshBasicMaterial({
            map: contactTex,
            transparent: true,
            depthWrite: false,
          })
        );
        bShadow.rotation.x = -Math.PI / 2;
        bShadow.position.y = 0.02;
        g.add(bShadow);

        beaconsGroup.add(g);
        beaconEntries.push({
          group: g,
          spire,
          halo,
          baseRadius,
          angle,
          task,
        });
      });
    };

    let lastTaskSignature = '';
    const syncTasksIfChanged = () => {
      const sig = tasksRef.current
        .slice(0, 18)
        .map((t) => `${t.id}:${t.status}:${t.priority}`)
        .join('|');
      if (sig !== lastTaskSignature) {
        lastTaskSignature = sig;
        rebuildBeacons(tasksRef.current);
      }
    };
    syncTasksIfChanged();

    const handlePointerClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.taskId as string | undefined;
        const found = tasksRef.current.find((t) => t.id === hitId) ?? null;
        setInspectedTask(found);
      }
    };

    let lastMove = 0;
    const handlePointerMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastMove < 50) return;
      lastMove = now;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('click', handlePointerClick);
    renderer.domElement.addEventListener('mousemove', handlePointerMove);

    const handleResize = () => {
      const w = container.clientWidth || 900;
      const h = container.clientHeight || 580;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let currentExplode = 0;
    let frameId = 0;
    let disposed = false;

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      syncTasksIfChanged();

      // Smooth exponential damping for exploded view & lighting
      currentExplode = THREE.MathUtils.damp(
        currentExplode,
        explodeTargetRef.current,
        5,
        dt
      );
      ringOuter.position.y = 2.65 + currentExplode * 1.4;
      ringMid.position.y = 2.65 + currentExplode * 0.7;
      ringInner.position.y = 2.65 - currentExplode * 0.5;
      glassDome.position.y = 2.65 + currentExplode * 2.1;

      ringOuter.rotation.x = elapsed * 0.35;
      ringOuter.rotation.y = elapsed * 0.25;
      ringMid.rotation.y = -elapsed * 0.48;
      ringMid.rotation.z = elapsed * 0.22;
      ringInner.rotation.x = -elapsed * 0.6;
      coreCrystal.rotation.y = elapsed * 0.8;
      coreCrystal.position.y = 2.65 + Math.sin(elapsed * 1.8) * 0.1;

      for (const entry of beaconEntries) {
        const targetR = entry.baseRadius + currentExplode * 2.4;
        entry.group.position.x = Math.cos(entry.angle) * targetR;
        entry.group.position.z = Math.sin(entry.angle) * targetR;
        entry.spire.rotation.y = elapsed * 0.9 + entry.angle;
        entry.halo.rotation.z = elapsed * 1.1;
        entry.halo.rotation.x = Math.PI / 2 + Math.sin(elapsed + entry.angle) * 0.25;
      }

      // Atmosphere transition
      const isDay = lightingRef.current === 'daylight';
      const targetBg = isDay ? dayBg : duskBg;
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(targetBg, 1 - Math.exp(-4 * dt));
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(
          scene.background instanceof THREE.Color ? scene.background : duskBg
        );
      }
      hemiLight.intensity = THREE.MathUtils.damp(
        hemiLight.intensity,
        isDay ? 1.25 : 0.75,
        4,
        dt
      );

      // Camera preset damping
      if (cameraPresetTargetRef.current.active) {
        const alpha = 1 - Math.exp(-5 * dt);
        camera.position.lerp(cameraPresetTargetRef.current.pos, alpha);
        controls.target.lerp(cameraPresetTargetRef.current.target, alpha);
        if (
          camera.position.distanceTo(cameraPresetTargetRef.current.pos) < 0.05
        ) {
          cameraPresetTargetRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        scheduleAfterDraw(renderer, tick, (id) => {
          frameId = id;
        });
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handlePointerClick);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      controls.dispose();
      envTexture.dispose();
      contactTex.dispose();
      terraceTex.albedo.dispose();
      terraceTex.roughness.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglFallback) {
    return (
      <div className="rounded-xl border border-[#E4DCF5] bg-white p-10 text-center">
        <Layers className="mx-auto h-10 w-10 text-[#4C1D95]" />
        <h2 className="mt-3 font-display text-lg font-bold text-[#1F1235]">
          3D Observatory Unavailable
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#5B4F73]">
          Your browser environment does not currently expose WebGL rendering.
          Switch back to Tasks or Map view to continue managing your workspace.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-[#E4DCF5] bg-[#19102e]"
      style={{ height: '620px' }}
    >
      <div ref={mountRef} className="h-full w-full" />

      {/* Minimal top-left static spec HUD (no backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-[#3B2667] bg-[#1F1235]/90 px-3.5 py-2 text-white">
        <p className="font-display text-xs font-bold tracking-wide">
          3D Task Observatory
        </p>
        <p className="mt-0.5 text-[11px] text-[#D8CCF5] tabular-nums">
          {Math.min(tasks.length, 18)} active task beacons · Drag to orbit · Click
          a crystal
        </p>
      </div>

      {/* Inspected Task Quick Card */}
      {inspectedTask && (
        <div className="absolute right-4 top-4 w-72 rounded-xl border border-[#4C3482] bg-[#1F1235]/95 p-4 text-white shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-sm font-bold leading-snug">
              {inspectedTask.title}
            </h3>
            <button
              type="button"
              onClick={() => setInspectedTask(null)}
              className="text-xs text-[#C4B5FD] hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-xs text-[#D8CCF5]">
            {inspectedTask.priority} Priority · {inspectedTask.status}
          </p>
          {inspectedTask.description && (
            <p className="mt-2 line-clamp-2 text-xs text-[#E9E2FA]">
              {inspectedTask.description}
            </p>
          )}
          <button
            type="button"
            onClick={async () => {
              const next: TaskStatus =
                inspectedTask.status === 'Completed' ? 'Pending' : 'Completed';
              await onToggleTaskStatus(inspectedTask, next);
              setInspectedTask({ ...inspectedTask, status: next });
            }}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#6D28D9] px-3 text-xs font-semibold text-white hover:bg-[#7C3AED] transition-colors cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {inspectedTask.status === 'Completed'
                ? 'Reopen Task'
                : 'Mark Completed'}
            </span>
          </button>
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 inline-flex items-center gap-1.5 rounded-lg border border-[#4C3482] bg-[#1F1235]/95 px-3 py-1 text-xs font-medium text-[#E9E2FA] hover:bg-[#2B1B4A] transition-colors cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-[#4C3482] bg-[#1F1235]/95 px-4 py-2.5 text-xs text-white shadow-lg">
            <label className="flex items-center gap-2">
              <span className="font-medium text-[#D8CCF5] whitespace-nowrap">
                Orbital Spread
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={explodeFactor}
                onChange={(e) => setExplodeFactor(Number(e.target.value))}
                className="w-24 accent-[#A78bfa] cursor-pointer"
              />
            </label>

            <div className="h-4 w-px bg-[#3B2667]" />

            <div className="flex items-center gap-1">
              {(['overview', 'astrolabe', 'overhead'] as CameraPreset[]).map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyCameraPreset(preset)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors cursor-pointer ${
                      cameraPreset === preset
                        ? 'bg-[#6D28D9] text-white'
                        : 'text-[#D8CCF5] hover:bg-[#2B1B4A]'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>{preset}</span>
                  </button>
                )
              )}
            </div>

            <div className="h-4 w-px bg-[#3B2667]" />

            <button
              type="button"
              onClick={() =>
                setLightingPreset((prev) =>
                  prev === 'dusk' ? 'daylight' : 'dusk'
                )
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-[#4C3482] bg-[#2B1B4A] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#3B2667] transition-colors cursor-pointer"
            >
              {lightingPreset === 'dusk' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-[#FBBF24]" />
                  <span>Daylight</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-[#C4B5FD]" />
                  <span>Lavender Dusk</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
