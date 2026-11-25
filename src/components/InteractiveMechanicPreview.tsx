import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Check } from 'lucide-react';
import { DemoActionType, KeyControlId, LiveInputState } from '../types/game';
import { soundEngine } from '../utils/audio';
import { installGameShortcutGuard } from '../utils/shortcutGuard';
import {
  animateKnightPose3D,
  buildFirstPersonCaster,
  buildFirstPersonMeleeBlade,
  buildStylizedKnight3D,
  createContactShadowTexture,
  createHazardStripeTexture,
  createStoneFlagstoneTexture,
  detectSoftwareGl,
} from './engines/threeAssets';

interface InteractiveMechanicPreviewProps {
  action: DemoActionType;
  mode: 'demo' | 'interactive';
  targetControl?: KeyControlId;
  onInteractiveSuccess?: () => void;
  onLiveInputChange?: (input: LiveInputState) => void;
}

const DEMO_CAPTIONS: Record<DemoActionType, string> = {
  WALK: 'Exemplo: Segurando W / A / S / D para caminhar até as moedas douradas',
  DIAGONAL: 'Exemplo: W + D juntos cortam curvas suavemente em 45°',
  SPRINT: 'Exemplo: Segure Shift para correr rápido administrando a barra de fôlego',
  CROUCH: 'Exemplo: Segure C ou Ctrl para abaixar e passar sob o feixe azul',
  KEY_DOOR: 'Exemplo: Pegue a Chave Dourada para destrancar a Porta Blindada',
  AIM: 'Exemplo: O teclado anda, o Mouse mira para calibrar o radar',
  MELEE: 'Exemplo: Pressione F ou Botão Direito para cortar de perto e aparar orbes',
  SHOOT: 'Exemplo: Dispare com Clique Esq. (munição limitada) e recarregue com golpes F',
  BOSS_2D: 'Exemplo: Circule desviando das rajadas e acerte as brechas do Chefe',
  JUMP: 'Exemplo: Toque rápido em Espaço = pulo curto · Segurar = pulo alto',
  DOUBLE_JUMP: 'Exemplo: Aperte Espaço de novo no ar para alcançar plataformas altas',
  WALL_CLIMB: 'Exemplo (Hollow Knight): Encoste na parede e alterne Espaço para subir',
  SLIDE: 'Exemplo: Corra com Shift e aperte C / Ctrl / S para dar um Deslize veloz!',
  SLIDE_CROUCH: 'Exemplo: Deslize (Shift + C/S) sob vigas baixas impossíveis de passar em pé',
  PLATFORM_COMBAT: 'Exemplo: Corte perto com F/Dir. e lance Ondas Arcanas com Clique Esq.',
  BOSS_PLATFORM: 'Exemplo: Salte sobre as ondas do Cavaleiro Sombrio e contra-ataque',
  CAMERA_3D: 'Exemplo 3D: W anda para frente e o Mouse gira a câmera ao redor do cavaleiro',
  JUMP_3D: 'Exemplo 3D: Incline a câmera e use Espaço para saltar entre terraços 3D',
  PARKOUR_3D: 'Exemplo 3D: Saltos precisos entre plataformas altas e pontes móveis',
  SPRINT_3D: 'Exemplo 3D: Use Shift para ganhar impulso pelas rampas até a cobertura alta',
  FPS_CROUCH: 'Exemplo 3D FPS: Segure C ou Ctrl para abaixar sob o pórtico fechado',
  FPS_SLIDE: 'Exemplo 3D FPS: Corra com Shift e aperte C/Ctrl para deslizar rápido pelo túnel',
  FPS_MELEE: 'Exemplo 3D FPS: Aperte F ou Botão Direito para cortar drones e aparar orbes',
  FPS_SHOOT: 'Exemplo 3D FPS: Alinhe a mira (+) e clique Esq. (F/Dir. recarrega cargas)',
  BOSS_3D: 'Exemplo 3D FPS: Pule (Espaço) as ondas vermelhas e atire no núcleo do Colosso',
};

const IS_3D_PREVIEW: Record<DemoActionType, boolean> = {
  WALK: false,
  DIAGONAL: false,
  SPRINT: false,
  CROUCH: false,
  KEY_DOOR: false,
  AIM: false,
  MELEE: false,
  SHOOT: false,
  BOSS_2D: false,
  JUMP: false,
  DOUBLE_JUMP: false,
  WALL_CLIMB: false,
  SLIDE: false,
  SLIDE_CROUCH: false,
  PLATFORM_COMBAT: false,
  BOSS_PLATFORM: false,
  CAMERA_3D: true,
  JUMP_3D: true,
  PARKOUR_3D: true,
  SPRINT_3D: true,
  FPS_CROUCH: true,
  FPS_SLIDE: true,
  FPS_MELEE: true,
  FPS_SHOOT: true,
  BOSS_3D: true,
};

interface PreviewCanvasProps extends InteractiveMechanicPreviewProps {
  onConfirmVisual: (label: string) => void;
}

