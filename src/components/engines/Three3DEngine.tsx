import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  LiveInputState,
  StageCompletionPayload,
  StageHudStatus,
  StageMeta,
} from '../../types/game';
import { soundEngine } from '../../utils/audio';
import {
  animateKnightPose3D,
  buildFirstPersonCaster,
  buildFirstPersonMeleeBlade,
  buildStylizedKnight3D,
  buildStylizedTree,
  createContactShadowTexture,
  createHazardStripeTexture,
  createStoneFlagstoneTexture,
  createWoodPlankTexture,
  detectSoftwareGl,
} from './threeAssets';

interface Three3DEngineProps {
  stage: StageMeta;
  paused: boolean;
  lowPowerMode: boolean;
  mouseSensitivity: number;
  invertY: boolean;
  resetSignal: number;
  onInputChange: (input: LiveInputState) => void;
  onStatusUpdate: (status: StageHudStatus) => void;
  onCoachHint: (hint: string | null) => void;
  onComplete: (payload: StageCompletionPayload) => void;
  onTimeout: () => void;
  onDefeated: () => void;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _rayEnd = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _ndcCenter = new THREE.Vector2(0, 0);

interface PlatformBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  baseY?: number;
  mesh?: THREE.Mesh;
  capMesh?: THREE.Mesh;
  width?: number;
  depth?: number;
  originX?: number;
  originY?: number;
  originZ?: number;
  moveAmpX?: number;
  moveAmpY?: number;
  moveAmpZ?: number;
  moveSpeed?: number;
  phase?: number;
  prevX?: number;
  prevY?: number;
  prevZ?: number;
  dx?: number;
  dy?: number;
  dz?: number;
}

interface RampBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  startY: number;
  endY: number;
  dir: 1 | -1;
}

interface Target3D {
  id: number;
  kind: 'coin' | 'key' | 'drone';
  group: THREE.Group;
  coreMesh: THREE.Object3D;
  ringMesh?: THREE.Object3D;
  eyeMat?: THREE.MeshStandardMaterial;
  hitProxy: THREE.Mesh;
  baseY: number;
  collected: boolean;
  orbitPhase: number;
  moveAmpX: number;
  originX: number;
  fireTimer: number;
  firePeriod: number;
}

interface EnemyOrb3D {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface Gate3D {
  group: THREE.Group;
  barrierMesh: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
  x: number;
  z: number;
  unlocked: boolean;
  openProgress: number;
}

interface Boss3D {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  shieldRingGroup: THREE.Group;
  crownGroup: THREE.Group;
  leftPauldron: THREE.Mesh;
  rightPauldron: THREE.Mesh;
  hitProxy: THREE.Mesh;
  hp: number;
  maxHp: number;
  flash: number;
  waveTimer: number;
  defeated: boolean;
}

interface ShockRing3D {
  mesh: THREE.Mesh;
  radius: number;
  maxRadius: number;
  hitPlayer: boolean;
}

interface Drone3D {
  group: THREE.Group;
  ringMesh: THREE.Mesh;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  speed: number;
  t: number;
  dir: number;
}

interface BurstParticle3D {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface BeamPulse {
  mesh: THREE.Mesh;
  life: number;
}

interface SlashVfx3D {
  mesh: THREE.Mesh;
  life: number;
}

interface FlameRef {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
}

export const Three3DEngine: React.FC<Three3DEngineProps> = ({
  stage,
  paused,
  lowPowerMode,
  mouseSensitivity,
  invertY,
  resetSignal,
  onInputChange,
  onStatusUpdate,
  onCoachHint,
  onComplete,
  onTimeout,
  onDefeated,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const damageOverlayRef = useRef<HTMLDivElement>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [lockNotice, setLockNotice] = useState<string>(
    'Clique na arena para controlar a câmera com o mouse (ou arraste)'
  );

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const sensRef = useRef(mouseSensitivity);
  sensRef.current = mouseSensitivity;

  const invertYRef = useRef(invertY);
  invertYRef.current = invertY;

  const callbacksRef = useRef({
    onInputChange,
    onStatusUpdate,
    onCoachHint,
    onComplete,
    onTimeout,
    onDefeated,
  });
  callbacksRef.current = {
    onInputChange,
    onStatusUpdate,
    onCoachHint,
    onComplete,
    onTimeout,
    onDefeated,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const useFastRender = isSoftwareGl || lowPowerMode;
    const isThirdPerson = stage.engine === '3D-THIRD';
    const isFps = stage.engine === '3D-FPS';
    const hasMelee = stage.activeControls.includes('F');
    const hasRanged = stage.activeControls.includes('MOUSE_CLICK');
    const isCombat3D = hasMelee || hasRanged;

    const renderer = new THREE.WebGLRenderer({
      antialias: !useFastRender,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(useFastRender ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = !useFastRender;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const rect = container.getBoundingClientRect();
    const initW = Math.max(320, rect.width);
    const initH = Math.max(200, rect.height);
    renderer.setSize(initW, initH);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(isCombat3D ? 0x0d1526 : 0x101c33);
    scene.background = skyColor;
    scene.fog = new THREE.Fog(skyColor.getHex(), 26, 74);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTex = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTex;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(isThirdPerson ? 58 : 72, initW / initH, 0.1, 150);
    scene.add(camera);

    let casterViewModel: ReturnType<typeof buildFirstPersonCaster> | null = null;
    if (isFps && hasRanged) {
      casterViewModel = buildFirstPersonCaster();
      casterViewModel.group.position.set(0.32, -0.25, -0.46);
      camera.add(casterViewModel.group);
    }

    let bladeViewModel: THREE.Group | null = null;
    if (isFps && hasMelee) {
      bladeViewModel = buildFirstPersonMeleeBlade();
      bladeViewModel.position.set(-0.34, -0.26, -0.45);
      bladeViewModel.rotation.set(0.22, 0.3, -0.28);
      camera.add(bladeViewModel);
    }

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.65);
    keyLight.position.set(16, 26, 14);
    if (!useFastRender) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -24;
      keyLight.shadow.camera.right = 24;
      keyLight.shadow.camera.top = 24;
      keyLight.shadow.camera.bottom = -24;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.68);
    rimLight.position.set(-14, 12, -18);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const stoneTex = createStoneFlagstoneTexture(maxAniso);
    const woodTex = createWoodPlankTexture(maxAniso);
    const hazardTex = createHazardStripeTexture(maxAniso);
    const shadowTex = createContactShadowTexture();

    const groundMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.82, metalness: 0.08 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !useFastRender;
    scene.add(ground);

    const playableHalf = 20;
    const wallStoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.72, metalness: 0.14 });
    const wallTrimMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55, metalness: 0.25 });
    const curbWalls: PlatformBox[] = [
      { minX: -playableHalf - 1, maxX: playableHalf + 1, minZ: -playableHalf - 1, maxZ: -playableHalf, height: 1.7 },
      { minX: -playableHalf - 1, maxX: playableHalf + 1, minZ: playableHalf, maxZ: playableHalf + 1, height: 1.7 },
      { minX: -playableHalf - 1, maxX: -playableHalf, minZ: -playableHalf, maxZ: playableHalf, height: 1.7 },
      { minX: playableHalf, maxX: playableHalf + 1, minZ: -playableHalf, maxZ: playableHalf, height: 1.7 },
    ];
    for (const cw of curbWalls) {
      const w = cw.maxX - cw.minX;
      const d = cw.maxZ - cw.minZ;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, cw.height, d), wallStoneMat);
      mesh.position.set((cw.minX + cw.maxX) / 2, cw.height / 2, (cw.minZ + cw.maxZ) / 2);
      mesh.receiveShadow = !useFastRender;
      scene.add(mesh);

