import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { GameScore } from '../types/task';
import {
  applyStudioEnvironment,
  createContactShadowTexture,
  createStudioRenderer,
  createTerraceTextures,
  detectSoftwareWebGL,
  scheduleAfterDraw,
} from '../three/webglUtils';

interface GameArena3DProps {
  highScores: GameScore[];
  onSaveScore: (payload: {
    score: number;
    wave: number;
    coresCollected: number;
  }) => Promise<void>;
  onExit: () => void;
}

type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

interface HudSnapshot {
  score: number;
  wave: number;
  shields: number;
  coresCollected: number;
  dashReady: boolean;
}

class ProceduralSfx {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtor) {
        this.ctx = new AudioCtor();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  playPickup(isPrism: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isPrism ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isPrism ? 660 : 523.25, now);
    osc.frequency.exponentialRampToValueAtTime(isPrism ? 1320 : 880, now + 0.14);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playDash() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.16);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playHit() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.24);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  playWaveClear() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.23);
    });
  }
}

const _pDummy = new THREE.Object3D();
const _vecA = new THREE.Vector3();

export function GameArena3D({
  highScores,
  onSaveScore,
  onExit,
}: GameArena3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sfxRef = useRef(new ProceduralSfx());
  const onSaveScoreRef = useRef(onSaveScore);
  onSaveScoreRef.current = onSaveScore;

  const [phase, setPhase] = useState<GamePhase>('title');
  const phaseRef = useRef<GamePhase>('title');
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>({
    score: 0,
    wave: 1,
    shields: 3,
    coresCollected: 0,
    dashReady: true,
  });

  const virtualInputRef = useRef({ x: 0, z: 0, dashRequested: false });
  const resetRunFnRef = useRef<(() => void) | null>(null);

  const setPhaseSynced = useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const startMission = useCallback(() => {
    resetRunFnRef.current?.();
    setPhaseSynced('playing');
  }, [setPhaseSynced]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      sfxRef.current.muted = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = createStudioRenderer(width, height, isSoftwareGl);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#130b24');
    scene.fog = new THREE.FogExp2('#130b24', 0.02);

    const envTex = applyStudioEnvironment(scene, renderer);
    const contactTex = createContactShadowTexture();
    const terraceTex = createTerraceTextures(renderer);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 140);
    camera.position.set(0, 12, 16);

    const hemi = new THREE.HemisphereLight('#c4b5fd', '#1e0b3a', 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fff2df', 2.0);
    keyLight.position.set(12, 18, 12);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const ARENA_RADIUS = 13.2;

    // Ground Arena
    const arenaMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(ARENA_RADIUS + 0.8, ARENA_RADIUS + 1.6, 0.8, 64),
      new THREE.MeshStandardMaterial({
        map: terraceTex.albedo,
        roughnessMap: terraceTex.roughness,
        roughness: 0.72,
        metalness: 0.14,
      })
    );
    arenaMesh.position.y = -0.4;
    arenaMesh.receiveShadow = true;
    scene.add(arenaMesh);

    const boundaryRing = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA_RADIUS + 0.15, 0.12, 12, 72),
      new THREE.MeshStandardMaterial({
        color: '#8b5cf6',
        emissive: '#6d28d9',
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.6,
      })
    );
    boundaryRing.rotation.x = Math.PI / 2;
    boundaryRing.position.y = 0.08;
    scene.add(boundaryRing);

    // Composite 7-Part Player Hover-Skiff
    const playerGroup = new THREE.Group();
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 1.05);
    hullShape.lineTo(0.55, -0.45);
    hullShape.lineTo(0.28, -0.85);
    hullShape.lineTo(-0.28, -0.85);
    hullShape.lineTo(-0.55, -0.45);
    hullShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.center();

    const hullMat = new THREE.MeshStandardMaterial({
      color: '#f5f3ff',
      roughness: 0.25,
      metalness: 0.65,
    });
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.position.y = 0.75;
    hullMesh.castShadow = true;
    playerGroup.add(hullMesh);

    const visorMat = new THREE.MeshPhysicalMaterial({
      color: '#3b0764',
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1,
    });
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 20, 16),
      visorMat
    );
    canopy.scale.set(0.8, 0.55, 1.35);
    canopy.position.set(0, 0.94, 0.05);
    playerGroup.add(canopy);

    const nacelleMat = new THREE.MeshStandardMaterial({
      color: '#4c1d95',
      roughness: 0.45,
      metalness: 0.45,
    });
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0ea5e9',
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    [-0.58, 0.58].forEach((sideX) => {
      const nacelle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.14, 0.95, 12),
        nacelleMat
      );
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(sideX, 0.72, -0.2);
      nacelle.castShadow = true;
      playerGroup.add(nacelle);

      const nozzle = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.26, 12),
        nozzleMat
      );
      nozzle.rotation.x = -Math.PI / 2;
      nozzle.position.set(sideX, 0.72, -0.78);
      playerGroup.add(nozzle);
    });

    const dorsalFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.36, 0.52),
      nacelleMat
    );
    dorsalFin.position.set(0, 1.05, -0.45);
    playerGroup.add(dorsalFin);

    const playerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.1),
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        depthWrite: false,
      })
    );
    playerShadow.rotation.x = -Math.PI / 2;
    playerShadow.position.y = 0.02;
    playerGroup.add(playerShadow);

    scene.add(playerGroup);

    // Collectibles (Focus Core + Priority Prism)
    const coreGroup = new THREE.Group();
    const coreGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#d97706',
        emissiveIntensity: 0.75,
        roughness: 0.15,
        metalness: 0.8,
      })
    );
    coreGem.position.y = 0.85;
    coreGroup.add(coreGem);

    const coreOrbit = new THREE.Mesh(
      new THREE.TorusGeometry(0.66, 0.04, 10, 32),
      new THREE.MeshStandardMaterial({
        color: '#fde68a',
        emissive: '#f59e0b',
        emissiveIntensity: 0.5,
      })
    );
    coreOrbit.position.y = 0.85;
    coreGroup.add(coreOrbit);
    scene.add(coreGroup);

    // Sentinel Drones (5-part composite hazards)
    interface SentinelEntity {
      group: THREE.Group;
      ringA: THREE.Mesh;
      ringB: THREE.Mesh;
      telegraph: THREE.Mesh;
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      state: 'patrol' | 'windup' | 'lunge';
      stateTimer: number;
      lungeDir: THREE.Vector3;
    }

    const sentinels: SentinelEntity[] = [];
    const sentinelsContainer = new THREE.Group();
    scene.add(sentinelsContainer);

    const spawnSentinel = (index: number): SentinelEntity => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 18, 14),
        new THREE.MeshStandardMaterial({
          color: '#1f1235',
          roughness: 0.35,
          metalness: 0.75,
        })
      );
      body.position.y = 0.85;
      body.castShadow = true;
      g.add(body);

      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        new THREE.MeshStandardMaterial({
          color: '#fb7185',
          emissive: '#e11d48',
          emissiveIntensity: 1.5,
        })
      );
      eye.position.set(0, 0.85, 0.35);
      g.add(eye);

      const ringMat = new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#be123c',
        emissiveIntensity: 0.6,
        metalness: 0.7,
        roughness: 0.25,
      });
      const ringA = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.05, 10, 28),
        ringMat
      );
      ringA.position.y = 0.85;
      g.add(ringA);

      const ringB = new THREE.Mesh(
        new THREE.TorusGeometry(0.82, 0.04, 10, 28),
        ringMat
      );
      ringB.position.y = 0.85;
      g.add(ringB);

      const telegraph = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 1.05, 32),
        new THREE.MeshBasicMaterial({
          color: '#f43f5e',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
        })
      );
      telegraph.rotation.x = -Math.PI / 2;
      telegraph.position.y = 0.04;
      g.add(telegraph);

      const angle = (index * 2.1) % (Math.PI * 2);
      const pos = new THREE.Vector3(
        Math.cos(angle) * 8.5,
        0,
        Math.sin(angle) * 8.5
      );
      g.position.copy(pos);
      sentinelsContainer.add(g);

      return {
        group: g,
        ringA,
        ringB,
        telegraph,
        pos,
        vel: new THREE.Vector3(Math.cos(angle + 1.2) * 3.2, 0, Math.sin(angle + 1.2) * 3.2),
        state: 'patrol',
        stateTimer: 1.5 + index * 0.6,
        lungeDir: new THREE.Vector3(0, 0, 1),
      };
    };

    // Pooled Particle Burst InstancedMesh
    const PARTICLE_COUNT = 80;
    const particleGeo = new THREE.OctahedronGeometry(0.14, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const particleMesh = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      PARTICLE_COUNT
    );
    particleMesh.frustumCulled = false;
    scene.add(particleMesh);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      pos: new THREE.Vector3(0, -100, 0),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 0.4,
      color: new THREE.Color('#fbbf24'),
    }));
    let particleCursor = 0;

    const spawnBurst = (origin: THREE.Vector3, colorHex: string, count: number) => {
      for (let i = 0; i < count; i++) {
        const p = particles[particleCursor % PARTICLE_COUNT];
        particleCursor++;
        p.pos.copy(origin);
        p.pos.y = 0.85;
        const a = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * 5.5;
        p.vel.set(Math.cos(a) * spd, 2 + Math.random() * 3.5, Math.sin(a) * spd);
        p.life = 0.35 + Math.random() * 0.25;
        p.maxLife = p.life;
        p.color.set(colorHex);
      }
    };

    // Game Simulation State
    const sim = {
      playerPos: new THREE.Vector3(0, 0, 0),
      playerVel: new THREE.Vector3(0, 0, 0),
      playerFacing: 0,
      dashCooldown: 0,
      dashTimer: 0,
      invulnTimer: 0,
      hitstopTimer: 0,
      shakeIntensity: 0,
      squashY: 1,
      score: 0,
      wave: 1,
      shields: 3,
      coresCollected: 0,
      waveProgress: 0,
      isPrism: false,
      corePos: new THREE.Vector3(4.5, 0, -4.5),
    };

    const placeNextCore = () => {
      let attempts = 0;
      do {
        const angle = Math.random() * Math.PI * 2;
        const r = 2.5 + Math.random() * (ARENA_RADIUS - 3.5);
        sim.corePos.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        attempts++;
      } while (
        sim.corePos.distanceTo(sim.playerPos) < 4.5 &&
        attempts < 10
      );
      sim.isPrism = (sim.coresCollected + 1) % 4 === 0;
      const mat = coreGem.material as THREE.MeshStandardMaterial;
      mat.color.set(sim.isPrism ? '#38bdf8' : '#fbbf24');
      mat.emissive.set(sim.isPrism ? '#0284c7' : '#d97706');
      coreGroup.position.copy(sim.corePos);
    };

    const syncSentinelsCount = (targetCount: number) => {
      while (sentinels.length < targetCount) {
        sentinels.push(spawnSentinel(sentinels.length));
      }
      while (sentinels.length > targetCount) {
        const removed = sentinels.pop();
        if (removed) sentinelsContainer.remove(removed.group);
      }
    };

    const pushHud = () => {
      setHud({
        score: sim.score,
        wave: sim.wave,
        shields: sim.shields,
        coresCollected: sim.coresCollected,
        dashReady: sim.dashCooldown <= 0,
      });
    };

    const resetRun = () => {
      sim.playerPos.set(0, 0, 0);
      sim.playerVel.set(0, 0, 0);
      sim.playerFacing = 0;
      sim.dashCooldown = 0;
      sim.dashTimer = 0;
      sim.invulnTimer = 0.8;
      sim.hitstopTimer = 0;
      sim.shakeIntensity = 0;
      sim.squashY = 1;
      sim.score = 0;
      sim.wave = 1;
      sim.shields = 3;
      sim.coresCollected = 0;
      sim.waveProgress = 0;
      syncSentinelsCount(2);
      placeNextCore();
      pushHud();
    };
    resetRunFnRef.current = resetRun;
    resetRun();

    // Keyboard Input (held vs justPressed + blur cleanup)
    const heldKeys: Record<string, boolean> = {};
    let dashQueued = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!heldKeys[e.code]) {
        if (e.code === 'Space') {
          if (phaseRef.current === 'title') {
            startMission();
            return;
          }
          dashQueued = true;
        }
        if (e.code === 'Enter' && phaseRef.current === 'title') {
          startMission();
          return;
        }
        if (e.code === 'Escape') {
          if (phaseRef.current === 'playing') {
            setPhaseSynced('paused');
          } else if (phaseRef.current === 'paused') {
            setPhaseSynced('playing');
          }
        }
      }
      heldKeys[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeys[e.code] = false;
    };

    const handleWindowBlur = () => {
      for (const k of Object.keys(heldKeys)) {
        heldKeys[k] = false;
      }
      virtualInputRef.current.x = 0;
      virtualInputRef.current.z = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let hudTimer = 0;

    const tick = () => {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.elapsedTime;

      if (phaseRef.current === 'title') {
        const panAngle = elapsed * 0.25;
        camera.position.set(
          Math.cos(panAngle) * 14,
          7.5 + Math.sin(elapsed * 0.5) * 0.6,
          Math.sin(panAngle) * 14
        );
        camera.lookAt(0, 1.1, 0);
        playerGroup.position.set(0, Math.sin(elapsed * 2.2) * 0.14, 0);
        playerGroup.rotation.set(0, elapsed * 0.35, 0);
        coreGem.rotation.y = elapsed * 1.4;
        coreOrbit.rotation.x = elapsed * 1.1;
      } else if (phaseRef.current === 'playing') {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer -= dt;
        } else {
          // Player movement
          let ix = virtualInputRef.current.x;
          let iz = virtualInputRef.current.z;
          if (heldKeys['KeyW'] || heldKeys['ArrowUp']) iz -= 1;
          if (heldKeys['KeyS'] || heldKeys['ArrowDown']) iz += 1;
          if (heldKeys['KeyA'] || heldKeys['ArrowLeft']) ix -= 1;
          if (heldKeys['KeyD'] || heldKeys['ArrowRight']) ix += 1;

          _vecA.set(ix, 0, iz);
          if (_vecA.lengthSq() > 0.01) {
            _vecA.normalize();
          }

          if (sim.dashCooldown > 0) sim.dashCooldown = Math.max(0, sim.dashCooldown - dt);
          if (sim.dashTimer > 0) sim.dashTimer = Math.max(0, sim.dashTimer - dt);
          if (sim.invulnTimer > 0) sim.invulnTimer = Math.max(0, sim.invulnTimer - dt);

          if ((dashQueued || virtualInputRef.current.dashRequested) && sim.dashCooldown <= 0) {
            sim.dashTimer = 0.2;
            sim.dashCooldown = 1.4;
            sim.invulnTimer = Math.max(sim.invulnTimer, 0.25);
            sim.squashY = 0.68;
            sfxRef.current.playDash();
            spawnBurst(sim.playerPos, '#38bdf8', 12);
          }
          dashQueued = false;
          virtualInputRef.current.dashRequested = false;

          const maxSpeed = sim.dashTimer > 0 ? 19 : 9.2;
          const accel = 1 - Math.exp(-12 * dt);
          sim.playerVel.x = THREE.MathUtils.lerp(
            sim.playerVel.x,
            _vecA.x * maxSpeed,
            accel
          );
          sim.playerVel.z = THREE.MathUtils.lerp(
            sim.playerVel.z,
            _vecA.z * maxSpeed,
            accel
          );

          sim.playerPos.x += sim.playerVel.x * dt;
          sim.playerPos.z += sim.playerVel.z * dt;

          const distFromCenter = Math.hypot(sim.playerPos.x, sim.playerPos.z);
          if (distFromCenter > ARENA_RADIUS - 0.8) {
            const scale = (ARENA_RADIUS - 0.8) / distFromCenter;
            sim.playerPos.x *= scale;
            sim.playerPos.z *= scale;
          }

          if (sim.playerVel.lengthSq() > 0.3) {
            const targetYaw = Math.atan2(sim.playerVel.x, sim.playerVel.z);
            let diff = targetYaw - sim.playerFacing;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            sim.playerFacing += diff * (1 - Math.exp(-14 * dt));
          }

          sim.squashY = THREE.MathUtils.damp(sim.squashY, 1, 12, dt);
          playerGroup.position.set(
            sim.playerPos.x,
            Math.sin(elapsed * 5) * 0.08,
            sim.playerPos.z
          );
          playerGroup.rotation.y = sim.playerFacing;
          playerGroup.rotation.z = -sim.playerVel.x * 0.025;
          playerGroup.scale.set(
            1 + (1 - sim.squashY) * 0.35,
            sim.squashY,
            1 + (1 - sim.squashY) * 0.35
          );

          // Flash hull when invulnerable
          hullMat.emissive.set(
            sim.invulnTimer > 0 && Math.floor(elapsed * 18) % 2 === 0
              ? '#e11d48'
              : '#000000'
          );

          // Core pickup check
          coreGem.rotation.y = elapsed * 2.1;
          coreOrbit.rotation.x = elapsed * 1.6;
          coreOrbit.rotation.y = elapsed * 1.2;
          if (sim.playerPos.distanceTo(sim.corePos) < 1.35) {
            const pts = (sim.isPrism ? 300 : 100) + (sim.wave - 1) * 25;
            sim.score += pts;
            sim.coresCollected += 1;
            sim.waveProgress += 1;
            sim.squashY = 1.28;
            sfxRef.current.playPickup(sim.isPrism);
            spawnBurst(sim.corePos, sim.isPrism ? '#38bdf8' : '#fbbf24', 18);

            if (sim.waveProgress >= 6) {
              sim.wave += 1;
              sim.waveProgress = 0;
              sim.shields = Math.min(3, sim.shields + 1);
              syncSentinelsCount(Math.min(6, 1 + sim.wave));
              sfxRef.current.playWaveClear();
            }
            placeNextCore();
            pushHud();
          }

          // Update Sentinels
          const speedMult = 1 + (sim.wave - 1) * 0.14;
          for (const s of sentinels) {
            s.ringA.rotation.x = elapsed * 2.4;
            s.ringB.rotation.y = -elapsed * 2.8;
            s.stateTimer -= dt;

            const tMat = s.telegraph.material as THREE.MeshBasicMaterial;
            if (s.state === 'patrol') {
              tMat.opacity = 0;
              s.pos.x += s.vel.x * speedMult * dt;
              s.pos.z += s.vel.z * speedMult * dt;
              const d = Math.hypot(s.pos.x, s.pos.z);
              if (d > ARENA_RADIUS - 0.9) {
                const nx = s.pos.x / d;
                const nz = s.pos.z / d;
                const dot = s.vel.x * nx + s.vel.z * nz;
                s.vel.x -= 2 * dot * nx;
                s.vel.z -= 2 * dot * nz;
                s.pos.x = nx * (ARENA_RADIUS - 0.95);
                s.pos.z = nz * (ARENA_RADIUS - 0.95);
              }
              if (s.stateTimer <= 0) {
                s.state = 'windup';
                s.stateTimer = 0.65;
                s.lungeDir.copy(sim.playerPos).sub(s.pos).setY(0).normalize();
              }
            } else if (s.state === 'windup') {
              tMat.opacity = 0.45 + Math.sin(elapsed * 22) * 0.25;
              const pulseScale = 1 + (0.65 - s.stateTimer) * 0.8;
              s.telegraph.scale.setScalar(pulseScale);
              if (s.stateTimer <= 0) {
                s.state = 'lunge';
                s.stateTimer = 0.55;
                tMat.opacity = 0;
                s.telegraph.scale.setScalar(1);
              }
            } else {
              s.pos.addScaledVector(s.lungeDir, 11.5 * speedMult * dt);
              const d = Math.hypot(s.pos.x, s.pos.z);
              if (d > ARENA_RADIUS - 0.9) {
                s.pos.multiplyScalar((ARENA_RADIUS - 0.9) / d);
                s.stateTimer = 0;
              }
              if (s.stateTimer <= 0) {
                s.state = 'patrol';
                s.stateTimer = 1.6 + Math.random() * 1.4;
              }
            }

            s.group.position.copy(s.pos);
            s.group.lookAt(sim.playerPos.x, 0, sim.playerPos.z);

            if (sim.invulnTimer <= 0 && s.pos.distanceTo(sim.playerPos) < 1.12) {
              sim.shields -= 1;
              sim.invulnTimer = 1.3;
              sim.hitstopTimer = 0.055;
              sim.shakeIntensity = 0.55;
              sfxRef.current.playHit();
              spawnBurst(sim.playerPos, '#f43f5e', 22);
              pushHud();

              if (sim.shields <= 0) {
                setPhaseSynced('gameover');
                void onSaveScoreRef.current({
                  score: sim.score,
                  wave: sim.wave,
                  coresCollected: sim.coresCollected,
                });
                break;
              }
            }
          }
        }

        // Update particles
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const p = particles[i];
          if (p.life > 0) {
            p.life -= dt;
            p.vel.y -= 9.5 * dt;
            p.pos.addScaledVector(p.vel, dt);
            const s = Math.max(0, p.life / p.maxLife);
            _pDummy.position.copy(p.pos);
            _pDummy.scale.setScalar(s);
            _pDummy.updateMatrix();
            particleMesh.setMatrixAt(i, _pDummy.matrix);
            particleMesh.setColorAt(i, p.color);
          } else {
            _pDummy.position.set(0, -100, 0);
            _pDummy.scale.setScalar(0.001);
            _pDummy.updateMatrix();
            particleMesh.setMatrixAt(i, _pDummy.matrix);
          }
        }
        particleMesh.instanceMatrix.needsUpdate = true;
        if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;

        // Smooth Chase Camera + Shake
        sim.shakeIntensity = Math.max(0, sim.shakeIntensity - dt * 2.2);
        const sx = (Math.random() - 0.5) * sim.shakeIntensity;
        const sy = (Math.random() - 0.5) * sim.shakeIntensity;

        const desiredCamX = sim.playerPos.x * 0.55 + sx;
        const desiredCamY = 12.2 + sy;
        const desiredCamZ = sim.playerPos.z * 0.55 + 13.8;
        const camAlpha = 1 - Math.exp(-6 * dt);
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredCamX, camAlpha);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredCamY, camAlpha);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredCamZ, camAlpha);
        camera.lookAt(sim.playerPos.x * 0.7, 0.7, sim.playerPos.z * 0.7);

        hudTimer += dt;
        if (hudTimer >= 0.1) {
          hudTimer = 0;
          pushHud();
        }
      }

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
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', handleResize);
      envTextureCleanup(envTex, contactTex, terraceTex);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [setPhaseSynced, startMission]);

  return (
    <div className="fixed inset-0 z-50 bg-[#130b24] text-white select-none">
      <div ref={mountRef} className="h-full w-full" />

      {/* Playing Perimeter HUD (pointer-events-none wrapper, no backdrop-filter over WebGL) */}
      {phase === 'playing' && (
        <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg border border-[#4C3482] bg-[#1F1235]/90 px-3.5 py-2">
                <p className="text-[11px] font-medium text-[#C4B5FD]">SCORE</p>
                <p className="font-mono-tabular text-xl font-bold tabular-nums">
                  {hud.score}
                </p>
              </div>
              <div className="rounded-lg border border-[#4C3482] bg-[#1F1235]/90 px-3.5 py-2">
                <p className="text-[11px] font-medium text-[#C4B5FD]">WAVE</p>
                <p className="font-mono-tabular text-xl font-bold tabular-nums">
                  {hud.wave}
                </p>
              </div>
              <div className="rounded-lg border border-[#4C3482] bg-[#1F1235]/90 px-3.5 py-2">
                <p className="text-[11px] font-medium text-[#C4B5FD]">SHIELD</p>
                <p className="font-mono-tabular text-xl font-bold tabular-nums">
                  {hud.shields} / 3
                </p>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#4C3482] bg-[#1F1235]/90 text-white hover:bg-[#2B1B4A] cursor-pointer"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setPhaseSynced('paused')}
                aria-label="Pause game"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#4C3482] bg-[#1F1235]/90 px-3 text-xs font-semibold text-white hover:bg-[#2B1B4A] cursor-pointer"
              >
                <Pause className="h-4 w-4" />
                <span>Pause</span>
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="rounded-lg border border-[#4C3482] bg-[#1F1235]/90 px-3.5 py-2 text-xs font-medium text-[#E9E2FA]">
              Dash: {hud.dashReady ? 'Ready (Space)' : 'Recharging...'} · Cores:{' '}
              <span className="font-mono-tabular">{hud.coresCollected}</span>
            </div>

            {/* Mobile touch pad */}
            <div className="pointer-events-auto flex items-center gap-2 sm:hidden">
              <div className="grid grid-cols-3 gap-1">
                <div />
                <button
                  type="button"
                  onPointerDown={() => (virtualInputRef.current.z = -1)}
                  onPointerUp={() => (virtualInputRef.current.z = 0)}
                  onPointerLeave={() => (virtualInputRef.current.z = 0)}
                  className="h-11 w-11 rounded-lg bg-[#2B1B4A] text-sm font-bold"
                >
                  W
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={() => (virtualInputRef.current.x = -1)}
                  onPointerUp={() => (virtualInputRef.current.x = 0)}
                  onPointerLeave={() => (virtualInputRef.current.x = 0)}
                  className="h-11 w-11 rounded-lg bg-[#2B1B4A] text-sm font-bold"
                >
                  A
                </button>
                <button
                  type="button"
                  onPointerDown={() => (virtualInputRef.current.z = 1)}
                  onPointerUp={() => (virtualInputRef.current.z = 0)}
                  onPointerLeave={() => (virtualInputRef.current.z = 0)}
                  className="h-11 w-11 rounded-lg bg-[#2B1B4A] text-sm font-bold"
                >
                  S
                </button>
                <button
                  type="button"
                  onPointerDown={() => (virtualInputRef.current.x = 1)}
                  onPointerUp={() => (virtualInputRef.current.x = 0)}
                  onPointerLeave={() => (virtualInputRef.current.x = 0)}
                  className="h-11 w-11 rounded-lg bg-[#2B1B4A] text-sm font-bold"
                >
                  D
                </button>
              </div>
              <button
                type="button"
                onClick={() => (virtualInputRef.current.dashRequested = true)}
                className="h-12 rounded-lg bg-[#6D28D9] px-4 text-xs font-bold"
              >
                DASH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title Screen */}
      {phase === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none">
          <div className="flex items-start justify-between">
            <div className="pointer-events-auto">
              <button
                type="button"
                onClick={onExit}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#4C3482] bg-[#1F1235]/95 px-4 text-xs font-semibold text-[#E9E2FA] hover:bg-[#2B1B4A] cursor-pointer"
              >
                <X className="h-4 w-4" />
                <span>Back to Tasks</span>
              </button>
            </div>

            {highScores.length > 0 && (
              <div className="pointer-events-auto rounded-xl border border-[#4C3482] bg-[#1F1235]/95 px-4 py-3 text-xs">
                <div className="flex items-center gap-1.5 font-display font-bold text-[#FBBF24]">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Best Runs (PostgreSQL)</span>
                </div>
                <ul className="mt-2 space-y-1 font-mono-tabular text-[#E9E2FA]">
                  {highScores.slice(0, 3).map((s, idx) => (
                    <li key={s.id} className="flex justify-between gap-4">
                      <span>#{idx + 1} Wave {s.wave}</span>
                      <span className="font-semibold">{s.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mx-auto max-w-xl text-center pointer-events-auto">
            <svg
              viewBox="0 0 420 76"
              className="mx-auto h-16 w-auto"
              aria-label="Starlight Courier 3D"
            >
              <text
                x="210"
                y="42"
                textAnchor="middle"
                fill="#FFFFFF"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="700"
                fontSize="32"
                letterSpacing="3"
              >
                STARLIGHT COURIER
              </text>
              <text
                x="210"
                y="66"
                textAnchor="middle"
                fill="#C4B5FD"
                fontFamily="DM Sans, sans-serif"
                fontWeight="500"
                fontSize="13"
                letterSpacing="4"
              >
                3D ARENA FOCUS RUNNER
              </text>
            </svg>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={startMission}
                className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-[#6D28D9] px-8 text-sm font-bold text-white hover:bg-[#7C3AED] transition-colors cursor-pointer"
              >
                <Play className="h-4 w-4" />
                <span>Start Mission</span>
              </button>
            </div>

            <p className="mt-4 text-xs text-[#D8CCF5]">
              WASD / Arrows Move · Space Dash · Esc Pause
            </p>
          </div>

          <div className="h-4" />
        </div>
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#130b24]/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#4C3482] bg-[#1F1235] p-6 text-center">
            <h2 className="font-display text-xl font-bold">Mission Paused</h2>
            <p className="mt-1 text-sm text-[#C4B5FD] tabular-nums">
              Score {hud.score} · Wave {hud.wave}
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPhaseSynced('playing')}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#6D28D9] text-sm font-semibold text-white hover:bg-[#7C3AED] cursor-pointer"
              >
                <Play className="h-4 w-4" />
                <span>Resume</span>
              </button>
              <button
                type="button"
                onClick={startMission}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#4C3482] bg-[#2B1B4A] text-sm font-semibold text-white hover:bg-[#3B2667] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Restart</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#4C3482] text-sm font-medium text-[#D8CCF5] hover:bg-[#2B1B4A] cursor-pointer"
              >
                Exit to Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {phase === 'gameover' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#130b24]/85 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#4C3482] bg-[#1F1235] p-6 text-center">
            <Trophy className="mx-auto h-9 w-9 text-[#FBBF24]" />
            <h2 className="mt-3 font-display text-2xl font-bold">
              Mission Complete
            </h2>
            <p className="mt-1 text-xs text-[#C4B5FD]">
              Your score has been saved to PostgreSQL.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-[#3B2667] bg-[#150c26] p-4 font-mono-tabular">
              <div>
                <p className="text-[11px] text-[#C4B5FD]">SCORE</p>
                <p className="mt-1 text-lg font-bold">{hud.score}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#C4B5FD]">WAVE</p>
                <p className="mt-1 text-lg font-bold">{hud.wave}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#C4B5FD]">CORES</p>
                <p className="mt-1 text-lg font-bold">{hud.coresCollected}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onExit}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-[#4C3482] text-sm font-medium text-[#D8CCF5] hover:bg-[#2B1B4A] cursor-pointer"
              >
                Exit
              </button>
              <button
                type="button"
                onClick={startMission}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#6D28D9] text-sm font-semibold text-white hover:bg-[#7C3AED] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function envTextureCleanup(
  envTex: THREE.Texture,
  contactTex: THREE.Texture,
  terraceTex: { albedo: THREE.Texture; roughness: THREE.Texture }
) {
  envTex.dispose();
  contactTex.dispose();
  terraceTex.albedo.dispose();
  terraceTex.roughness.dispose();
}