const Preview3DCanvas: React.FC<PreviewCanvasProps> = ({
  action,
  mode,
  targetControl,
  onConfirmVisual,
  onLiveInputChange,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const inputCbRef = useRef(onLiveInputChange);
  inputCbRef.current = onLiveInputChange;
  const confirmRef = useRef(onConfirmVisual);
  confirmRef.current = onConfirmVisual;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const removeGuard = mode === 'interactive' ? installGameShortcutGuard() : () => {};
    const isSoftwareGl = detectSoftwareGl();
    const isFPS =
      action === 'SPRINT_3D' ||
      action === 'FPS_CROUCH' ||
      action === 'FPS_SLIDE' ||
      action === 'FPS_MELEE' ||
      action === 'FPS_SHOOT' ||
      action === 'BOSS_3D';

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));

    const W = 560;
    const H = 260;
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isFPS ? 0x0d1526 : 0x101c33);
    scene.fog = new THREE.Fog(isFPS ? 0x0d1526 : 0x101c33, 14, 38);

    const camera = new THREE.PerspectiveCamera(isFPS ? 68 : 56, W / H, 0.1, 80);
    scene.add(camera);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.15);
    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.65);
    keyLight.position.set(10, 18, 10);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rimLight.position.set(-10, 8, -12);
    scene.add(hemiLight, keyLight, rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const stoneTex = createStoneFlagstoneTexture(maxAniso);
    stoneTex.repeat.set(8, 8);
    const hazardTex = createHazardStripeTexture(maxAniso);
    const shadowTex = createContactShadowTexture();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8, metalness: 0.1 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.18 });
    const tealTrimMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.35, metalness: 0.35 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.45,
      roughness: 0.24,
      metalness: 0.8,
    });

    // Context-specific real 3D scenery
    let knight3D: ReturnType<typeof buildStylizedKnight3D> | null = null;
    let casterModel: ReturnType<typeof buildFirstPersonCaster> | null = null;
    let meleeBladeModel: THREE.Group | null = null;
    let droneMesh: THREE.Group | null = null;
    let droneCoreMat: THREE.MeshStandardMaterial | null = null;
    let bossMesh: THREE.Group | null = null;
    let bossCoreMat: THREE.MeshStandardMaterial | null = null;
    let shockRing: THREE.Mesh | null = null;
    let coinMesh: THREE.Mesh | null = null;
    let mobilePlatform: THREE.Group | null = null;
    const beamPulses: { mesh: THREE.Mesh; life: number }[] = [];

    if (!isFPS) {
      knight3D = buildStylizedKnight3D(shadowTex, false);
      scene.add(knight3D.root);
    } else {
      casterModel = buildFirstPersonCaster();
      casterModel.group.position.set(0.32, -0.25, -0.46);
      camera.add(casterModel.group);

      if (action === 'FPS_MELEE' || action === 'FPS_SHOOT' || action === 'BOSS_3D') {
        meleeBladeModel = buildFirstPersonMeleeBlade();
        meleeBladeModel.position.set(-0.34, -0.26, -0.44);
        meleeBladeModel.rotation.set(0.35, 0.25, -0.25);
        camera.add(meleeBladeModel);
      }
    }

    if (action === 'CAMERA_3D' || action === 'JUMP_3D' || action === 'PARKOUR_3D' || action === 'SPRINT_3D') {
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 3.4), stoneMat);
      p1.position.set(0, 0.45, -1.5);
      const cap1 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.14, 3.5), tealTrimMat);
      cap1.position.set(0, 0.9, -1.5);
      scene.add(p1, cap1);

      if (action === 'PARKOUR_3D') {
        mobilePlatform = new THREE.Group();
        const mp = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 2.8), stoneMat);
        const mCap = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 2.9), tealTrimMat);
        mCap.position.y = 0.22;
        mobilePlatform.add(mp, mCap);
        mobilePlatform.position.set(0, 1.35, -5.6);
        scene.add(mobilePlatform);
      }

      const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.14, 16);
      coinGeo.rotateX(Math.PI / 2);
      coinMesh = new THREE.Mesh(coinGeo, goldMat);
      coinMesh.position.set(0, action === 'PARKOUR_3D' ? 2.4 : 1.75, action === 'PARKOUR_3D' ? -5.6 : -1.5);
      scene.add(coinMesh);
    }

    if (action === 'FPS_CROUCH' || action === 'FPS_SLIDE') {
      const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.4, metalness: 0.35 });
      const gantryCount = action === 'FPS_SLIDE' ? 2 : 1;
      for (let g = 0; g < gantryCount; g++) {
        const gz = g === 0 ? 0.5 : -3.8;
        const beam = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.8, 1.6), hazardMat);
        beam.position.set(0, 2.0, gz);
        const pilL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.0, 1.7), stoneMat);
        pilL.position.set(-2.6, 1.5, gz);
        const pilR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.0, 1.7), stoneMat);
        pilR.position.set(2.6, 1.5, gz);
        scene.add(beam, pilL, pilR);
      }
    }

    if (action === 'FPS_SHOOT' || action === 'FPS_MELEE') {
      droneMesh = new THREE.Group();
      droneMesh.position.set(0, 1.45, action === 'FPS_MELEE' ? 0.8 : -3.2);
      droneCoreMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xc2410c,
        emissiveIntensity: 0.85,
        roughness: 0.25,
      });
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), droneCoreMat);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.98, 0.06, 6, 20),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 })
      );
      droneMesh.add(body, ring);
      scene.add(droneMesh);
    }

    if (action === 'BOSS_3D') {
      bossMesh = new THREE.Group();
      bossMesh.position.set(0, 2.8, -5.5);
      bossCoreMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.95,
      });
      const carapace = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.75, 1.9, 6), stoneMat);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), bossCoreMat);
      core.position.z = 0.6;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.08, 6, 24), goldMat);
      halo.rotation.x = Math.PI / 2;
      bossMesh.add(carapace, core, halo);
      scene.add(bossMesh);

      shockRing = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1.15, 28),
        new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
      );
      shockRing.rotation.x = -Math.PI / 2;
      shockRing.position.set(0, 0.08, -5.5);
      scene.add(shockRing);
    }

    const keys: Record<string, boolean> = {};
    const mouse = { down: false, rightDown: false, travel: 0, lastX: -1, lastY: -1, dragging: false };
    let done = false;
    let actionProgress = 0;

    const sim = {
      x: 0,
      y: 0,
      z: 4.8,
      vy: 0,
      yaw: 0,
      pitch: isFPS ? -0.02 : -0.24,
      grounded: true,
      crouching: false,
      sliding: false,
      slideTimer: 0,
      eyeHeight: 1.55,
      walkPhase: 0,
      recoil: 0,
      slashTimer: 0,
      targetFlash: 0,
    };

    const emitLive = () => {
      inputCbRef.current?.({
        w: Boolean(keys['KeyW'] || keys['ArrowUp']),
        a: Boolean(keys['KeyA'] || keys['ArrowLeft']),
        s: Boolean(keys['KeyS'] || keys['ArrowDown']),
        d: Boolean(keys['KeyD'] || keys['ArrowRight']),
        shift: Boolean(keys['ShiftLeft'] || keys['ShiftRight']),
        ctrl: Boolean(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC']),
        space: Boolean(keys['Space']),
        f: Boolean(keys['KeyF']),
        mouseDown: mouse.down,
        rightMouseDown: mouse.rightDown,
      });
    };

    const confirm = (label: string) => {
      if (done || mode !== 'interactive') return;
      done = true;
      soundEngine.playWarmupHit(2);
      confirmRef.current(label);
    };

    const fireBeam = () => {
      sim.recoil = 0.08;
      sim.targetFlash = 0.16;
      soundEngine.playShoot();
      const geo = new THREE.CylinderGeometry(0.03, 0.03, 7, 6);
      geo.rotateX(Math.PI / 2);
      const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      beam.position.copy(camera.position).addScaledVector(fwd, 3.6);
      beam.position.y -= 0.14;
      beam.quaternion.copy(camera.quaternion);
      scene.add(beam);
      beamPulses.push({ mesh: beam, life: 0.12 });
    };

    const doMelee = () => {
      sim.slashTimer = 0.24;
      sim.targetFlash = 0.2;
      soundEngine.playMeleeSlash();
      if (targetControl === 'F') {
        confirm('Golpe de Lâmina 3D executado!');
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'interactive') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!keys[e.code]) {
        keys[e.code] = true;
        emitLive();
        if (e.code === 'Space' && sim.grounded) {
          sim.vy = 7.2;
          sim.grounded = false;
          soundEngine.playJump();
          if (targetControl === 'SPACE') confirm('Salto 3D executado!');
        }
        if (e.code === 'KeyF' && isFPS) {
          doMelee();
        }
        if ((e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight') && (keys['ShiftLeft'] || keys['ShiftRight'])) {
          sim.slideTimer = 0.45;
          soundEngine.playSlide();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      emitLive();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (mode !== 'interactive') return;
      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;
      mouse.dragging = true;
      if (e.button === 2) {
        mouse.rightDown = true;
        doMelee();
      } else if (e.button === 0) {
        mouse.down = true;
        if (isFPS) {
          fireBeam();
          if (targetControl === 'MOUSE_CLICK') confirm('Disparo 3D confirmado!');
        }
      }
      emitLive();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (mode !== 'interactive') return;
      if (mouse.lastX >= 0 && (mouse.dragging || targetControl === 'MOUSE_AIM')) {
        const dx = e.clientX - mouse.lastX;
        const dy = e.clientY - mouse.lastY;
        mouse.travel += Math.hypot(dx, dy);
        // Non-inverted standard PC camera look!
        sim.yaw -= dx * 0.0052;
        sim.pitch = THREE.MathUtils.clamp(
          sim.pitch - dy * 0.0038,
          isFPS ? -0.65 : -0.58,
          isFPS ? 0.55 : 0.14
        );
      }
      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;
      if (targetControl === 'MOUSE_AIM' && mouse.travel > 110) {
        confirm('Câmera 3D alinhada!');
      }
    };

    const onPointerUp = () => {
      mouse.down = false;
      mouse.rightDown = false;
      mouse.dragging = false;
      emitLive();
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointerup', onPointerUp);

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let lastFrameRender = 0;

    const tick = (now: number) => {
      if (disposed) return;
      frameId = requestAnimationFrame(tick);

      if (isSoftwareGl && now - lastFrameRender < 55) return;
      lastFrameRender = now;

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      sim.recoil = THREE.MathUtils.damp(sim.recoil, 0, 16, dt);
      sim.slashTimer = Math.max(0, sim.slashTimer - dt);
      sim.targetFlash = Math.max(0, sim.targetFlash - dt);

      let moving = false;
      let sprinting = false;

      if (mode === 'demo') {
        if (action === 'CAMERA_3D') {
          sim.yaw = Math.sin(elapsed * 0.85) * 0.65;
          sim.x = Math.sin(elapsed * 0.85) * 1.4;
          sim.z = 3.8 - ((elapsed * 1.4) % 4.5);
          sim.y = 0;
          moving = true;
          sim.walkPhase += dt * 9.5;
        } else if (action === 'JUMP_3D' || action === 'PARKOUR_3D') {
          const ph = (elapsed % 2.6) / 2.6;
          sim.yaw = 0;
          sim.x = 0;
          sim.z = 4.2 - ph * 6.0;
          if (ph > 0.3 && ph < 0.68) {
            const jp = (ph - 0.3) / 0.38;
            sim.y = Math.sin(jp * Math.PI) * 1.65 + (ph > 0.5 ? 0.5 : 0);
            sim.grounded = false;
          } else {
            sim.y = ph >= 0.68 ? 1.0 : 0;
            sim.grounded = true;
          }
          moving = true;
          sim.walkPhase += dt * 10;
        } else if (action === 'SPRINT_3D') {
          const ph = (elapsed % 2.5) / 2.5;
          sim.yaw = 0;
          sim.x = 0;
          sim.z = 5.4 - ph * 6.2;
          sim.y = Math.max(0, (3.2 - sim.z) * 0.25);
          sprinting = true;
          moving = true;
          sim.walkPhase += dt * 14;
        } else if (action === 'FPS_CROUCH' || action === 'FPS_SLIDE') {
          const ph = (elapsed % 3.2) / 3.2;
          sim.yaw = 0;
          sim.x = 0;
          sim.z = 4.6 - ph * 9.6;
          sim.crouching = sim.z < 2.2 && sim.z > -1.4;
          sim.sliding = action === 'FPS_SLIDE' && sim.crouching;
          sprinting = action === 'FPS_SLIDE';
          moving = true;
          sim.walkPhase += dt * (sim.sliding ? 14 : 8);
        } else if (action === 'FPS_MELEE') {
          sim.x = Math.sin(elapsed * 1.4) * 0.6;
          sim.z = 3.2;
          sim.yaw = Math.sin(elapsed * 1.4) * 0.14;
          if (Math.floor(elapsed * 1.1) !== Math.floor((elapsed - dt) * 1.1)) {
            doMelee();
          }
        } else if (action === 'FPS_SHOOT') {
          sim.x = Math.sin(elapsed * 1.5) * 1.1;
          sim.z = 4.2;
          if (droneMesh) {
            droneMesh.position.x = Math.sin(elapsed * 1.3) * 2.1;
            sim.yaw = Math.atan2(-(droneMesh.position.x - sim.x), -(droneMesh.position.z - sim.z)) * 0.7;
          }
          if (Math.floor(elapsed * 1.6) !== Math.floor((elapsed - dt) * 1.6)) {
            fireBeam();
          }
        } else if (action === 'BOSS_3D') {
          sim.x = Math.sin(elapsed * 1.1) * 1.6;
          sim.z = 4.4;
          sim.yaw = Math.atan2(-sim.x, 9.5) * 0.5;
          const ringR = ((elapsed * 3.8) % 9.5) + 0.8;
          if (shockRing) shockRing.scale.setScalar(ringR);
          if (ringR > 8.0 && ringR < 9.4) {
            sim.y = Math.sin(((ringR - 8.0) / 1.4) * Math.PI) * 1.5;
            sim.grounded = false;
          } else {
            sim.y = 0;
            sim.grounded = true;
          }
          if (Math.floor(elapsed * 1.5) !== Math.floor((elapsed - dt) * 1.5)) {
            fireBeam();
          }
        }
      } else {
        const up = Boolean(keys['KeyW'] || keys['ArrowUp']);
        const down = Boolean(keys['KeyS'] || keys['ArrowDown']);
        const left = Boolean(keys['KeyA'] || keys['ArrowLeft']);
        const right = Boolean(keys['KeyD'] || keys['ArrowRight']);
        const shiftHeld = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
        const ctrlHeld = Boolean(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC']);

        sim.slideTimer = Math.max(0, sim.slideTimer - dt);
        sim.sliding = sim.slideTimer > 0;
        sim.crouching = ctrlHeld || sim.sliding;

        const fwd = (up ? 1 : 0) - (down ? 1 : 0);
        const str = (right ? 1 : 0) - (left ? 1 : 0);
        moving = fwd !== 0 || str !== 0 || sim.sliding;
        sprinting = shiftHeld && moving && !ctrlHeld;
        const spd = sim.sliding ? 9.5 : sim.crouching ? 3.1 : sprinting ? 7.0 : 4.6;

        const fx = -Math.sin(sim.yaw);
        const fz = -Math.cos(sim.yaw);
        const rx = Math.cos(sim.yaw);
        const rz = -Math.sin(sim.yaw);
        const moveF = sim.sliding && fwd === 0 ? 1 : fwd;
        sim.x = THREE.MathUtils.clamp(sim.x + (fx * moveF + rx * str) * spd * dt, -7, 7);
        sim.z = THREE.MathUtils.clamp(sim.z + (fz * moveF + rz * str) * spd * dt, -6, 7);
        if (moving) sim.walkPhase += dt * (sprinting ? 14 : 9.5);

        sim.vy -= 19 * dt;
        sim.y += sim.vy * dt;
        if (sim.y <= 0) {
          sim.y = 0;
          sim.vy = 0;
          sim.grounded = true;
        }

        const matchesTarget =
          (targetControl === 'W' && up) ||
          (targetControl === 'S' && down) ||
          (targetControl === 'A' && left) ||
          (targetControl === 'D' && right) ||
          (targetControl === 'SHIFT' && shiftHeld) ||
          (targetControl === 'CTRL' && ctrlHeld);
        if (matchesTarget) {
          actionProgress += dt;
          if (actionProgress > 0.22) confirm('Ação 3D executada!');
        }
      }

      sim.eyeHeight = THREE.MathUtils.damp(sim.eyeHeight, sim.sliding ? 0.72 : sim.crouching ? 0.92 : 1.55, 14, dt);

      if (coinMesh) coinMesh.rotation.y += dt * 2.4;
      if (mobilePlatform) {
        mobilePlatform.position.x = Math.sin(elapsed * 1.4) * 2.4;
        if (coinMesh && action === 'PARKOUR_3D') coinMesh.position.x = mobilePlatform.position.x;
      }
      if (droneMesh && droneCoreMat) {
        droneMesh.rotation.y += dt * 2.2;
        droneCoreMat.emissive.setHex(sim.targetFlash > 0 ? 0xfbbf24 : 0xc2410c);
      }
      if (bossMesh && bossCoreMat) {
        bossMesh.rotation.y += dt * 0.9;
        bossCoreMat.emissive.setHex(sim.targetFlash > 0 ? 0xfbbf24 : 0x991b1b);
      }

      if (knight3D) {
        knight3D.root.position.set(sim.x, sim.y, sim.z);
        knight3D.root.rotation.y = sim.yaw;
        animateKnightPose3D(knight3D, {
          moving,
          sprinting,
          crouching: sim.crouching,
          sliding: sim.sliding,
          grounded: sim.grounded,
          vy: sim.vy,
          walkPhase: sim.walkPhase,
          elapsed,
          dt,
        });
      }

      if (casterModel) {
        casterModel.group.position.set(0.32, -0.25 - (sim.sliding ? 0.04 : 0), -0.46 + sim.recoil);
        casterModel.crystalCore.rotation.y += dt * 2.5;
      }
      if (meleeBladeModel) {
        const swingProg = sim.slashTimer > 0 ? 1 - sim.slashTimer / 0.24 : 0;
        const swingAngle = sim.slashTimer > 0 ? Math.sin(swingProg * Math.PI) * 1.55 : 0;
        meleeBladeModel.position.set(-0.34 + swingAngle * 0.28, -0.26 + swingAngle * 0.08, -0.44 - swingAngle * 0.14);
        meleeBladeModel.rotation.set(0.35 + swingAngle * 0.85, 0.25 - swingAngle * 1.1, -0.25 - swingAngle * 0.9);
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

      if (!isFPS) {
        const dist = 4.6;
        const horiz = Math.cos(sim.pitch) * dist;
        const vert = -Math.sin(sim.pitch) * dist + 1.5;
        camera.position.set(
          sim.x + Math.sin(sim.yaw) * horiz,
          Math.max(0.85, sim.y + vert),
          sim.z + Math.cos(sim.yaw) * horiz
        );
        camera.lookAt(sim.x, sim.y + 1.1, sim.z);
      } else {
        camera.position.set(sim.x, sim.y + sim.eyeHeight, sim.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = sim.yaw;
        camera.rotation.x = sim.pitch;
      }

      renderer.render(scene, camera);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      removeGuard();
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerup', onPointerUp);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
      stoneTex.dispose();
      hazardTex.dispose();
      shadowTex.dispose();
      renderer.dispose();
    };
  }, [action, mode, targetControl]);

  const isFPS =
    action === 'SPRINT_3D' ||
    action === 'FPS_CROUCH' ||
    action === 'FPS_SLIDE' ||
    action === 'FPS_MELEE' ||
    action === 'FPS_SHOOT' ||
    action === 'BOSS_3D';

  return (
    <div className="relative w-full aspect-[560/260] rounded-xl overflow-hidden border border-slate-700/80 bg-[#090F1D]">
      <div ref={mountRef} className="w-full h-full" />
      {isFPS && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <div className="absolute w-4 h-[1.5px] bg-white/80" />
            <div className="absolute h-4 w-[1.5px] bg-white/80" />
          </div>
        </div>
      )}
      {mode === 'demo' ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-2.5 rounded-md bg-slate-950/88 px-3 py-1 text-center text-[11px] font-semibold text-slate-200">
          {DEMO_CAPTIONS[action]}
        </div>
      ) : (
        <div className="pointer-events-none absolute top-2.5 left-2.5 rounded-md bg-slate-950/82 px-2.5 py-1 text-[10px] font-semibold text-teal-300">
          Prévia 3D Real · Arraste o mouse para girar a visão
        </div>
      )}
    </div>
  );
};

export const InteractiveMechanicPreview: React.FC<InteractiveMechanicPreviewProps> = ({
  action,
  mode,
  targetControl,
  onInteractiveSuccess,
  onLiveInputChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [hintLabel, setHintLabel] = useState('');
  const successCbRef = useRef(onInteractiveSuccess);
  successCbRef.current = onInteractiveSuccess;
  const inputCbRef = useRef(onLiveInputChange);
  inputCbRef.current = onLiveInputChange;

  const is3D = IS_3D_PREVIEW[action];

  useEffect(() => {
    setConfirmed(false);
    setHintLabel('');
  }, [action, mode, targetControl]);

  useEffect(() => {
    if (is3D) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const removeGuard = mode === 'interactive' ? installGameShortcutGuard() : () => {};

    const W = 560;
    const H = 260;
    canvas.width = W;
    canvas.height = H;

    const keys: Record<string, boolean> = {};
    const mouse = { x: 400, y: 120, down: false, rightDown: false, travel: 0, lastX: -1, lastY: -1 };

    let actionProgress = 0;
    let done = false;

    const hero = {
      x: 110,
      y: 175,
      vx: 0,
      vy: 0,
      w: 28,
      h: 32,
      facing: 1,
      crouching: false,
      sliding: false,
      slideTimer: 0,
      grounded: true,
      jumpsUsed: 0,
      wallSliding: false,
      wallDir: 0,
      aimAngle: 0,
      walkCycle: 0,
      slashTimer: 0,
      slashAngle: 0,
      squashX: 1,
      squashY: 1,
      cape: [
        { x: 110, y: 175 },
        { x: 96, y: 178 },
        { x: 82, y: 182 },
      ],
    };

    const bullets: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    const sparks: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
    const enemyPos = { x: 430, y: 130, hp: 2, flash: 0 };

    const isSidePlatform =
      action === 'JUMP' ||
      action === 'DOUBLE_JUMP' ||
      action === 'WALL_CLIMB' ||
      action === 'SLIDE' ||
      action === 'SLIDE_CROUCH' ||
      action === 'PLATFORM_COMBAT' ||
      action === 'BOSS_PLATFORM';

    const resetHero = () => {
      hero.x = isSidePlatform ? 95 : 135;
      hero.y = isSidePlatform ? 190 : 140;
      hero.vx = 0;
      hero.vy = 0;
      hero.grounded = true;
      hero.jumpsUsed = 0;
      hero.crouching = false;
      hero.sliding = false;
      hero.slideTimer = 0;
      hero.wallSliding = false;
      hero.cape.forEach((p, idx) => {
        p.x = hero.x - idx * 10;
        p.y = hero.y;
      });
    };
    resetHero();

    const emitLiveInput = () => {
      inputCbRef.current?.({
        w: Boolean(keys['KeyW'] || keys['ArrowUp']),
        a: Boolean(keys['KeyA'] || keys['ArrowLeft']),
        s: Boolean(keys['KeyS'] || keys['ArrowDown']),
        d: Boolean(keys['KeyD'] || keys['ArrowRight']),
        shift: Boolean(keys['ShiftLeft'] || keys['ShiftRight']),
        ctrl: Boolean(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC']),
        space: Boolean(keys['Space']),
        f: Boolean(keys['KeyF']),
        mouseDown: mouse.down,
        rightMouseDown: mouse.rightDown,
      });
    };

    const spawnSparks = (x: number, y: number, color: string, count = 8) => {
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const sp = 55 + Math.random() * 110;
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, color });
      }
    };

    const triggerConfirm = (label: string) => {
      if (done || mode !== 'interactive') return;
      done = true;
      setConfirmed(true);
      setHintLabel(label);
      soundEngine.playWarmupHit(2);
      spawnSparks(hero.x, hero.y, '#2DD4BF', 14);
      successCbRef.current?.();
    };

    const performMelee = (ang: number) => {
      hero.slashTimer = 0.2;
      hero.slashAngle = ang;
      hero.facing = Math.cos(ang) >= 0 ? 1 : -1;
      soundEngine.playMeleeSlash();
      spawnSparks(hero.x + Math.cos(ang) * 34, hero.y + Math.sin(ang) * 34, '#A78BFA', 8);
      if (Math.hypot(enemyPos.x - hero.x, enemyPos.y - hero.y) < 110) {
        enemyPos.flash = 0.18;
      }
      if (targetControl === 'F') {
        triggerConfirm('Golpe Corpo a Corpo confirmado!');
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'interactive') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!keys[e.code]) {
        keys[e.code] = true;
        emitLiveInput();
        if (e.code === 'KeyF') {
          performMelee(hero.aimAngle || (hero.facing >= 0 ? 0 : Math.PI));
        }
        if (
          (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight' || (isSidePlatform && (e.code === 'KeyS' || e.code === 'ArrowDown'))) &&
          isSidePlatform &&
          (keys['ShiftLeft'] || keys['ShiftRight'] || Math.abs(hero.vx) > 150) &&
          hero.grounded
        ) {
          hero.slideTimer = 0.44;
          hero.vx = hero.facing * 420;
          soundEngine.playSlide();
          spawnSparks(hero.x, hero.y + 12, '#38BDF8', 8);
          if (action === 'SLIDE' || action === 'SLIDE_CROUCH') {
            triggerConfirm('Deslize executado!');
          }
        }
        if (e.code === 'Space' && isSidePlatform) {
          if (hero.wallSliding) {
            hero.vy = -420;
            hero.vx = -hero.wallDir * 240;
            hero.facing = -hero.wallDir;
            hero.wallSliding = false;
            hero.jumpsUsed = 1;
            hero.squashX = 0.78;
            hero.squashY = 1.24;
            soundEngine.playWallJump();
            spawnSparks(hero.x + hero.wallDir * 14, hero.y, '#99F6E4', 7);
            if (action === 'WALL_CLIMB') triggerConfirm('Salto na parede executado!');
          } else if (hero.grounded) {
            hero.vy = -410;
            hero.grounded = false;
            hero.jumpsUsed = 1;
            hero.squashX = 0.78;
            hero.squashY = 1.24;
            soundEngine.playJump();
            spawnSparks(hero.x, hero.y + 15, '#38BDF8', 6);
            if (action === 'JUMP') triggerConfirm('Salto executado!');
          } else if (hero.jumpsUsed < 2) {
            hero.vy = -380;
            hero.jumpsUsed = 2;
            hero.squashX = 0.76;
            hero.squashY = 1.25;
            soundEngine.playJump();
            spawnSparks(hero.x, hero.y + 14, '#FBBF24', 9);
            if (action === 'DOUBLE_JUMP') triggerConfirm('Salto duplo no ar!');
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      emitLiveInput();
    };

    const updateMouse = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const mx = ((clientX - r.left) / r.width) * W;
      const my = ((clientY - r.top) / r.height) * H;
      if (mouse.lastX >= 0) {
        mouse.travel += Math.hypot(mx - mouse.lastX, my - mouse.lastY);
      }
      mouse.lastX = mx;
      mouse.lastY = my;
      mouse.x = mx;
      mouse.y = my;
      if (mode === 'interactive' && targetControl === 'MOUSE_AIM' && mouse.travel > 120) {
        triggerConfirm('Mira movimentada!');
      }
    };

    const onPointerMove = (e: PointerEvent) => updateMouse(e.clientX, e.clientY);
    const onPointerDown = (e: PointerEvent) => {
      if (mode !== 'interactive') return;
      updateMouse(e.clientX, e.clientY);
      const ang = Math.atan2(mouse.y - hero.y, mouse.x - hero.x);
      if (e.button === 2) {
        mouse.rightDown = true;
        emitLiveInput();
        performMelee(ang);
        return;
      }
      if (e.button !== 0) return;
      mouse.down = true;
      emitLiveInput();
      if (
        targetControl === 'MOUSE_CLICK' ||
        action === 'SHOOT' ||
        action === 'BOSS_2D' ||
        action === 'PLATFORM_COMBAT' ||
        action === 'BOSS_PLATFORM'
      ) {
        hero.facing = Math.cos(ang) >= 0 ? 1 : -1;
        bullets.push({
          x: hero.x + Math.cos(ang) * 18,
          y: hero.y + Math.sin(ang) * 18,
          vx: Math.cos(ang) * 480,
          vy: Math.sin(ang) * 480,
          life: 1.0,
        });
        soundEngine.playShoot();
        if (targetControl === 'MOUSE_CLICK') triggerConfirm('Disparo confirmado!');
      }
    };
    const onPointerUp = () => {
      mouse.down = false;
      mouse.rightDown = false;
      emitLiveInput();
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointerup', onPointerUp);

    let rafId = 0;
    let last = performance.now();
    let clock = 0;

    const drawCompactKnight = (
      cx: number,
      cy: number,
      crouching: boolean,
      sliding: boolean,
      facing: number,
      sprinting: boolean,
      wallSliding: boolean
    ) => {
      const hh = sliding ? 16 : crouching ? 21 : 32;
      ctx.save();
      ctx.translate(cx, cy + hh / 2);
      if (sliding) ctx.rotate(-facing * 0.45);
      ctx.scale(hero.squashX, hero.squashY);
      ctx.translate(0, -hh / 2);

      const swing = hero.grounded && Math.abs(hero.vx) > 15 && !sliding ? Math.sin(hero.walkCycle) * 4.5 : 0;
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-7 + swing, hh / 2 - 5, 5, 5);
      ctx.fillRect(2 - swing, hh / 2 - 5, 5, 5);

      const cloakTop = crouching || sliding ? -4 : -2;
      ctx.fillStyle = wallSliding ? '#0E7490' : '#1E293B';
      ctx.beginPath();
      ctx.moveTo(-11, cloakTop);
      ctx.lineTo(11, cloakTop);
      ctx.lineTo(13, hh / 2 - 3);
      ctx.lineTo(5, hh / 2 - 6);
      ctx.lineTo(0, hh / 2 - 2);
      ctx.lineTo(-6, hh / 2 - 6);
      ctx.lineTo(-13, hh / 2 - 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = sliding ? '#38BDF8' : sprinting ? '#38BDF8' : crouching ? '#818CF8' : '#2DD4BF';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const maskY = sliding ? -5 : crouching ? -7 : -12;
      const maskW = 24;
      const maskH = sliding ? 14 : crouching ? 15 : 18;
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.roundRect(-maskW / 2, maskY - maskH / 2 + 4, maskW, maskH, 8);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-10, maskY - 2);
      ctx.quadraticCurveTo(-13, maskY - 14, -7, maskY - 17);
      ctx.quadraticCurveTo(-6, maskY - 10, -4, maskY - 4);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(10, maskY - 2);
      ctx.quadraticCurveTo(13, maskY - 14, 7, maskY - 17);
      ctx.quadraticCurveTo(6, maskY - 10, 4, maskY - 4);
      ctx.closePath();
      ctx.fill();

      const eyeShift = facing * 3;
      const blink = Math.sin(clock * 2.1) > 0.97;
      ctx.fillStyle = '#090D16';
      if (blink) {
        ctx.fillRect(-6 + eyeShift, maskY + 3, 5, 1.8);
        ctx.fillRect(2 + eyeShift, maskY + 3, 5, 1.8);
      } else {
        ctx.beginPath();
        ctx.ellipse(-4 + eyeShift, maskY + 3.5, 2.7, 3.8, 0, 0, Math.PI * 2);
        ctx.ellipse(4.5 + eyeShift, maskY + 3.5, 2.7, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawStylizedHero = (
      cx: number,
      cy: number,
      crouching: boolean,
      sliding: boolean,
      facing: number,
      aimAngle: number,
      topDown: boolean,
      sprinting: boolean,
      wallSliding: boolean
    ) => {
      ctx.strokeStyle = sliding || sprinting ? '#38BDF8' : crouching ? '#818CF8' : '#F59E0B';
      ctx.lineWidth = topDown ? 7 : 5.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy + (topDown ? 0 : -2));
      for (const node of hero.cape) {
        ctx.lineTo(node.x, node.y);
      }
      ctx.stroke();

      if (topDown) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(aimAngle);
        const rad = crouching ? 12 : 16;

        ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
        ctx.beginPath();
        ctx.arc(2, 4, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(rad * 0.65, -rad * 0.65, 4.5, 0, Math.PI * 2);
        ctx.arc(rad * 0.65, rad * 0.65, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fillStyle = '#0D9488';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = crouching ? '#818CF8' : '#99F6E4';
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect(3, -8, 10, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(8, -5, 3.5, 3.5);
        ctx.fillRect(8, 1.5, 3.5, 3.5);
        ctx.restore();
      } else {
        drawCompactKnight(cx, cy, crouching, sliding, facing, sprinting, wallSliding);
      }
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      clock += dt;

      hero.squashX += (1 - hero.squashX) * Math.min(1, dt * 14);
      hero.squashY += (1 - hero.squashY) * Math.min(1, dt * 14);
      hero.slashTimer = Math.max(0, hero.slashTimer - dt);

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }

      const t = clock % 4.0;
      let sprinting = false;

      if (mode === 'demo') {
        if (action === 'WALK') {
          const seg = Math.floor(clock / 1.0) % 4;
          const dirs = [[1, 0], [0, -1], [-1, 0], [0, 1]];
          const [dx, dy] = dirs[seg];
          hero.x = 280 + Math.cos(clock * 1.6) * 115;
          hero.y = 135 + Math.sin(clock * 1.6) * 55;
          hero.aimAngle = Math.atan2(dy, dx);
        } else if (action === 'DIAGONAL') {
          hero.x = 120 + (t / 4.0) * 320;
          hero.y = 195 - Math.abs(Math.sin(t * 1.5)) * 120;
          hero.aimAngle = -0.55;
        } else if (action === 'SPRINT') {
          sprinting = t > 0.8 && t < 3.2;
          hero.x = 70 + (t / 4.0) * 420;
          hero.y = 140;
          hero.aimAngle = 0;
          if (sprinting && Math.random() < 0.45) {
            sparks.push({ x: hero.x - 16, y: hero.y + (Math.random() - 0.5) * 14, vx: -70, vy: 0, life: 0.25, color: '#38BDF8' });
          }
        } else if (action === 'CROUCH') {
          hero.x = 70 + (t / 4.0) * 420;
          hero.y = 140;
          hero.crouching = hero.x > 210 && hero.x < 350;
          hero.aimAngle = 0;
        } else if (action === 'KEY_DOOR') {
          hero.x = t < 2.0 ? 90 + (t / 2.0) * 185 : 275 + ((t - 2.0) / 2.0) * 185;
          hero.y = 140;
          hero.aimAngle = 0;
        } else if (action === 'MELEE') {
          hero.x = 345 + Math.sin(clock * 1.8) * 18;
          hero.y = 135;
          hero.aimAngle = 0;
          if (Math.floor(clock * 1.6) !== Math.floor((clock - dt) * 1.6)) {
            hero.slashTimer = 0.22;
            hero.slashAngle = 0;
            enemyPos.flash = 0.18;
            spawnSparks(enemyPos.x, enemyPos.y, '#A78BFA', 8);
          }
        } else if (action === 'AIM' || action === 'SHOOT' || action === 'BOSS_2D') {
          hero.x = 125 + Math.cos(clock * 2.0) * 35;
          hero.y = 145 + Math.sin(clock * 2.5) * 45;
          enemyPos.y = 130 + Math.sin(clock * 2.2) * 55;
          hero.aimAngle = Math.atan2(enemyPos.y - hero.y, enemyPos.x - hero.x);
          if (action !== 'AIM' && Math.floor(clock * 2.5) !== Math.floor((clock - dt) * 2.5)) {
            bullets.push({ x: hero.x + 16, y: hero.y, vx: Math.cos(hero.aimAngle) * 440, vy: Math.sin(hero.aimAngle) * 440, life: 0.85 });
          }
        } else if (action === 'JUMP') {
          const ph = (clock % 2.2) / 2.2;
          hero.x = 80 + ph * 390;
          const jumpArc = Math.sin(ph * Math.PI);
          hero.y = 191 - (ph > 0.25 && ph < 0.75 ? Math.sin(((ph - 0.25) / 0.5) * Math.PI) * 90 : jumpArc * 12);
          hero.facing = 1;
          hero.walkCycle += dt * 10;
        } else if (action === 'DOUBLE_JUMP') {
          const ph = (clock % 2.6) / 2.6;
          hero.x = 75 + ph * 400;
          if (ph < 0.45) {
            hero.y = 191 - Math.sin((ph / 0.45) * Math.PI) * 58;
          } else {
            hero.y = 162 - Math.sin(((ph - 0.45) / 0.55) * Math.PI) * 85;
          }
          hero.facing = 1;
          hero.walkCycle += dt * 10;
        } else if (action === 'WALL_CLIMB') {
          const ph = (clock % 3.2) / 3.2;
          if (ph < 0.25) {
            const p = ph / 0.25;
            hero.x = 205 + p * 115;
            hero.y = 192 - Math.sin(p * Math.PI * 0.7) * 65;
            hero.facing = 1;
          } else if (ph < 0.55) {
            const p = (ph - 0.25) / 0.3;
            hero.x = 320 - p * 115;
            hero.y = 138 - Math.sin(p * Math.PI * 0.7) * 58;
            hero.facing = -1;
          } else if (ph < 0.85) {
            const p = (ph - 0.55) / 0.3;
            hero.x = 205 + p * 115;
            hero.y = 90 - Math.sin(p * Math.PI * 0.7) * 50;
            hero.facing = 1;
          } else {
            hero.x = 320;
            hero.y = 55;
            hero.facing = -1;
          }
        } else if (action === 'SLIDE' || action === 'SLIDE_CROUCH') {
          const ph = (clock % 2.6) / 2.6;
          hero.x = 65 + ph * 430;
          const underBeam = hero.x > 190 && hero.x < 365;
          hero.sliding = underBeam;
          hero.crouching = underBeam;
          hero.y = hero.sliding ? 199 : 191;
          hero.facing = 1;
          sprinting = true;
          hero.walkCycle += dt * 14;
          if (hero.sliding && Math.random() < 0.55) {
            sparks.push({ x: hero.x - 14, y: 204, vx: -90, vy: -20, life: 0.24, color: '#38BDF8' });
          }
        } else if (action === 'PLATFORM_COMBAT' || action === 'BOSS_PLATFORM') {
          const ph = (clock % 2.4) / 2.4;
          hero.x = 120 + Math.sin(clock * 2.0) * 45;
          hero.y = 191 - Math.abs(Math.sin(ph * Math.PI)) * 68;
          hero.facing = 1;
          enemyPos.y = action === 'BOSS_PLATFORM' ? 168 - Math.abs(Math.sin(clock * 2.4)) * 38 : 115 + Math.sin(clock * 2.5) * 32;
          const ang = Math.atan2(enemyPos.y - hero.y, enemyPos.x - hero.x);
          hero.aimAngle = ang;
          if (Math.floor(clock * 2.3) !== Math.floor((clock - dt) * 2.3)) {
            hero.slashTimer = 0.16;
            hero.slashAngle = ang;
            bullets.push({ x: hero.x + 16, y: hero.y, vx: Math.cos(ang) * 440, vy: Math.sin(ang) * 440, life: 0.85 });
          }
        }
      } else {
        const up = Boolean(keys['KeyW'] || keys['ArrowUp']);
        const down = Boolean(keys['KeyS'] || keys['ArrowDown']);
        const left = Boolean(keys['KeyA'] || keys['ArrowLeft']);
        const right = Boolean(keys['KeyD'] || keys['ArrowRight']);
        const shiftHeld = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
        const ctrlHeld = Boolean(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC'] || (isSidePlatform && down));

        if (isSidePlatform) {
          hero.slideTimer = Math.max(0, hero.slideTimer - dt);
          hero.sliding = hero.slideTimer > 0;
          hero.crouching = ctrlHeld || hero.sliding;
          const ix = (right ? 1 : 0) - (left ? 1 : 0);
          if (!hero.sliding) {
            const spd = hero.crouching ? 130 : shiftHeld ? 260 : 185;
            hero.vx += (ix * spd - hero.vx) * Math.min(1, dt * 12);
          } else {
            hero.vx *= Math.pow(0.45, dt);
          }
          if (ix !== 0) {
            hero.facing = ix;
            hero.walkCycle += dt * (shiftHeld ? 15 : 10);
          }

          hero.vy += 1050 * dt;
          hero.x = Math.max(40, Math.min(W - 40, hero.x + hero.vx * dt));
          hero.y += hero.vy * dt;

          hero.wallSliding = false;
          if (action === 'WALL_CLIMB') {
            if (hero.x > 180 && hero.x < 214 && hero.y < 190 && !hero.grounded && hero.vy > 0) {
              hero.wallSliding = true;
              hero.wallDir = -1;
              hero.vy = Math.min(hero.vy, 75);
              hero.x = 205;
            } else if (hero.x > 346 && hero.x < 380 && hero.y < 190 && !hero.grounded && hero.vy > 0) {
              hero.wallSliding = true;
              hero.wallDir = 1;
              hero.vy = Math.min(hero.vy, 75);
              hero.x = 355;
            }
          }

          const floorY = hero.sliding ? 199 : hero.crouching ? 197 : 191;
          if (hero.y >= floorY) {
            hero.y = floorY;
            hero.vy = 0;
            hero.grounded = true;
            hero.jumpsUsed = 0;
          } else {
            hero.grounded = false;
          }

          if (targetControl === 'CTRL' && (hero.crouching || hero.sliding)) {
            actionProgress += dt;
            if (actionProgress > 0.25) triggerConfirm('Agachado / Deslize confirmado!');
          } else if ((targetControl === 'A' || targetControl === 'D') && ix !== 0) {
            actionProgress += dt;
            if (actionProgress > 0.28) triggerConfirm('Movimento lateral confirmado!');
          } else if (targetControl === 'SHIFT' && shiftHeld) {
            sprinting = true;
            actionProgress += dt;
            if (actionProgress > 0.28) triggerConfirm('Corrida ativada!');
          }
        } else {
          hero.crouching = ctrlHeld;
          const ix = (right ? 1 : 0) - (left ? 1 : 0);
          const iy = (down ? 1 : 0) - (up ? 1 : 0);
          const len = Math.hypot(ix, iy);
          sprinting = shiftHeld && len > 0 && !hero.crouching;
          const spd = hero.crouching ? 110 : sprinting ? 290 : 185;
          hero.x = Math.max(40, Math.min(W - 40, hero.x + (len ? (ix / len) * spd : 0) * dt));
          hero.y = Math.max(36, Math.min(H - 36, hero.y + (len ? (iy / len) * spd : 0) * dt));

          if (action === 'AIM' || action === 'SHOOT' || action === 'MELEE' || action === 'BOSS_2D') {
            hero.aimAngle = Math.atan2(mouse.y - hero.y, mouse.x - hero.x);
          } else if (len > 0) {
            hero.aimAngle = Math.atan2(iy, ix);
          }

          if (sprinting && Math.random() < 0.45) {
            sparks.push({ x: hero.x - Math.cos(hero.aimAngle) * 14, y: hero.y - Math.sin(hero.aimAngle) * 14, vx: 0, vy: 0, life: 0.25, color: '#38BDF8' });
          }

          const matchesTarget =
            (targetControl === 'W' && up) ||
            (targetControl === 'S' && down) ||
            (targetControl === 'A' && left) ||
            (targetControl === 'D' && right) ||
            (targetControl === 'SHIFT' && shiftHeld) ||
            (targetControl === 'CTRL' && ctrlHeld);

          if (matchesTarget) {
            actionProgress += dt;
            if (actionProgress > 0.22) triggerConfirm('Ação executada!');
          }
        }
      }

      let prevX = hero.x - (isSidePlatform ? hero.facing * 6 : Math.cos(hero.aimAngle) * 6);
      let prevY = hero.y - (isSidePlatform ? 3 : Math.sin(hero.aimAngle) * 6);
      for (const node of hero.cape) {
        const dx = node.x - prevX;
        const dy = node.y - prevY;
        const dist = Math.hypot(dx, dy) || 1;
        const maxD = sprinting ? 13 : 9;
        if (dist > maxD) {
          node.x = prevX + (dx / dist) * maxD;
          node.y = prevY + (dy / dist) * maxD;
        }
        node.y += (isSidePlatform ? 18 : 0) * dt;
        prevX = node.x;
        prevY = node.y;
      }

      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (Math.hypot(b.x - enemyPos.x, b.y - enemyPos.y) < 22) {
          enemyPos.flash = 0.15;
          spawnSparks(b.x, b.y, '#FBBF24', 8);
          bullets.splice(i, 1);
          continue;
        }
        if (b.life <= 0) bullets.splice(i, 1);
      }
      enemyPos.flash = Math.max(0, enemyPos.flash - dt);

      ctx.fillStyle = '#090F1D';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 0; gy <= H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      if (isSidePlatform) {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, 207, W, 53);
        ctx.fillStyle = '#14B8A6';
        ctx.fillRect(0, 207, W, 4);

        if (action === 'WALL_CLIMB') {
          ctx.fillStyle = '#334155';
          ctx.fillRect(166, 24, 24, 183);
          ctx.fillRect(370, 24, 24, 183);
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(187, 24, 3, 183);
          ctx.fillRect(370, 24, 3, 183);
        }

        if (action === 'SLIDE' || action === 'SLIDE_CROUCH') {
          ctx.fillStyle = '#312E81';
          ctx.fillRect(195, 36, 165, 148);
          ctx.fillStyle = '#818CF8';
          ctx.fillRect(195, 181, 165, 3);
        }

        if (action === 'PLATFORM_COMBAT' || action === 'BOSS_PLATFORM') {
          ctx.beginPath();
          ctx.arc(enemyPos.x, enemyPos.y, action === 'BOSS_PLATFORM' ? 24 : 15, 0, Math.PI * 2);
          ctx.fillStyle = enemyPos.flash > 0 ? '#FEF08A' : action === 'BOSS_PLATFORM' ? '#7C3AED' : '#EA580C';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = action === 'BOSS_PLATFORM' ? '#C4B5FD' : '#FDBA74';
          ctx.stroke();
        }
      } else {
        if (action === 'CROUCH') {
          ctx.strokeStyle = '#38BDF8';
          ctx.setLineDash([8, 6]);
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(280, 36);
          ctx.lineTo(280, 224);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (action === 'KEY_DOOR') {
          ctx.fillStyle = '#FBBF24';
          ctx.beginPath();
          ctx.arc(275, 140, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = hero.x > 275 ? '#10B981' : '#EF4444';
          ctx.fillRect(420, 65, 22, 140);
        } else if (action === 'AIM' || action === 'SHOOT' || action === 'MELEE' || action === 'BOSS_2D') {
          ctx.beginPath();
          ctx.arc(enemyPos.x, enemyPos.y, action === 'BOSS_2D' ? 24 : 16, 0, Math.PI * 2);
          ctx.fillStyle = enemyPos.flash > 0 ? '#FEF08A' : action === 'BOSS_2D' ? '#EF4444' : '#F97316';
          ctx.fill();
        }
      }

      if (hero.slashTimer > 0) {
        ctx.save();
        ctx.translate(hero.x, hero.y);
        ctx.rotate(hero.slashAngle);
        ctx.globalAlpha = hero.slashTimer / 0.22;
        ctx.strokeStyle = '#C4B5FD';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(8, 0, 48, -0.95, 0.95);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      for (const b of bullets) {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const s of sparks) {
        ctx.globalAlpha = Math.max(0, s.life * 2.4);
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      drawStylizedHero(hero.x, hero.y, hero.crouching, hero.sliding, hero.facing, hero.aimAngle, !isSidePlatform, sprinting, hero.wallSliding);

      if (mode === 'demo') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(14, H - 36, W - 28, 24);
        ctx.fillStyle = '#CBD5E1';
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(DEMO_CAPTIONS[action], W / 2, H - 20);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      removeGuard();
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [action, mode, targetControl, is3D]);

  const handle3DConfirm = (label: string) => {
    setConfirmed(true);
    setHintLabel(label);
    successCbRef.current?.();
  };

  return (
    <div className="relative w-full">
      {is3D ? (
        <Preview3DCanvas
          action={action}
          mode={mode}
          targetControl={targetControl}
          onConfirmVisual={handle3DConfirm}
          onLiveInputChange={onLiveInputChange}
        />
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full aspect-[560/260] rounded-xl border border-slate-700/80 bg-[#090F1D] block"
        />
      )}

      {confirmed && mode === 'interactive' && (
        <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 text-slate-950 text-xs font-bold shadow">
          <Check className="w-3.5 h-3.5" />
          {hintLabel || 'Movimento confirmado!'}
        </div>
      )}
    </div>
  );
};