      const coping = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.22, d + 0.16), wallTrimMat);
      coping.position.set((cw.minX + cw.maxX) / 2, cw.height + 0.05, (cw.minZ + cw.maxZ) / 2);
      scene.add(coping);
    }

    const treePositions = [
      [-25, -23, 1.1],
      [-12, -26, 0.95],
      [4, -25, 1.2],
      [22, -24, 1.0],
      [26, -6, 1.15],
      [25, 12, 0.9],
      [-26, 8, 1.1],
      [-24, 24, 1.0],
      [0, 26, 1.25],
      [23, 25, 1.05],
    ];
    for (const [tx, tz, ts] of treePositions) {
      scene.add(buildStylizedTree(tx, tz, ts));
    }

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.08 });
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const dist = 34 + (i % 3) * 5;
      const h = 4.5 + (i % 4) * 2.4;
      const monolith = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.3, h, 6), rockMat);
      monolith.position.set(Math.cos(ang) * dist, h / 2 - 0.2, Math.sin(ang) * dist);
      monolith.rotation.y = ang * 0.7;
      scene.add(monolith);
    }

    const meadowStrip = new THREE.Mesh(
      new THREE.RingGeometry(28, 76, 36),
      new THREE.MeshStandardMaterial({ color: 0x0f2536, roughness: 0.92, metalness: 0 })
    );
    meadowStrip.rotation.x = -Math.PI / 2;
    meadowStrip.position.y = 0.02;
    scene.add(meadowStrip);

    const platforms: PlatformBox[] = [];
    const wallOccludingMeshes: THREE.Mesh[] = [];
    const ramps: RampBox[] = [];
    const overheadBeams: PlatformBox[] = [];
    const targets: Target3D[] = [];
    const drones: Drone3D[] = [];
    const enemyOrbs: EnemyOrb3D[] = [];
    const bursts: BurstParticle3D[] = [];
    const beamPulses: BeamPulse[] = [];
    const slashVfxs: SlashVfx3D[] = [];
    const shockRings: ShockRing3D[] = [];
    const flames: FlameRef[] = [];
    let gate: Gate3D | null = null;
    let boss3d: Boss3D | null = null;

    const platMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x94a3b8, roughness: 0.65, metalness: 0.15 });
    const platTopMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.38, metalness: 0.28 });
    const movingPlatTopMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      roughness: 0.32,
      metalness: 0.4,
    });
    const rampMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72, metalness: 0.08 });
    const beamHazardMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.42,
      metalness: 0.35,
    });

    const addPlatform = (x: number, z: number, w: number, d: number, h: number) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), platMat);
      box.position.set(x, h / 2, z);
      box.castShadow = !useFastRender;
      box.receiveShadow = !useFastRender;
      scene.add(box);
      wallOccludingMeshes.push(box);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.14, d + 0.1), platTopMat);
      cap.position.set(x, h - 0.05, z);
      cap.receiveShadow = !useFastRender;
      scene.add(cap);

      platforms.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: h });
    };

    const addMovingPlatform = (
      x: number,
      z: number,
      w: number,
      d: number,
      topY: number,
      thickness: number,
      moveAmpX: number,
      moveAmpY: number,
      moveAmpZ: number,
      moveSpeed: number,
      phase = 0
    ) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), platMat);
      box.position.set(x, topY - thickness / 2, z);
      box.castShadow = !useFastRender;
      box.receiveShadow = !useFastRender;
      scene.add(box);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.16, d + 0.14), movingPlatTopMat);
      cap.position.set(x, topY - 0.06, z);
      cap.receiveShadow = !useFastRender;
      scene.add(cap);

      platforms.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        height: topY,
        baseY: topY - thickness,
        mesh: box,
        capMesh: cap,
        width: w,
        depth: d,
        originX: x,
        originY: topY,
        originZ: z,
        moveAmpX,
        moveAmpY,
        moveAmpZ,
        moveSpeed,
        phase,
        prevX: x,
        prevY: topY,
        prevZ: z,
        dx: 0,
        dy: 0,
        dz: 0,
      });
    };

    const addWallBox = (x: number, z: number, w: number, d: number, h = 4.2) => {
      if (w <= 0.1 || d <= 0.1) return;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallStoneMat);
      wall.position.set(x, h / 2, z);
      wall.castShadow = !useFastRender;
      wall.receiveShadow = !useFastRender;
      scene.add(wall);
      wallOccludingMeshes.push(wall);

      const coping = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.2, d + 0.14), wallTrimMat);
      coping.position.set(x, h + 0.04, z);
      scene.add(coping);

      platforms.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: h });
    };

    const addOverheadCrouchBeam = (x: number, z: number, w: number, d: number, bottomY: number, wallHeight = 3.8) => {
      const thickness = Math.max(1.45, wallHeight - bottomY);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), beamHazardMat);
      mesh.position.set(x, bottomY + thickness / 2, z);
      mesh.castShadow = !useFastRender;
      scene.add(mesh);
      wallOccludingMeshes.push(mesh);

      const pillarGeo = new THREE.BoxGeometry(0.46, bottomY + thickness + 0.25, d + 0.08);
      const p1 = new THREE.Mesh(pillarGeo, wallStoneMat);
      p1.position.set(x - w / 2 - 0.22, (bottomY + thickness) / 2, z);
      const p2 = new THREE.Mesh(pillarGeo, wallStoneMat);
      p2.position.set(x + w / 2 + 0.22, (bottomY + thickness) / 2, z);

      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.9,
      });
      const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), beaconMat);
      b1.position.set(x - w / 2 - 0.22, bottomY + thickness + 0.16, z);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), beaconMat);
      b2.position.set(x + w / 2 + 0.22, bottomY + thickness + 0.16, z);

      scene.add(p1, p2, b1, b2);

      overheadBeams.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        height: bottomY + thickness,
        baseY: bottomY,
      });
    };

    const addCrouchWallPassage = (
      gapX: number,
      z: number,
      gapW: number,
      d: number,
      bottomY: number,
      spanMinX: number,
      spanMaxX: number,
      wallH = 3.8
    ) => {
      addOverheadCrouchBeam(gapX, z, gapW, d, bottomY, wallH);
      const leftEdge = gapX - gapW / 2 - 0.42;
      const rightEdge = gapX + gapW / 2 + 0.42;
      if (leftEdge - spanMinX > 0.25) {
        addWallBox((spanMinX + leftEdge) / 2, z, leftEdge - spanMinX, d * 0.72, wallH);
      }
      if (spanMaxX - rightEdge > 0.25) {
        addWallBox((rightEdge + spanMaxX) / 2, z, spanMaxX - rightEdge, d * 0.72, wallH);
      }
    };

    const addRampZ = (x: number, zStart: number, zEnd: number, width: number, startY: number, endY: number) => {
      const length = Math.abs(zEnd - zStart);
      const heightDiff = endY - startY;
      const hyp = Math.hypot(length, heightDiff);
      const angle = Math.atan2(heightDiff, length);
      const midZ = (zStart + zEnd) / 2;
      const midY = (startY + endY) / 2;

      const geo = new THREE.BoxGeometry(width, 0.24, hyp);
      const mesh = new THREE.Mesh(geo, rampMat);
      mesh.position.set(x, midY - 0.12, midZ);
      const dir: 1 | -1 = zEnd > zStart ? 1 : -1;
      mesh.rotation.x = dir === 1 ? -angle : angle;
      mesh.receiveShadow = !useFastRender;
      scene.add(mesh);

      const railGeo = new THREE.BoxGeometry(0.12, 0.14, hyp);
      const railL = new THREE.Mesh(railGeo, wallTrimMat);
      railL.position.set(x - width / 2 + 0.08, midY + 0.08, midZ);
      railL.rotation.x = mesh.rotation.x;
      const railR = new THREE.Mesh(railGeo, wallTrimMat);
      railR.position.set(x + width / 2 - 0.08, midY + 0.08, midZ);
      railR.rotation.x = mesh.rotation.x;
      scene.add(railL, railR);

      ramps.push({
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: Math.min(zStart, zEnd),
        maxZ: Math.max(zStart, zEnd),
        startY,
        endY,
        dir,
      });
    };

    const addBrazier = (x: number, y: number, z: number, flameHex = 0xf59e0b) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.9, 8), wallStoneMat);
      base.position.y = 0.45;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.26, 8), wallTrimMat);
      bowl.position.y = 0.98;
      const flameMat = new THREE.MeshStandardMaterial({
        color: flameHex,
        emissive: flameHex,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      });
      const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), flameMat);
      flame.scale.set(0.85, 1.45, 0.85);
      flame.position.y = 1.28;
      g.add(base, bowl, flame);
      scene.add(g);
      flames.push({ mesh: flame, baseY: 1.28, phase: x * 0.7 + z * 0.4 });
    };

    const addRuinColumn = (x: number, z: number, height: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), wallTrimMat);
      plinth.position.y = 0.175;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, height, 8), wallStoneMat);
      shaft.position.y = 0.35 + height / 2;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 1.0), wallTrimMat);
      cap.position.y = 0.35 + height + 0.14;
      g.add(plinth, shaft, cap);
      scene.add(g);
    };

    const addCrateCluster = (x: number, z: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.35, 1.4), rampMat);
      c1.position.set(0, 0.675, 0);
      c1.castShadow = !useFastRender;
      c1.receiveShadow = !useFastRender;
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.95, 1.0), rampMat);
      c2.position.set(1.15, 0.475, 0.22);
      c2.rotation.y = 0.35;
      c2.castShadow = !useFastRender;
      g.add(c1, c2);
      scene.add(g);
      wallOccludingMeshes.push(c1, c2);
      platforms.push({ minX: x - 0.72, maxX: x + 0.72, minZ: z - 0.72, maxZ: z + 0.72, height: 1.35 });
      platforms.push({ minX: x + 0.62, maxX: x + 1.68, minZ: z - 0.3, maxZ: z + 0.75, height: 0.95 });
    };

    const addCoinTarget = (id: number, x: number, y: number, z: number) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xb45309,
        emissiveIntensity: 0.48,
        roughness: 0.24,
        metalness: 0.8,
      });
      const gemMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.9,
      });

      const coinGroup = new THREE.Group();
      coinGroup.position.y = 1.05;
      const coinGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 18);
      coinGeo.rotateX(Math.PI / 2);
      const rim = new THREE.Mesh(coinGeo, coinMat);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), gemMat);
      coinGroup.add(rim, gem);
      group.add(coinGroup);

      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 1.1),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.04;
      group.add(shadow);

      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.88, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitProxy.position.y = 1.05;
      hitProxy.userData.targetId = id;
      group.add(hitProxy);

      scene.add(group);
      targets.push({
        id,
        kind: 'coin',
        group,
        coreMesh: coinGroup,
        hitProxy,
        baseY: y,
        collected: false,
        orbitPhase: id * 0.7,
        moveAmpX: 0,
        originX: x,
        fireTimer: 99,
        firePeriod: 99,
      });
    };

    const addKeyTarget = (id: number, x: number, y: number, z: number) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const keyMat = new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xd97706,
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.8,
      });

      const keyAssembly = new THREE.Group();
      keyAssembly.position.y = 1.25;
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 8, 18), keyMat);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.88, 0.13), keyMat);
      shaft.position.set(0, -0.58, 0);
      const toothA = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.13), keyMat);
      toothA.position.set(0.2, -0.82, 0);
      const toothB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.13), keyMat);
      toothB.position.set(0.16, -0.62, 0);
      keyAssembly.add(bow, shaft, toothA, toothB);
      group.add(keyAssembly);

      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.88, 0.055, 6, 22),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.75 })
      );
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.18;
      group.add(ringMesh);

      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitProxy.position.y = 1.1;
      hitProxy.userData.targetId = id;
      group.add(hitProxy);

      scene.add(group);
      targets.push({
        id,
        kind: 'key',
        group,
        coreMesh: keyAssembly,
        ringMesh,
        hitProxy,
        baseY: y,
        collected: false,
        orbitPhase: 0,
        moveAmpX: 0,
        originX: x,
        fireTimer: 99,
        firePeriod: 99,
      });
    };

    const addDroneTarget = (
      id: number,
      x: number,
      y: number,
      z: number,
      moveAmpX = 0,
      firePeriod = 3.2
    ) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const shellMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.65 });
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xc2410c,
        emissiveIntensity: 0.78,
        roughness: 0.22,
        metalness: 0.45,
      });
      const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.1,
      });

      const coreGroup = new THREE.Group();
      const coreOct = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 0), coreMat);
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.64, 0.18), shellMat);
      wingL.position.set(-0.68, 0, 0);
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.64, 0.18), shellMat);
      wingR.position.set(0.68, 0, 0);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), eyeMat);
      eye.position.set(0, 0, 0.56);
      coreGroup.add(coreOct, wingL, wingR, eye);
      group.add(coreGroup);

      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(1.04, 0.065, 8, 22),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.6,
          roughness: 0.28,
        })
      );
      group.add(ringMesh);

      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitProxy.userData.targetId = id;
      group.add(hitProxy);

      scene.add(group);
      targets.push({
        id,
        kind: 'drone',
        group,
        coreMesh: coreGroup,
        ringMesh,
        eyeMat,
        hitProxy,
        baseY: y,
        collected: false,
        orbitPhase: id * 0.9,
        moveAmpX,
        originX: x,
        fireTimer: 1.5 + (id % 4) * 0.65,
        firePeriod,
      });
    };

    const addMonumentGate = (x: number, z: number): Gate3D => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);

      const leftBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.0), wallTrimMat);
      leftBase.position.set(-2.0, 0.2, 0);
      const rightBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.0), wallTrimMat);
      rightBase.position.set(2.0, 0.2, 0);

      const leftP = new THREE.Mesh(new THREE.BoxGeometry(0.68, 3.6, 0.68), wallStoneMat);
      leftP.position.set(-2.0, 2.0, 0);
      const rightP = new THREE.Mesh(new THREE.BoxGeometry(0.68, 3.6, 0.68), wallStoneMat);
      rightP.position.set(2.0, 2.0, 0);

      const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.56, 0.85), wallTrimMat);
      lintel.position.set(0, 3.9, 0);
      const keystone = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.72, 0.95), wallStoneMat);
      keystone.position.set(0, 4.15, 0);

      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.9,
      });
      const runeStone = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), beaconMat);
      runeStone.position.set(0, 4.15, 0.45);

      const barrierMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.68,
        transparent: true,
        opacity: 0.82,
      });
      const barrierMesh = new THREE.Mesh(new THREE.BoxGeometry(3.32, 3.4, 0.22), barrierMat);
      barrierMesh.position.set(0, 1.8, 0);

      g.add(leftBase, rightBase, leftP, rightP, lintel, keystone, runeStone, barrierMesh);
      scene.add(g);

      return { group: g, barrierMesh, beaconMat, x, z, unlocked: false, openProgress: 0 };
    };

    const addBoss3D = (): Boss3D => {
      const group = new THREE.Group();
      group.position.set(0, 3.6, -4);

      const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.65 });
      const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.82 });
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.95,
        roughness: 0.18,
        metalness: 0.4,
      });

      const carapace = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.85, 2.2, 6), obsidianMat);
      group.add(carapace);

      const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), coreMat);
      coreMesh.position.set(0, 0.1, 0.72);
      group.add(coreMesh);

      const crownGroup = new THREE.Group();
      crownGroup.position.set(0, 1.25, 0);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 4), goldTrimMat);
        spire.position.set(Math.cos(ang) * 0.95, 0.35, Math.sin(ang) * 0.95);
        crownGroup.add(spire);
      }
      group.add(crownGroup);

      const leftPauldron = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.5, 0.85), obsidianMat);
      leftPauldron.position.set(-1.95, 0.15, 0);
      const rightPauldron = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.5, 0.85), obsidianMat);
      rightPauldron.position.set(1.95, 0.15, 0);
      group.add(leftPauldron, rightPauldron);

      const shieldRingGroup = new THREE.Group();
      const gyroRing = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.1, 8, 28), goldTrimMat);
      gyroRing.rotation.x = Math.PI / 2;
      shieldRingGroup.add(gyroRing);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.25, 0.22), goldTrimMat);
        slab.position.set(Math.cos(ang) * 2.65, 0, Math.sin(ang) * 2.65);
        slab.rotation.y = -ang + Math.PI / 2;
        shieldRingGroup.add(slab);
      }
      group.add(shieldRingGroup);

      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(2.35, 10, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitProxy.userData.isBoss = true;
      group.add(hitProxy);

      scene.add(group);
      return {
        group,
        coreMesh,
        shieldRingGroup,
        crownGroup,
        leftPauldron,
        rightPauldron,
        hitProxy,
        hp: 24,
        maxHp: 24,
        flash: 0,
        waveTimer: 2.6,
        defeated: false,
      };
    };

    const addPatrolDrone3D = (ax: number, az: number, bx: number, bz: number, speed: number) => {
      const g = new THREE.Group();
      const chassis = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.58, 0),
        new THREE.MeshStandardMaterial({
          color: 0xdc2626,
          emissive: 0x991b1b,
          emissiveIntensity: 0.72,
          roughness: 0.3,
        })
      );
      chassis.position.y = 1.1;
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.92, 0.075, 6, 18),
        new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.35 })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 1.1;
      g.add(chassis, halo);
      g.position.set(ax, 0, az);
      scene.add(g);
      drones.push({ group: g, ringMesh: halo, ax, az, bx, bz, speed, t: 0, dir: 1 });
    };

    let knight3D: ReturnType<typeof buildStylizedKnight3D> | null = null;
    const playerState = {
      x: 0,
      y: 0,
      z: 14,
      vy: 0,
      yaw: 0,
      pitch: isThirdPerson ? -0.26 : 0,
      grounded: true,
      coyoteTimer: 0,
      jumpBuffer: 0,
      crouching: false,
      sliding: false,
      slideTimer: 0,
      slideCooldown: 0,
      slideDirX: 0,
      slideDirZ: -1,
      lastSafeX: 0,
      lastSafeY: 0,
      lastSafeZ: 14,
    };

    // ================= STAGE 3D LAYOUTS (23 - 34) — VERIFIED 100% ACCESSIBLE =================
    if (stage.id === 23) {
      // Stage 23: Pátio Real da Cidadela (3ª Pessoa — rampas suaves + exploração)
      knight3D = buildStylizedKnight3D(shadowTex, !useFastRender);
      scene.add(knight3D.root);
      addBrazier(-12, 0, 14);
      addBrazier(12, 0, 14);
      addRuinColumn(-15, -15, 4.2);
      addRuinColumn(15, -15, 4.2);

      addRampZ(-6, 9, 5.5, 3.4, 0, 0.8);
      addPlatform(-6, 3.2, 4.5, 4.8, 0.8);

      addRampZ(6.5, 3.5, -0.5, 3.4, 0, 0.8);
      addPlatform(6.5, -2.8, 4.5, 4.8, 0.8);

      addRampZ(0, -5.5, -9, 3.8, 0, 1.0);
      addPlatform(0, -11.5, 5.5, 5.2, 1.0);
      addBrazier(-2.2, 1.0, -13.4);
      addBrazier(2.2, 1.0, -13.4);

      const coinLocs: [number, number, number][] = [
        [0, 0, 7],
        [-7, 0, 12],
        [-6, 0.8, 3.2],
        [7, 0, 10],
        [6.5, 0.8, -2.8],
        [0, 1.0, -11.5],
        [-12, 0, -10],
        [12, 0, -11],
      ];
      coinLocs.forEach(([x, y, z], i) => addCoinTarget(i + 1, x, y, z));
    } else if (stage.id === 24) {
      // Stage 24: Terraços do Observatório (Parkour 3D progressivo sem cronômetro)
      knight3D = buildStylizedKnight3D(shadowTex, !useFastRender);
      scene.add(knight3D.root);
      addBrazier(-4.5, 0, 13.5);
      addBrazier(4.5, 0, 13.5);
      addRuinColumn(-15, 8, 4.2);
      addRuinColumn(15, 8, 4.2);

      // Ramo principal oeste -> norte (degraus <= 0.75m, gaps <= 2.3m)
      addPlatform(-4.2, 10.5, 4.2, 3.8, 0.7);
      addPlatform(-4.2, 5.0, 4.0, 3.6, 1.4);
      addPlatform(-4.2, -0.5, 4.0, 3.6, 2.1);
      addPlatform(-1.2, -6.2, 4.2, 3.6, 2.75);
      addPlatform(0, -12.4, 5.8, 4.8, 3.35);

      // Ramo leste com braseiros até o mesmo topo
      addPlatform(4.4, 9.5, 4.0, 3.6, 0.75);
      addPlatform(5.2, 3.8, 4.0, 3.6, 1.5);
      addPlatform(4.4, -2.0, 4.0, 3.6, 2.2);
      addPlatform(3.0, -7.6, 3.8, 3.4, 2.85);

      addBrazier(-2.2, 3.35, -14.2, 0x38bdf8);
      addBrazier(2.2, 3.35, -14.2, 0x38bdf8);

      const coinLocs: [number, number, number][] = [
        [-4.2, 0.7, 10.5],
        [-4.2, 1.4, 5.0],
        [-4.2, 2.1, -0.5],
        [4.4, 0.75, 9.5],
        [5.2, 1.5, 3.8],
        [4.4, 2.2, -2.0],
        [-1.2, 2.75, -6.2],
        [0, 3.35, -12.4],
      ];
      coinLocs.forEach(([x, y, z], i) => addCoinTarget(i + 1, x, y, z));
    } else if (stage.id === 25) {
      // Stage 25: Pontes Flutuantes do Abismo 3D (Plataformas móveis horizontais e verticais)
      knight3D = buildStylizedKnight3D(shadowTex, !useFastRender);
      scene.add(knight3D.root);
      playerState.z = 15.5;
      playerState.lastSafeZ = 15.5;

      addRampZ(-6.5, 13.5, 9.0, 3.8, 0, 1.0);
      addPlatform(-6.5, 6.2, 4.8, 4.4, 1.0);
      addBrazier(-8.4, 1.0, 6.2, 0x38bdf8);

      // Ponte móvel horizontal oeste -> leste
      addMovingPlatform(0, 6.2, 3.8, 3.6, 1.15, 0.45, 3.4, 0, 0, 1.25, 0);

      // Ilha central leste
      addPlatform(6.8, 6.2, 4.6, 4.6, 1.25);

      // Elevador vertical na ala leste
      addMovingPlatform(6.8, 0.8, 3.8, 3.8, 2.15, 0.45, 0, 0.95, 0, 1.45, 0.6);

      // Terraço elevado nordeste + ponte deslizante norte
      addPlatform(6.8, -5.2, 4.8, 4.6, 2.7);
      addMovingPlatform(0, -5.2, 3.8, 3.6, 2.75, 0.45, 3.2, 0, 0, 1.35, Math.PI * 0.5);
      addPlatform(-6.8, -5.2, 4.8, 4.6, 2.8);

      // Ponte deslizante Z rumo ao altar norte
      addMovingPlatform(-3.5, -10.4, 4.0, 3.6, 2.9, 0.45, 0, 0, 2.1, 1.35, 0.2);
      addPlatform(1.2, -14.2, 5.4, 4.4, 3.0);
      addBrazier(3.4, 3.0, -15.6, 0xfbbf24);

      // Patrulha no pátio térreo para manter atenção caso caia das pontes
      addPatrolDrone3D(-9.0, 0.0, 2.0, 0.0, 3.4);

      const coinLocs: [number, number, number][] = [
        [-6.5, 1.0, 6.2],
        [0, 0, 10.5],
        [6.8, 1.25, 6.2],
        [6.8, 2.7, -5.2],
        [-6.8, 2.8, -5.2],
        [1.2, 3.0, -14.2],
        [12.0, 0, -2.0],
        [-12.0, 0, 1.5],
      ];
      coinLocs.forEach(([x, y, z], i) => addCoinTarget(i + 1, x, y, z));
    } else if (stage.id === 26) {
      // Stage 26: Chave do Bastião 3D (Rampa + Ponte Móvel + Chave Azul + Muralha selada + Portão)
      knight3D = buildStylizedKnight3D(shadowTex, !useFastRender);
      scene.add(knight3D.root);
      addBrazier(-4.5, 0, 12);
      addBrazier(4.5, 0, 12);
      addRuinColumn(-14, 12, 4.4);
      addRuinColumn(14, 10, 3.8);

      addRampZ(0, 11.5, 5.5, 4.0, 0, 1.3);
      addPlatform(0, 2.5, 4.8, 6.2, 1.3);
      addMovingPlatform(-4.6, -2.2, 3.8, 3.6, 1.65, 0.45, 2.0, 0, 0, 1.4, 0);
      addPlatform(-5.2, -7.2, 4.4, 4.2, 2.0);
      addPlatform(0.5, -9.5, 4.6, 4.6, 2.2);
      addBrazier(2.3, 2.2, -11.2, 0x38bdf8);

      addWallBox(-7.4, -14.5, 25.8, 1.4, 4.8);
      addWallBox(15.2, -14.5, 10.6, 1.4, 4.8);
      addPatrolDrone3D(-9.5, -12.0, 10.5, -12.0, 3.4);

      addKeyTarget(1, 0.5, 2.2, -9.5);
      gate = addMonumentGate(7.5, -14.5);
    } else if (stage.id === 27) {
      // Stage 27: Ala de Segurança em 1ª Pessoa (Pórticos com muralhas obrigatórias + patrulha)
      playerState.z = 16;
      playerState.lastSafeZ = 16;
      addBrazier(-3.5, 0, 13.5);
      addBrazier(3.5, 0, 13.5);

      addCrouchWallPassage(0, 10.5, 4.8, 1.8, 1.12, -20.5, 20.5, 4.0);
      addCrouchWallPassage(-7.5, 0, 4.6, 1.8, 1.12, -20.5, 2.5, 3.9);
      addWallBox(2.5, -5.8, 1.1, 11.6, 3.9);

      addRampZ(7.2, 6.2, 1.5, 3.8, 0, 1.0);
      addPlatform(7.2, -1.5, 4.6, 5.0, 1.0);
      addRampZ(-1.0, -4.5, -9.0, 3.8, 0, 1.0);
      addPlatform(-1.0, -12.0, 5.2, 5.2, 1.0);
      addPatrolDrone3D(-4.5, 4.5, 4.5, 4.5, 3.2);

      const coinLocs: [number, number, number][] = [
        [0, 0, 13],
        [0, 0, 6.8],
        [-7.5, 0, 4.0],
        [-7.5, 0, -4.5],
        [7.2, 1.0, -1.5],
        [7.2, 0, -9.2],
        [-1.0, 1.0, -12.0],
        [-4.8, 0, -15.0],
      ];
      coinLocs.forEach(([x, y, z], i) => addCoinTarget(i + 1, x, y, z));
    } else if (stage.id === 28) {
      // Stage 28: Túnel de Deslize & Comporta 3D (Túneis compridos para Slide + Chave + Portão selado)
      playerState.z = 16;
      playerState.lastSafeZ = 16;
      addBrazier(-3.4, 0, 13.5, 0x38bdf8);
      addBrazier(3.4, 0, 13.5, 0x38bdf8);

      // Pórtico longo 1 (ideal para Slide Shift + C)
      addCrouchWallPassage(0, 9.6, 4.6, 3.2, 1.12, -20.5, 20.5, 4.2);

      addRampZ(0, 6.6, 1.6, 4.0, 0, 1.4);
      addPlatform(0, -1.4, 4.6, 5.8, 1.4);
      addPlatform(0, -7.0, 4.2, 3.8, 1.8);

      // Corredor leste obrigatório com túnel de slide comprido até a Comporta
      addWallBox(3.6, -5.2, 1.2, 13.6, 4.4);
      addCrouchWallPassage(7.2, -1.2, 4.6, 3.2, 1.12, 3.6, 20.5, 4.4);
      addWallBox(-7.8, -12.5, 24.8, 1.4, 4.8);
      addWallBox(15.0, -12.5, 11.2, 1.4, 4.8);

      addBrazier(-1.6, 1.8, -8.5, 0xfbbf24);
      addBrazier(1.6, 1.8, -8.5, 0xfbbf24);
      addPatrolDrone3D(-5.0, 5.5, 5.0, 5.5, 3.3);

      addKeyTarget(1, 0, 1.8, -7.0);
      gate = addMonumentGate(7.0, -12.5);
    } else if (stage.id === 29) {
      // Stage 29: Lâmina do Pátio 3D (Apenas Melee F / Botão Direito contra 6 drones armados)
      playerState.z = 15.5;
      playerState.lastSafeZ = 15.5;
      addCrateCluster(-5.2, 10.2);
      addCrateCluster(4.2, 10.2);
      addWallBox(0, 5.2, 2.8, 0.9, 2.0);
      addWallBox(-8.5, 1.2, 2.6, 0.9, 2.0);
      addWallBox(8.5, 1.2, 2.6, 0.9, 2.0);
      addRuinColumn(-14, -10, 4.4);
      addRuinColumn(14, -10, 4.4);
      addBrazier(-3.0, 0, 13.5, 0xa855f7);
      addBrazier(3.0, 0, 13.5, 0xa855f7);

      const locs: [number, number, number, number][] = [
        [-5.2, 1.4, 5.0, 0],
        [5.2, 1.4, 5.0, 0],
        [0, 1.4, 0.2, 0.8],
        [-7.5, 1.4, -5.5, 0.9],
        [7.5, 1.4, -5.5, 0.9],
        [0, 1.5, -11.5, 1.2],
      ];
      locs.forEach(([x, y, z, amp], i) => addDroneTarget(i + 1, x, y, z, amp, 3.5));
    } else if (stage.id === 30) {
      // Stage 30: Estande de Tiro & Energia 3D (6 cargas + Melee refill contra 8 drones)
      playerState.z = 15.5;
      playerState.lastSafeZ = 15.5;
      addRampZ(0, 11.5, 7.5, 3.8, 0, 0.9);
      addPlatform(0, 5.0, 5.0, 4.5, 0.9);
      addCrateCluster(-7.8, 9.2);
      addCrateCluster(6.8, 9.2);
      addWallBox(-3.6, 9.8, 2.4, 0.9, 1.8);
      addWallBox(3.6, 9.8, 2.4, 0.9, 1.8);
      addRuinColumn(-14, -8, 4.6);
      addRuinColumn(14, -8, 4.6);

      const locs: [number, number, number, number][] = [
        [-6, 1.8, 0, 0],
        [6, 1.8, 0, 0],
        [0, 2.8, -3, 0],
        [-10, 3.6, -7, 0],
        [10, 3.6, -7, 0],
        [-4.5, 4.6, -12, 0],
        [4.5, 4.6, -12, 0],
        [0, 2.2, -15, 0],
      ];
      locs.forEach(([x, y, z, amp], i) => addDroneTarget(i + 1, x, y, z, amp, 3.4));
    } else if (stage.id === 31) {
      // Stage 31: Sentinelas dos Terraços 3D (Terraços laterais + Ponte móvel central + 10 sentinelas)
      playerState.z = 14.5;
      playerState.lastSafeZ = 14.5;
      addRampZ(-8.5, 10, 5.8, 3.4, 0, 1.3);
      addPlatform(-8.5, 3.5, 4.6, 4.8, 1.3);
      addRampZ(8.5, 10, 5.8, 3.4, 0, 1.3);
      addPlatform(8.5, 3.5, 4.6, 4.8, 1.3);
      addMovingPlatform(0, 3.5, 4.4, 3.4, 1.35, 0.45, 3.4, 0, 0, 1.25, 0);
      addBrazier(-10.2, 1.3, 1.6);
      addBrazier(10.2, 1.3, 1.6);
      addCrateCluster(-0.5, 7.6);
      addWallBox(-4.2, 1.0, 2.0, 0.9, 2.1);
      addWallBox(4.2, 1.0, 2.0, 0.9, 2.1);

      const locs: [number, number, number, number][] = [
        [0, 2.7, 0.5, 0],
        [-7, 3.2, -4, 0],
        [7, 3.2, -4, 0],
        [0, 4.2, -10, 1.8],
        [-12, 2.6, 4, 0],
        [12, 2.6, 4, 0],
        [-10, 4.0, -12, 1.5],
        [10, 4.0, -12, 1.5],
        [0, 2.4, -15, 2.2],
        [0, 5.2, -5, 1.6],
      ];
      locs.forEach(([x, y, z, amp], i) => addDroneTarget(i + 1, x, y, z, amp, 3.0));
    } else if (stage.id === 32) {
      // Stage 32: Blitz nas Trincheiras e Deslize 3D (Pórticos de trincheira + rampas elevadas + 12 alvos)
      playerState.z = 16.5;
      playerState.lastSafeZ = 16.5;

      // Pórtico de trincheira frontal (Slide para infiltrar)
      addCrouchWallPassage(-8.5, 13.0, 4.2, 2.4, 1.12, -14.5, -2.5, 2.8);
      addCrouchWallPassage(8.5, 13.0, 4.2, 2.4, 1.12, 2.5, 14.5, 2.8);

      addRampZ(-8.5, 10.6, 5.2, 3.6, 0, 2.2);
      addPlatform(-8.5, 2.8, 5.0, 5.0, 2.2);
      addRampZ(8.5, 10.6, 5.2, 3.6, 0, 2.2);
      addPlatform(8.5, 2.8, 5.0, 5.0, 2.2);
      addPlatform(0, 3, 7.2, 1.3, 2.5);
      addPlatform(0, -6, 8.8, 1.3, 2.5);
      addCrateCluster(-13.5, 8.5);
      addCrateCluster(12.2, 8.5);
      addWallBox(0, 10.5, 3.2, 0.9, 2.0);
      addBrazier(-10.5, 2.2, 0.8, 0x38bdf8);
      addBrazier(10.5, 2.2, 0.8, 0x38bdf8);

      const locs: [number, number, number, number][] = [
        [-3.5, 1.5, -1.5, 0],
        [3.5, 1.5, -1.5, 0],
        [0, 1.6, -10.5, 2.5],
        [-10, 4.0, -5, 1.6],
        [10, 4.0, -5, 1.6],
        [-12, 2.9, -13, 1.8],
        [12, 2.9, -13, 1.8],
        [0, 5.0, -12, 3.0],
        [-5, 4.6, 0, 0],
        [5, 4.6, 0, 0],
        [-13, 3.4, 4, 0],
        [13, 3.4, 4, 0],
      ];
      locs.forEach(([x, y, z, amp], i) => addDroneTarget(i + 1, x, y, z, amp, 2.7));
    } else if (stage.id === 33) {
      // Stage 33: Provação da Muralha Norte 3D (Slide + Parkour móvel + 3 drones + Chave + Portão)
      playerState.z = 16.5;
      playerState.lastSafeZ = 16.5;
      addBrazier(-3.6, 0, 14.0, 0x38bdf8);
      addBrazier(3.6, 0, 14.0, 0x38bdf8);

      // Seção 1: Slide no pórtico frontal
      addCrouchWallPassage(0, 10.6, 4.8, 3.0, 1.12, -20.5, 20.5, 4.2);

      // Seção 2: Rampa oeste -> Terraço -> Ponte móvel central -> Altar leste da Chave
      addRampZ(-6.5, 7.6, 2.5, 3.8, 0, 1.4);
      addPlatform(-6.5, -0.4, 4.8, 4.8, 1.4);
      addMovingPlatform(-1.2, -0.4, 3.8, 3.4, 1.5, 0.45, 2.4, 0, 0, 1.35, 0);
      addPlatform(4.8, -0.4, 4.6, 4.8, 1.65);
      addPlatform(4.8, -6.2, 4.4, 4.2, 2.1);

      // 3 drones defensores (cortar orbes com F ou neutralizá-los no caminho)
      addDroneTarget(101, -9.5, 3.0, -5.5, 1.4, 3.1);
      addDroneTarget(102, 0.0, 3.4, -7.8, 1.8, 3.2);
      addDroneTarget(103, 10.5, 3.0, -5.5, 1.4, 3.1);

      // Muralha norte selada ao lado do Portão Monumental
      addWallBox(-7.8, -13.5, 24.8, 1.4, 4.8);
      addWallBox(14.8, -13.5, 11.4, 1.4, 4.8);
      addBrazier(6.5, 2.1, -8.0, 0xfbbf24);

      addKeyTarget(1, 4.8, 2.1, -6.2);
      gate = addMonumentGate(7.0, -13.5);
    } else {
      // Stage 34: O Colosso Monólito (Chefe Final 3D — 24 HP, Bunker de Slide + Rampas + Ondas + Tiros + Melee Parry)
      playerState.z = 16.5;
      playerState.lastSafeZ = 16.5;
      addCrouchWallPassage(0, 11.5, 4.6, 2.2, 1.12, -7.2, 7.2, 2.7);
      addRampZ(-10, 11, 5.5, 3.4, 0, 1.6);
      addPlatform(-10, 3, 4.4, 5.0, 1.6);
      addRampZ(10, 11, 5.5, 3.4, 0, 1.6);
      addPlatform(10, 3, 4.4, 5.0, 1.6);
      addPlatform(-5.5, -10, 3.6, 3.6, 1.8);
      addPlatform(5.5, -10, 3.6, 3.6, 1.8);

      addBrazier(-14, 0, -14, 0xef4444);
      addBrazier(14, 0, -14, 0xef4444);
      addRuinColumn(-15, -4, 5.0);
      addRuinColumn(15, -4, 5.0);

      addPatrolDrone3D(-14, 6.5, 14, 6.5, 4.0);
      addPatrolDrone3D(14, -14.5, -14, -14.5, 4.4);
      boss3d = addBoss3D();
    }

    const keys: Record<string, boolean> = {};
    const stageMaxHp = stage.id === 23 || stage.id === 24 ? undefined : [31, 32].includes(stage.id) ? 4 : 5;
    let playerHp = stageMaxHp ?? 5;
    const maxAmmo = hasRanged ? 6 : 0;
    let ammo = maxAmmo;
    let ammoRegenTimer = 0;
    let shootCooldown = 0;
    let meleeCooldown = 0;
    let meleeSlashAnim = 0;

    let isDraggingLook = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let shotsFired = 0;
    let shotsHit = 0;
    let bumps = 0;
    let elapsedSec = 0;
    let stamina = 100;
    let staminaExhausted = false;
    let staminaRegenDelay = 0;
    let finished = false;
    let timedOut = false;
    let defeated = false;
    let walkPhase = 0;
    let landSquash = 0;
    let recoilOffset = 0;
    let invulnTimer = 0;
    let flashOverlayAlpha = 0;
    let lookSwayX = 0;
    let lookSwayY = 0;
    let blinkTimer = 2.6;
    let hudTimer = 0;
    let currentEyeHeight = 1.65;
    let standingPlatform: PlatformBox | null = null;
    let wasCrouchDown = false;
    let rightMouseDown = false;
    let leftMouseDown = false;

    const raycaster = new THREE.Raycaster();
    const rayShootables: THREE.Object3D[] = [
      ...targets.map((t) => t.hitProxy),
      ...wallOccludingMeshes,
      ...(boss3d ? [boss3d.hitProxy] : []),
    ];

    const spawnCrystalBurst = (pos: THREE.Vector3, colorHex: number, countOverride?: number) => {
      const count = countOverride ?? (useFastRender ? 5 : 10);
      const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos);
        scene.add(m);
        bursts.push({
          mesh: m,
          vx: (Math.random() - 0.5) * 6,
          vy: 2 + Math.random() * 4,
          vz: (Math.random() - 0.5) * 6,
          life: 0.45,
        });
      }
    };

    const emitInput = () => {
      callbacksRef.current.onInputChange({
        w: Boolean(keys['KeyW'] || keys['ArrowUp']),
        a: Boolean(keys['KeyA'] || keys['ArrowLeft']),
        s: Boolean(keys['KeyS'] || keys['ArrowDown']),
        d: Boolean(keys['KeyD'] || keys['ArrowRight']),
        shift: Boolean(keys['ShiftLeft'] || keys['ShiftRight']),
        ctrl: Boolean(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC']),
        space: Boolean(keys['Space']),
        f: Boolean(keys['KeyF'] || keys['KeyJ']),
        mouseDown: leftMouseDown,
        rightMouseDown,
      });
    };

    const orbGeo = new THREE.SphereGeometry(0.24, 8, 8);
    const orbMat = new THREE.MeshBasicMaterial({ color: 0xfb7185 });

    const spawnEnemyOrb3D = (origin: THREE.Vector3, targetX: number, targetY: number, targetZ: number, speed: number) => {
      const mesh = new THREE.Mesh(orbGeo, orbMat);
      mesh.position.copy(origin);
      scene.add(mesh);
      const dx = targetX - origin.x;
      const dy = targetY - origin.y;
      const dz = targetZ - origin.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      enemyOrbs.push({
        mesh,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        vz: (dz / dist) * speed,
        life: 4.5,
      });
    };

    const computeHudCounts = () => {
      if (gate) {
        const keysCollected = targets.filter((t) => t.kind === 'key' && t.collected).length;
        const totalKeys = targets.filter((t) => t.kind === 'key').length;
        return {
          collected: keysCollected + (gate.unlocked ? 1 : 0),
          total: totalKeys + 1,
          objectiveText: gate.unlocked
            ? 'Portão aberto! Caminhe através dele'
            : 'Suba e pegue a Chave',
        };
      }
      if (boss3d) {
        return {
          collected: boss3d.maxHp - boss3d.hp,
          total: boss3d.maxHp,
          objectiveText: `Chefe Colosso 3D · HP ${Math.round((boss3d.hp / boss3d.maxHp) * 100)}%`,
        };
      }
      const count = targets.filter((t) => t.collected).length;
      return {
        collected: count,
        total: targets.length,
        objectiveText:
          stage.objectiveType === 'ENEMIES'
            ? `Sentinelas restantes: ${targets.length - count}`
            : stage.goalLabel,
      };
    };

    const damagePlayer3D = (respawnToStart = false) => {
      if (invulnTimer > 0 || finished || timedOut || defeated) return;
      bumps += 1;
      invulnTimer = 0.95;
      flashOverlayAlpha = 0.55;
      soundEngine.playBump();
      spawnCrystalBurst(new THREE.Vector3(playerState.x, playerState.y + 1.0, playerState.z), 0xef4444, 6);

      if (stageMaxHp !== undefined) {
        playerHp = Math.max(0, playerHp - 1);
        const hudCounts = computeHudCounts();
        callbacksRef.current.onStatusUpdate({
          collected: hudCounts.collected,
          total: hudCounts.total,
          elapsedSec,
          staminaPct: stage.activeControls.includes('SHIFT') ? stamina : undefined,
          staminaExhausted: stage.activeControls.includes('SHIFT') ? staminaExhausted : undefined,
          objectiveText: hudCounts.objectiveText,
          bossHpPct: boss3d ? Math.round((boss3d.hp / boss3d.maxHp) * 100) : undefined,
          hp: playerHp,
          maxHp: stageMaxHp,
          ammo: maxAmmo > 0 ? ammo : undefined,
          maxAmmo: maxAmmo > 0 ? maxAmmo : undefined,
        });
        if (playerHp <= 0) {
          defeated = true;
          if (document.pointerLockElement === renderer.domElement) {
            document.exitPointerLock?.();
          }
          soundEngine.playFail();
          callbacksRef.current.onCoachHint(null);
          callbacksRef.current.onDefeated();
          return;
        }
      }

      if (respawnToStart) {
        playerState.x = 0;
        playerState.z = 16;
        playerState.y = 0;
        playerState.vy = 0;
        standingPlatform = null;
      }
    };

    const finishStage = () => {
      if (finished || timedOut || defeated) return;
      finished = true;
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }
      soundEngine.playComplete();
      callbacksRef.current.onCoachHint(null);
      const accuracyPct = isCombat3D
        ? shotsFired > 0
          ? Math.min(100, (shotsHit / shotsFired) * 100)
          : 100
        : Math.max(50, 100 - bumps * 5);

      callbacksRef.current.onComplete({
        stageId: stage.id,
        elapsedSec,
        accuracyPct,
        bumps,
      });
    };

    const triggerMelee3D = () => {
      if (!isFps || !hasMelee || meleeCooldown > 0 || pausedRef.current || finished || timedOut || defeated) {
        return;
      }
      meleeCooldown = 0.34;
      meleeSlashAnim = 0.24;
      soundEngine.playMeleeSlash();

      camera.getWorldDirection(_camDir);
      _camDir.normalize();

      // Spawn bright purple melee slash arc right in front of the camera
      const arcGeo = new THREE.TorusGeometry(0.65, 0.045, 6, 16, Math.PI * 0.85);
      const arcMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.92,
      });
      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.position.copy(camera.position).addScaledVector(_camDir, 1.35);
      arcMesh.quaternion.copy(camera.quaternion);
      arcMesh.rotateZ(-0.5);
      scene.add(arcMesh);
      slashVfxs.push({ mesh: arcMesh, life: 0.16 });

      let hitAnything = false;

      // 1. Cut enemy orbs in front of player (parry!)
      for (let i = enemyOrbs.length - 1; i >= 0; i--) {
        const orb = enemyOrbs[i];
        _toTarget.subVectors(orb.mesh.position, camera.position);
        const dist = _toTarget.length();
        if (dist <= 4.0) {
          _toTarget.normalize();
          if (_toTarget.dot(_camDir) > 0.22) {
            spawnCrystalBurst(orb.mesh.position, 0xc084fc, 5);
            scene.remove(orb.mesh);
            enemyOrbs.splice(i, 1);
            hitAnything = true;
          }
        }
      }

      // 2. Hit drone targets within 4.3m cone
      for (const target of targets) {
        if (target.collected || target.kind !== 'drone') continue;
        _toTarget.subVectors(target.group.position, camera.position);
        const dist = _toTarget.length();
        if (dist <= 4.35) {
          _toTarget.normalize();
          if (_toTarget.dot(_camDir) > 0.34) {
            target.collected = true;
            target.group.visible = false;
            shotsFired += 1;
            shotsHit += 1;
            hitAnything = true;
            spawnCrystalBurst(target.group.position, 0xc084fc, 10);
            soundEngine.playEnemyDefeat();
            if (!gate && !boss3d && stage.objectiveType === 'ENEMIES') {
              const killed = targets.filter((t) => t.kind === 'drone' && t.collected).length;
              if (killed >= targets.filter((t) => t.kind === 'drone').length) {
                finishStage();
              }
            }
          }
        }
      }

      // 3. Hit Boss 3D if within 6.8m cone (2 damage!)
      if (boss3d && !boss3d.defeated) {
        _toTarget.subVectors(boss3d.group.position, camera.position);
        const distBoss = _toTarget.length();
        if (distBoss <= 6.8) {
          _toTarget.normalize();
          if (_toTarget.dot(_camDir) > 0.34) {
            boss3d.hp = Math.max(0, boss3d.hp - 2);
            boss3d.flash = 0.16;
            shotsFired += 1;
            shotsHit += 1;
            hitAnything = true;
            soundEngine.playEnemyHit();
            spawnCrystalBurst(boss3d.group.position, 0xc084fc, 9);
            if (boss3d.hp <= 0) {
              boss3d.defeated = true;
              boss3d.group.visible = false;
              soundEngine.playEnemyDefeat();
              spawnCrystalBurst(boss3d.group.position, 0xfbbf24, 24);
              finishStage();
            }
          }
        }
      }

      if (hitAnything && maxAmmo > 0) {
        ammo = Math.min(maxAmmo, ammo + 2);
        ammoRegenTimer = 0;
      }
    };

    const fireShooterRay = () => {
      if (!isFps || !hasRanged || shootCooldown > 0 || pausedRef.current || finished || timedOut || defeated) {
        return;
      }
      if (ammo <= 0) {
        soundEngine.playBump();
        callbacksRef.current.onCoachHint(
          'Sem cargas de disparo! Corte orbes ou drones de perto com F / Botão Direito para recarregar!'
        );
        return;
      }

      ammo -= 1;
      shootCooldown = 0.2;
      shotsFired += 1;
      recoilOffset = 0.09;
      soundEngine.playShoot();

      raycaster.setFromCamera(_ndcCenter, camera);
      const intersects = raycaster.intersectObjects(rayShootables, false);

      _rayOrigin.copy(camera.position);
      _rayDir.copy(raycaster.ray.direction);
      const endDist = intersects.length > 0 ? intersects[0].distance : 38;
      const beamGeo = new THREE.CylinderGeometry(0.032, 0.032, endDist, 6);
      beamGeo.rotateX(Math.PI / 2);
      const beamMat2 = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat2);
      beamMesh.position.copy(_rayOrigin).addScaledVector(_rayDir, endDist / 2);
      beamMesh.position.y -= 0.14;
      _rayEnd.copy(_rayOrigin).addScaledVector(_rayDir, endDist);
      beamMesh.lookAt(_rayEnd);
      scene.add(beamMesh);
      beamPulses.push({ mesh: beamMesh, life: 0.1 });

      if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        if (hitObj.userData.isBoss && boss3d && !boss3d.defeated) {
          shotsHit += 1;
          boss3d.hp -= 1;
          boss3d.flash = 0.14;
          soundEngine.playEnemyHit();
          spawnCrystalBurst(intersects[0].point, 0xfbbf24, 6);
          if (boss3d.hp <= 0) {
            boss3d.defeated = true;
            boss3d.group.visible = false;
            soundEngine.playEnemyDefeat();
            spawnCrystalBurst(boss3d.group.position, 0xfbbf24, 24);
            finishStage();
          }
          return;
        }

        const targetId = hitObj.userData.targetId as number | undefined;
        if (targetId !== undefined) {
          const target = targets.find((t) => t.id === targetId);
          if (target && target.kind === 'drone' && !target.collected) {
            target.collected = true;
            target.group.visible = false;
            shotsHit += 1;
            spawnCrystalBurst(target.group.position, 0xfbbf24);
            soundEngine.playEnemyDefeat();
            if (!gate && !boss3d && stage.objectiveType === 'ENEMIES') {
              const killed = targets.filter((t) => t.kind === 'drone' && t.collected).length;
              if (killed >= targets.filter((t) => t.kind === 'drone').length) {
                finishStage();
              }
            }
          }
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!keys[e.code]) {
        keys[e.code] = true;
        if (e.code === 'Space') {
          playerState.jumpBuffer = 0.14;
        }
        if ((e.code === 'KeyF' || e.code === 'KeyJ') && hasMelee) {
          triggerMelee3D();
        }
        emitInput();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      emitInput();
    };

    const applyLookDelta = (dx: number, dy: number) => {
      const factor = 0.0024 * sensRef.current;
      playerState.yaw -= dx * factor;
      const ySign = invertYRef.current ? 1 : -1;
      playerState.pitch = THREE.MathUtils.clamp(
        playerState.pitch + dy * factor * ySign,
        isThirdPerson ? -0.92 : -1.25,
        isThirdPerson ? 0.18 : 1.25
      );
      lookSwayX = THREE.MathUtils.clamp(lookSwayX - dx * 0.0008, -0.055, 0.055);
      lookSwayY = THREE.MathUtils.clamp(lookSwayY - dy * 0.0006, -0.04, 0.04);
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      setPointerLocked(locked);
      setLockNotice(locked ? 'Mouse ativo · ESC para soltar' : 'Clique na arena para mirar · ou arraste com o mouse');
    };

    const handlePointerLockError = () => {
      setPointerLocked(false);
      setLockNotice('Modo arrastar: segure o clique e mova o mouse para olhar');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleCanvasMouseDown = (e: MouseEvent) => {
      if (pausedRef.current || finished || timedOut || defeated) return;

      if (e.button === 2) {
        e.preventDefault();
        rightMouseDown = true;
        emitInput();
        if (hasMelee) {
          triggerMelee3D();
        }
        return;
      }

      if (e.button !== 0) return;
      leftMouseDown = true;
      emitInput();

      if (document.pointerLockElement === renderer.domElement) {
        fireShooterRay();
      } else {
        isDraggingLook = true;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        if (hasRanged) fireShooterRay();
        try {
          const maybePromise = renderer.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined;
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => {
              setLockNotice('Modo arrastar: segure o clique e mova o mouse para olhar');
            });
          }
        } catch {
          // drag fallback
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        rightMouseDown = false;
      } else {
        leftMouseDown = false;
        isDraggingLook = false;
      }
      emitInput();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (pausedRef.current || finished || timedOut || defeated) return;
      if (document.pointerLockElement === renderer.domElement) {
        applyLookDelta(e.movementX || 0, e.movementY || 0);
      } else if (isDraggingLook) {
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        applyLookDelta(dx * 1.4, dy * 1.4);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    renderer.domElement.addEventListener('mousedown', handleCanvasMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    const handleContextLost = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const resize = () => {
      const r = container.getBoundingClientRect();
      const w = Math.max(320, r.width);
      const h = Math.max(200, r.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const getFloorSupportAt = (x: number, z: number, currentY: number): { y: number; platform: PlatformBox | null } => {
      let maxH = 0;
      let hitPlat: PlatformBox | null = null;
      for (const p of platforms) {
        if (x >= p.minX - 0.35 && x <= p.maxX + 0.35 && z >= p.minZ - 0.35 && z <= p.maxZ + 0.35) {
          if (currentY >= p.height - 0.65 && p.height > maxH) {
            maxH = p.height;
            hitPlat = p;
          }
        }
      }
      for (const rm of ramps) {
        if (x >= rm.minX - 0.3 && x <= rm.maxX + 0.3 && z >= rm.minZ - 0.2 && z <= rm.maxZ + 0.2) {
          const span = rm.maxZ - rm.minZ || 1;
          const t = rm.dir === 1 ? (z - rm.minZ) / span : (rm.maxZ - z) / span;
          const h = THREE.MathUtils.lerp(rm.startY, rm.endY, THREE.MathUtils.clamp(t, 0, 1));
          if (currentY >= h - 0.85 && h > maxH) {
            maxH = h;
            hitPlat = null;
          }
        }
      }
      return { y: maxH, platform: hitPlat };
    };

    const isUnderOverheadBeam = (tx: number, tz: number, curY: number): boolean => {
      for (const ob of overheadBeams) {
        if (
          tx > ob.minX - 0.35 &&
          tx < ob.maxX + 0.35 &&
          tz > ob.minZ - 0.35 &&
          tz < ob.maxZ + 0.35 &&
          curY <= (ob.baseY ?? 1.12)
        ) {
          return true;
        }
      }
      return false;
    };

    const isPointBlocked = (tx: number, tz: number, curY: number, crouching: boolean, sliding: boolean): boolean => {
      const rampSupportH = getFloorSupportAt(tx, tz, curY).y;
      const effY = Math.max(curY, rampSupportH);

      for (const p of platforms) {
        if (
          tx > p.minX - 0.36 &&
          tx < p.maxX + 0.36 &&
          tz > p.minZ - 0.36 &&
          tz < p.maxZ + 0.36 &&
          effY < p.height - 0.52 &&
          effY + (sliding ? 0.85 : crouching ? 1.0 : 1.72) > (p.baseY ?? 0)
        ) {
          return true;
        }
      }
      if (gate && !gate.unlocked) {
        if (tx > gate.x - 2.3 && tx < gate.x + 2.3 && tz > gate.z - 0.65 && tz < gate.z + 0.65) {
          callbacksRef.current.onCoachHint('Portão selado! Colete a Chave dourada primeiro para abri-lo.');
          return true;
        }
      }
      const playerTop = curY + (sliding ? 0.85 : crouching ? 1.0 : 1.72);
      for (const ob of overheadBeams) {
        if (
          tx > ob.minX - 0.35 &&
          tx < ob.maxX + 0.35 &&
          tz > ob.minZ - 0.35 &&
          tz < ob.maxZ + 0.35 &&
          (playerTop > (ob.baseY ?? 1.12) || curY > (ob.baseY ?? 1.12) - 0.15)
        ) {
          callbacksRef.current.onCoachHint('Segure C/Ctrl para agachar ou Shift+C para dar Slide por baixo do pórtico!');
          return true;
        }
      }
      return false;
    };

    const isSegmentBlocked = (
      fromX: number,
      fromZ: number,
      toX: number,
      toZ: number,
      curY: number,
      crouching: boolean,
      sliding: boolean
    ): boolean => {
      const dist = Math.hypot(toX - fromX, toZ - fromZ);
      const steps = Math.max(1, Math.ceil(dist / 0.24));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const sx = THREE.MathUtils.lerp(fromX, toX, t);
        const sz = THREE.MathUtils.lerp(fromZ, toZ, t);
        if (isPointBlocked(sx, sz, curY, crouching, sliding)) {
          return true;
        }
      }
      return false;
    };

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      if (!pausedRef.current && !finished && !timedOut && !defeated) {
        elapsedSec += dt;

        if (stage.timeLimitSec && elapsedSec >= stage.timeLimitSec) {
          timedOut = true;
          if (document.pointerLockElement === renderer.domElement) {
            document.exitPointerLock?.();
          }
          soundEngine.playFail();
          callbacksRef.current.onCoachHint(null);
          callbacksRef.current.onTimeout();
        }

        // 1. Update moving platforms and compute per-frame delta
        for (const p of platforms) {
          if (p.mesh && p.capMesh && p.originX !== undefined && p.originY !== undefined && p.originZ !== undefined) {
            const spd = p.moveSpeed ?? 1.2;
            const ph = p.phase ?? 0;
            const nx = p.originX + Math.sin(elapsed * spd + ph) * (p.moveAmpX ?? 0);
            const ny = p.originY + Math.sin(elapsed * spd + ph) * (p.moveAmpY ?? 0);
            const nz = p.originZ + Math.sin(elapsed * spd + ph) * (p.moveAmpZ ?? 0);
            p.dx = nx - (p.prevX ?? nx);
            p.dy = ny - (p.prevY ?? ny);
            p.dz = nz - (p.prevZ ?? nz);
            p.prevX = nx;
            p.prevY = ny;
            p.prevZ = nz;

            const halfW = (p.width ?? 3.6) / 2;
            const halfD = (p.depth ?? 3.6) / 2;
            const thick = p.height - (p.baseY ?? p.height - 0.45);
            p.minX = nx - halfW;
            p.maxX = nx + halfW;
            p.minZ = nz - halfD;
            p.maxZ = nz + halfD;
            p.height = ny;
            p.baseY = ny - thick;

            p.mesh.position.set(nx, ny - thick / 2, nz);
            p.capMesh.position.set(nx, ny - 0.06, nz);
          }
        }

        // Carry player cleanly with moving platform if grounded on one
        if (playerState.grounded && standingPlatform && standingPlatform.mesh) {
          playerState.x = THREE.MathUtils.clamp(
            playerState.x + (standingPlatform.dx ?? 0),
            -playableHalf + 0.7,
            playableHalf - 0.7
          );
          playerState.z = THREE.MathUtils.clamp(
            playerState.z + (standingPlatform.dz ?? 0),
            -playableHalf + 0.7,
            playableHalf - 0.7
          );
          playerState.y = standingPlatform.height;
        }

        invulnTimer = Math.max(0, invulnTimer - dt);
        shootCooldown = Math.max(0, shootCooldown - dt);
        meleeCooldown = Math.max(0, meleeCooldown - dt);
        meleeSlashAnim = Math.max(0, meleeSlashAnim - dt);
        playerState.slideCooldown = Math.max(0, playerState.slideCooldown - dt);
        flashOverlayAlpha = Math.max(0, flashOverlayAlpha - dt * 1.9);
        if (damageOverlayRef.current) {
          damageOverlayRef.current.style.opacity = String(flashOverlayAlpha);
        }
        recoilOffset = THREE.MathUtils.damp(recoilOffset, 0, 18, dt);
        lookSwayX = THREE.MathUtils.damp(lookSwayX, 0, 12, dt);
        lookSwayY = THREE.MathUtils.damp(lookSwayY, 0, 12, dt);
        landSquash = Math.max(0, landSquash - dt * 5.2);

        if (maxAmmo > 0 && ammo < maxAmmo) {
          ammoRegenTimer += dt;
          if (ammoRegenTimer >= 1.05) {
            ammoRegenTimer = 0;
            ammo += 1;
          }
        } else {
          ammoRegenTimer = 0;
        }

        const fwd = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
        const str = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);

        _forward.set(-Math.sin(playerState.yaw), 0, -Math.cos(playerState.yaw));
        _right.set(Math.cos(playerState.yaw), 0, -Math.sin(playerState.yaw));

        _moveDir.set(0, 0, 0).addScaledVector(_forward, fwd).addScaledVector(_right, str);
        const moving = _moveDir.lengthSq() > 0.001;
        if (moving) _moveDir.normalize();

        const canCrouch = stage.activeControls.includes('CTRL');
        const crouchHeld = canCrouch && Boolean(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC']);
        const crouchPressedThisFrame = crouchHeld && !wasCrouchDown;
        wasCrouchDown = crouchHeld;

        const canSprint = stage.activeControls.includes('SHIFT');
        const shiftHeld = canSprint && Boolean(keys['ShiftLeft'] || keys['ShiftRight']);

        // Trigger Slide if pressing C/Ctrl while grounded & moving fast with Shift!
        if (
          crouchPressedThisFrame &&
          canSprint &&
          shiftHeld &&
          moving &&
          playerState.grounded &&
          !staminaExhausted &&
          playerState.slideCooldown <= 0
        ) {
          playerState.slideTimer = 0.46;
          playerState.slideCooldown = 0.56;
          playerState.slideDirX = _moveDir.x;
          playerState.slideDirZ = _moveDir.z;
          stamina = Math.max(0, stamina - 10);
          soundEngine.playSlide();
        }

        if (playerState.slideTimer > 0) {
          playerState.slideTimer = Math.max(0, playerState.slideTimer - dt);
          playerState.sliding = true;
        } else {
          playerState.sliding = false;
        }

        // Prevent standing back up while under a low overhead beam
        const trappedUnderBeam = isUnderOverheadBeam(playerState.x, playerState.z, playerState.y);
        playerState.crouching = crouchHeld || playerState.sliding || trappedUnderBeam;

        currentEyeHeight = THREE.MathUtils.damp(
          currentEyeHeight,
          playerState.sliding ? 0.72 : playerState.crouching ? 0.92 : 1.65,
          16,
          dt
        );

        // Finite stamina with exhaustion lockout & recovery delay
        const wantsSprint = canSprint && !playerState.crouching && !playerState.sliding && shiftHeld && moving;
        let sprinting = false;
        if (!canSprint) {
          stamina = 100;
          staminaExhausted = false;
          staminaRegenDelay = 0;
        } else if (wantsSprint && !staminaExhausted && stamina > 0) {
          sprinting = true;
          stamina = Math.max(0, stamina - 33 * dt);
          staminaRegenDelay = 0.65;
          if (stamina <= 0) {
            staminaExhausted = true;
            staminaRegenDelay = 1.05;
            callbacksRef.current.onCoachHint('Fôlego esgotado! Solte o Shift por um instante para recarregar.');
          }
        } else if (!playerState.sliding) {
          staminaRegenDelay = Math.max(0, staminaRegenDelay - dt);
          if (staminaRegenDelay <= 0 && (!wantsSprint || staminaExhausted)) {
            const regenRate = staminaExhausted ? 24 : 28;
            stamina = Math.min(100, stamina + regenRate * dt);
            if (staminaExhausted && stamina >= 32) {
              staminaExhausted = false;
            }
          }
        }

        const speed = playerState.sliding
          ? 11.4
          : playerState.crouching
            ? 3.8
            : sprinting
              ? 9.8
              : 6.4;
        const dirX = playerState.sliding ? playerState.slideDirX : _moveDir.x;
        const dirZ = playerState.sliding ? playerState.slideDirZ : _moveDir.z;

        const candX = THREE.MathUtils.clamp(playerState.x + dirX * speed * dt, -playableHalf + 0.7, playableHalf - 0.7);
        const candZ = THREE.MathUtils.clamp(playerState.z + dirZ * speed * dt, -playableHalf + 0.7, playableHalf - 0.7);

        let bumpedAny = false;
        if (!isSegmentBlocked(playerState.x, playerState.z, candX, playerState.z, playerState.y, playerState.crouching, playerState.sliding)) {
          playerState.x = candX;
        } else {
          bumpedAny = true;
        }
        if (!isSegmentBlocked(playerState.x, playerState.z, playerState.x, candZ, playerState.y, playerState.crouching, playerState.sliding)) {
          playerState.z = candZ;
        } else {
          bumpedAny = true;
        }
        if (bumpedAny && invulnTimer <= 0) {
          bumps += 1;
        }

        const wasGrounded = playerState.grounded;
        const floorSupport = getFloorSupportAt(playerState.x, playerState.z, playerState.y);
        const floorY = floorSupport.y;
        if (playerState.grounded) {
          playerState.coyoteTimer = 0.13;
        } else {
          playerState.coyoteTimer = Math.max(0, playerState.coyoteTimer - dt);
        }
        playerState.jumpBuffer = Math.max(0, playerState.jumpBuffer - dt);

        if (
          stage.activeControls.includes('SPACE') &&
          !playerState.crouching &&
          !playerState.sliding &&
          playerState.jumpBuffer > 0 &&
          playerState.coyoteTimer > 0
        ) {
          playerState.vy = 8.8;
          playerState.grounded = false;
          standingPlatform = null;
          playerState.coyoteTimer = 0;
          playerState.jumpBuffer = 0;
          soundEngine.playJump();
        }

        playerState.vy -= 21 * dt;
        playerState.y += playerState.vy * dt;

        if (playerState.y <= floorY) {
          if (!wasGrounded && playerState.vy < -4.5) {
            landSquash = 1;
          }
          playerState.y = floorY;
          playerState.vy = 0;
          playerState.grounded = true;
          standingPlatform = floorSupport.platform;
          playerState.lastSafeX = playerState.x;
          playerState.lastSafeY = floorY;
          playerState.lastSafeZ = playerState.z;
        } else {
          playerState.grounded = false;
          standingPlatform = null;
        }

        // Smooth figure-8 weapon sway + recoil recovery for FPS caster & melee blade
        if (casterViewModel) {
          const swaySpeed = sprinting ? 12.5 : 8.2;
          const figX = moving && playerState.grounded ? Math.cos(elapsed * swaySpeed * 0.5) * 0.016 : 0;
          const figY =
            moving && playerState.grounded
              ? Math.abs(Math.sin(elapsed * swaySpeed)) * 0.014
              : Math.sin(elapsed * 2.1) * 0.004;
          const crouchRoll = playerState.sliding ? 0.28 : playerState.crouching ? 0.14 : 0;
          casterViewModel.group.position.set(
            0.32 + figX + lookSwayX * 0.5,
            -0.25 - figY + lookSwayY * 0.4,
            -0.46 + recoilOffset
          );
          casterViewModel.group.rotation.z = THREE.MathUtils.damp(
            casterViewModel.group.rotation.z,
            crouchRoll - lookSwayX * 1.4,
            12,
            dt
          );
          casterViewModel.group.rotation.x = THREE.MathUtils.damp(
            casterViewModel.group.rotation.x,
            recoilOffset * 1.2 + lookSwayY,
            14,
            dt
          );
          casterViewModel.crystalCore.rotation.y += dt * 2.4;
          casterViewModel.crystalCore.rotation.z += dt * 1.4;
        }

        if (bladeViewModel) {
          const slashProgress = meleeSlashAnim > 0 ? 1 - meleeSlashAnim / 0.24 : 0;
          if (meleeSlashAnim > 0) {
            const arc = Math.sin(slashProgress * Math.PI);
            bladeViewModel.position.set(-0.34 + arc * 0.45, -0.22 + arc * 0.08, -0.45 - arc * 0.18);
            bladeViewModel.rotation.set(0.22 + arc * 0.85, 0.3 - arc * 1.5, -0.28 - arc * 0.9);
          } else {
            const idleBob = Math.sin(elapsed * 2.4) * 0.008;
            bladeViewModel.position.set(-0.34 + lookSwayX * 0.3, -0.26 + idleBob + lookSwayY * 0.3, -0.45);
            bladeViewModel.rotation.set(0.22 + lookSwayY * 0.6, 0.3 - lookSwayX * 0.8, -0.28);
          }
        }

        for (let i = slashVfxs.length - 1; i >= 0; i--) {
          const sv = slashVfxs[i];
          sv.life -= dt;
          sv.mesh.scale.setScalar(1 + (0.16 - sv.life) * 3.5);
          (sv.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (sv.life / 0.16) * 0.9);
          if (sv.life <= 0) {
            scene.remove(sv.mesh);
            sv.mesh.geometry.dispose();
            (sv.mesh.material as THREE.Material).dispose();
            slashVfxs.splice(i, 1);
          }
        }

        for (const fl of flames) {
          fl.mesh.position.y = fl.baseY + Math.sin(elapsed * 7 + fl.phase) * 0.045;
          fl.mesh.rotation.y += dt * 2.4;
          const sc = 0.92 + Math.sin(elapsed * 11 + fl.phase) * 0.1;
          fl.mesh.scale.set(0.85 * sc, 1.45 * sc, 0.85 * sc);
        }

        for (const d of drones) {
          const segLen = Math.hypot(d.bx - d.ax, d.bz - d.az) || 1;
          d.t += (d.speed / segLen) * d.dir * dt;
          if (d.t >= 1) {
            d.t = 1;
            d.dir = -1;
          } else if (d.t <= 0) {
            d.t = 0;
            d.dir = 1;
          }
          d.group.position.set(
            THREE.MathUtils.lerp(d.ax, d.bx, d.t),
            Math.sin(elapsed * 3.5) * 0.12,
            THREE.MathUtils.lerp(d.az, d.bz, d.t)
          );
          d.group.rotation.y += dt * 2.5;
          d.ringMesh.rotation.z += dt * 3.0;

          const dist = Math.hypot(playerState.x - d.group.position.x, playerState.z - d.group.position.z);
          if (dist < 1.3 && playerState.y < 1.6 && invulnTimer <= 0) {
            damagePlayer3D(true);
          }
        }

        // Collect coins / keys on touch
        for (const t of targets) {
          if (t.collected || t.kind === 'drone') continue;
          const dx = playerState.x - t.group.position.x;
          const dz = playerState.z - t.group.position.z;
          const dy = Math.abs(playerState.y - t.baseY);
          if (dx * dx + dz * dz < 1.75 * 1.75 && dy < 1.9) {
            t.collected = true;
            t.group.visible = false;
            spawnCrystalBurst(t.group.position, 0xfbbf24);
            const count = targets.filter((x) => x.kind !== 'drone' && x.collected).length;
            if (t.kind === 'key') {
              soundEngine.playKeyPickup();
              callbacksRef.current.onCoachHint('Chave obtida! Agora vá até o Portão Monumental para abrir!');
            } else {
              soundEngine.playCoin(count);
            }
            if (!gate && !boss3d && stage.objectiveType === 'COINS' && count >= targets.length) {
              finishStage();
            }
          }
        }

        // Armed shooter drones telegraph & fire dodgeable plasma orbs
        for (const t of targets) {
          if (t.collected || t.kind !== 'drone') continue;
          t.fireTimer -= dt;
          if (t.eyeMat) {
            const priming = t.fireTimer <= 0.48;
            t.eyeMat.color.setHex(priming ? 0xf87171 : 0xfef08a);
            t.eyeMat.emissive.setHex(priming ? 0xef4444 : 0xf59e0b);
            t.eyeMat.emissiveIntensity = priming ? 2.1 : 1.1;
          }
          if (t.fireTimer <= 0) {
            t.fireTimer = t.firePeriod;
            const orbSpeed = stage.id === 29 ? 5.8 : stage.id >= 32 ? 8.2 : stage.id === 31 ? 7.6 : 6.6;
            spawnEnemyOrb3D(
              t.group.position,
              playerState.x + (Math.random() - 0.5) * 0.65,
              playerState.y + currentEyeHeight * 0.72,
              playerState.z + (Math.random() - 0.5) * 0.65,
              orbSpeed
            );
          }
        }

        if (gate) {
          const keyTargets = targets.filter((t) => t.kind === 'key');
          const allKeysCollected = keyTargets.length > 0 && keyTargets.every((t) => t.collected);
          if (allKeysCollected && !gate.unlocked) {
            gate.unlocked = true;
            soundEngine.playDoorUnlock();
            gate.beaconMat.color.setHex(0x10b981);
            gate.beaconMat.emissive.setHex(0x059669);
            const mat = gate.barrierMesh.material as THREE.MeshStandardMaterial;
            mat.color.setHex(0x10b981);
            mat.emissive.setHex(0x059669);
            mat.opacity = 0.42;
          }
          if (gate.unlocked) {
            gate.openProgress = Math.min(1, gate.openProgress + dt * 2);
            gate.barrierMesh.position.y = 1.8 - gate.openProgress * 1.55;
            gate.barrierMesh.scale.y = Math.max(0.08, 1 - gate.openProgress);

            const distGate = Math.hypot(playerState.x - gate.x, playerState.z - gate.z);
            if (distGate < 2.2) {
              finishStage();
            }
          }
        }

        // Boss 3D behavior (Stage 34 — O Colosso Monólito)
        if (boss3d && !boss3d.defeated) {
          boss3d.flash = Math.max(0, boss3d.flash - dt);
          boss3d.group.position.y = 3.5 + Math.sin(elapsed * 1.5) * 0.38;
          boss3d.coreMesh.rotation.y += dt * 1.8;
          boss3d.shieldRingGroup.rotation.y += dt * 0.95;
          boss3d.crownGroup.rotation.y -= dt * 0.6;
          boss3d.leftPauldron.position.y = 0.15 + Math.sin(elapsed * 2.2) * 0.2;
          boss3d.rightPauldron.position.y = 0.15 - Math.sin(elapsed * 2.2) * 0.2;

          const coreMat = boss3d.coreMesh.material as THREE.MeshStandardMaterial;
          coreMat.emissive.setHex(boss3d.flash > 0 ? 0xfbbf24 : 0x991b1b);

          boss3d.waveTimer -= dt;
          if (boss3d.waveTimer <= 0) {
            boss3d.waveTimer = boss3d.hp <= boss3d.maxHp / 2 ? 2.4 : 3.3;
            const ringMesh = new THREE.Mesh(
              new THREE.RingGeometry(0.85, 1.15, 32),
              new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
            );
            ringMesh.rotation.x = -Math.PI / 2;
            ringMesh.position.set(0, 0.2, -4);
            scene.add(ringMesh);
            shockRings.push({ mesh: ringMesh, radius: 1, maxRadius: 22, hitPlayer: false });

            const boltOriginL = new THREE.Vector3(-1.8, boss3d.group.position.y + 0.1, -3.5);
            const boltOriginR = new THREE.Vector3(1.8, boss3d.group.position.y + 0.1, -3.5);
            spawnEnemyOrb3D(boltOriginL, playerState.x - 0.5, playerState.y + currentEyeHeight * 0.72, playerState.z, 8.2);
            spawnEnemyOrb3D(boltOriginR, playerState.x + 0.5, playerState.y + currentEyeHeight * 0.72, playerState.z, 8.2);
          }
        }

        // Update incoming enemy plasma orbs (occluded by cover walls & crates!)
        for (let i = enemyOrbs.length - 1; i >= 0; i--) {
          const orb = enemyOrbs[i];
          orb.life -= dt;
          orb.mesh.position.x += orb.vx * dt;
          orb.mesh.position.y += orb.vy * dt;
          orb.mesh.position.z += orb.vz * dt;

          const ox = orb.mesh.position.x;
          const oy = orb.mesh.position.y;
          const oz = orb.mesh.position.z;

          let blockedByCover = oy <= 0.12 || Math.abs(ox) > playableHalf || Math.abs(oz) > playableHalf;
          if (!blockedByCover) {
            for (const p of platforms) {
              if (
                ox >= p.minX &&
                ox <= p.maxX &&
                oz >= p.minZ &&
                oz <= p.maxZ &&
                oy >= (p.baseY ?? 0) &&
                oy <= p.height + 0.15
              ) {
                blockedByCover = true;
                spawnCrystalBurst(orb.mesh.position, 0xfb7185, 4);
                break;
              }
            }
          }

          const playerMidY = playerState.y + (playerState.sliding ? 0.45 : playerState.crouching ? 0.55 : 0.95);
          const distToPlayer = Math.hypot(ox - playerState.x, (oy - playerMidY) * 0.7, oz - playerState.z);
          if (!blockedByCover && distToPlayer < 0.72) {
            damagePlayer3D(false);
            blockedByCover = true;
          }

          if (blockedByCover || orb.life <= 0) {
            scene.remove(orb.mesh);
            enemyOrbs.splice(i, 1);
          }
        }

        for (let i = shockRings.length - 1; i >= 0; i--) {
          const sr = shockRings[i];
          sr.radius += 6.5 * dt;
          sr.mesh.scale.setScalar(sr.radius);
          const dist = Math.hypot(playerState.x - 0, playerState.z - -4);
          if (!sr.hitPlayer && Math.abs(dist - sr.radius) < 0.75 && playerState.y < 0.55 && invulnTimer <= 0) {
            sr.hitPlayer = true;
            damagePlayer3D(false);
          }
          if (sr.radius >= sr.maxRadius) {
            scene.remove(sr.mesh);
            sr.mesh.geometry.dispose();
            (sr.mesh.material as THREE.Material).dispose();
            shockRings.splice(i, 1);
          }
        }

        // Organic Multi-Joint 3D Knight Animations (via shared threeAssets)
        if (knight3D) {
          knight3D.root.position.set(playerState.x, playerState.y, playerState.z);
          const heightAboveFloor = Math.max(0, playerState.y - floorY);
          const shadowScale = Math.max(0.45, 1 - heightAboveFloor * 0.14);
          knight3D.contactShadow.scale.setScalar(shadowScale);
          (knight3D.contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.78 * shadowScale;

          let turnRate = 0;
          if (moving) {
            const targetAngle = Math.atan2(-_moveDir.x, -_moveDir.z);
            let diff = targetAngle - knight3D.root.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const prevYaw = knight3D.root.rotation.y;
            knight3D.root.rotation.y += diff * Math.min(1, dt * 13);
            let yawDelta = knight3D.root.rotation.y - prevYaw;
            while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
            while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
            turnRate = THREE.MathUtils.clamp(yawDelta / Math.max(dt, 0.008), -7, 7);
            walkPhase += dt * (sprinting ? 14.2 : 9.4);
          }

          animateKnightPose3D(knight3D, {
            moving,
            sprinting,
            crouching: playerState.crouching,
            sliding: playerState.sliding,
            grounded: playerState.grounded,
            vy: playerState.vy,
            walkPhase,
            elapsed,
            turnRate,
            landSquash,
            dt,
          });

          blinkTimer -= dt;
          if (blinkTimer <= -0.11) {
            blinkTimer = 2.8 + Math.random() * 1.6;
          }
          const eyeScaleY = blinkTimer < 0 ? 0.14 : 1.0;
          knight3D.leftEye.scale.y = eyeScaleY;
          knight3D.rightEye.scale.y = eyeScaleY;
        }

        for (const t of targets) {
          if (t.collected) continue;
          t.coreMesh.rotation.y += dt * 2.1;
          if (t.ringMesh) {
            t.ringMesh.rotation.x += dt * 1.15;
            t.ringMesh.rotation.y -= dt * 0.95;
          }
          if (t.moveAmpX > 0) {
            t.group.position.x = t.originX + Math.sin(elapsed * 1.4 + t.orbitPhase) * t.moveAmpX;
          }
        }

        for (let i = bursts.length - 1; i >= 0; i--) {
          const b = bursts[i];
          b.life -= dt;
          b.vy -= 12 * dt;
          b.mesh.position.x += b.vx * dt;
          b.mesh.position.y += b.vy * dt;
          b.mesh.position.z += b.vz * dt;
          b.mesh.scale.setScalar(Math.max(0.01, b.life * 2));
          if (b.life <= 0) {
            scene.remove(b.mesh);
            if (i === 0) {
              b.mesh.geometry.dispose();
              (b.mesh.material as THREE.Material).dispose();
            }
            bursts.splice(i, 1);
          }
        }

        for (let i = beamPulses.length - 1; i >= 0; i--) {
          beamPulses[i].life -= dt;
          if (beamPulses[i].life <= 0) {
            scene.remove(beamPulses[i].mesh);
            beamPulses[i].mesh.geometry.dispose();
            (beamPulses[i].mesh.material as THREE.Material).dispose();
            beamPulses.splice(i, 1);
          }
        }

        hudTimer += dt;
        if (hudTimer >= 0.08) {
          hudTimer = 0;
          const hudCounts = computeHudCounts();
          callbacksRef.current.onStatusUpdate({
            collected: hudCounts.collected,
            total: hudCounts.total,
            elapsedSec,
            staminaPct: stage.activeControls.includes('SHIFT') ? stamina : undefined,
            staminaExhausted: stage.activeControls.includes('SHIFT') ? staminaExhausted : undefined,
            objectiveText: hudCounts.objectiveText,
            bossHpPct: boss3d ? Math.round((boss3d.hp / boss3d.maxHp) * 100) : undefined,
            hp: stageMaxHp !== undefined ? playerHp : undefined,
            maxHp: stageMaxHp,
            ammo: maxAmmo > 0 ? ammo : undefined,
            maxAmmo: maxAmmo > 0 ? maxAmmo : undefined,
          });
        }
      }

      if (isThirdPerson) {
        const dist = 6.2;
        const horiz = Math.cos(playerState.pitch) * dist;
        const vert = -Math.sin(playerState.pitch) * dist + 1.9;
        _camGoal.set(
          playerState.x + Math.sin(playerState.yaw) * horiz,
          Math.max(1.2, playerState.y + vert),
          playerState.z + Math.cos(playerState.yaw) * horiz
        );
        camera.position.lerp(_camGoal, isSoftwareGl ? 0.5 : Math.min(1, dt * 12));
        _lookTarget.set(playerState.x, playerState.y + 1.35, playerState.z);
        camera.lookAt(_lookTarget);
      } else {
        camera.position.set(playerState.x, playerState.y + currentEyeHeight, playerState.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = playerState.yaw;
        camera.rotation.x = playerState.pitch;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      tick();
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();

      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }

      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      renderer.domElement.removeEventListener('mousedown', handleCanvasMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
      stoneTex.dispose();
      woodTex.dispose();
      hazardTex.dispose();
      shadowTex.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, [stage, lowPowerMode, resetSignal]);

  return (
    <div className="relative w-full h-full bg-[#0d1526] overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full" />

      <div
        ref={damageOverlayRef}
        className="pointer-events-none absolute inset-0 z-10 bg-red-600/35 opacity-0 transition-opacity duration-75"
      />

      {stage.engine === '3D-FPS' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_0_2px_rgba(15,23,42,0.85)]" />
            <div className="absolute w-5 h-[2px] bg-white/80" />
            <div className="absolute h-5 w-[2px] bg-white/80" />
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-lg bg-slate-950/85 border border-slate-700/70 text-[11px] text-slate-100 whitespace-nowrap">
        {pointerLocked ? 'Mouse ativo · ESC para soltar' : lockNotice}
      </div>
    </div>
  );
};
