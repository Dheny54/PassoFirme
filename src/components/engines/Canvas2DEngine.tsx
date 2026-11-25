import React, { useEffect, useRef } from 'react';
import {
  LiveInputState,
  StageCompletionPayload,
  StageHudStatus,
  StageMeta,
} from '../../types/game';
import { soundEngine } from '../../utils/audio';

interface Canvas2DEngineProps {
  stage: StageMeta;
  paused: boolean;
  lowPowerMode: boolean;
  resetSignal: number;
  onInputChange: (input: LiveInputState) => void;
  onStatusUpdate: (status: StageHudStatus) => void;
  onCoachHint: (hint: string | null) => void;
  onComplete: (payload: StageCompletionPayload) => void;
  onTimeout: () => void;
  onDefeated: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  baseX?: number;
  baseY?: number;
  moveAmpX?: number;
  moveAmpY?: number;
  moveSpeed?: number;
  phase?: number;
  prevX?: number;
  prevY?: number;
  overheadBar?: boolean;
  wallClimbable?: boolean;
}

interface LaserGate {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  period: number;
  offset: number;
  activeRatio: number;
  crouchSensor?: boolean;
}

interface Collectible {
  id: number;
  kind: 'coin' | 'portal' | 'key' | 'radar' | 'crystal';
  x: number;
  y: number;
  r: number;
  collected: boolean;
  charge: number;
}

interface EnemyBot {
  id: number;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  flash: number;
  defeated: boolean;
  angle: number;
  fireTimer?: number;
}

interface PlatformEnemy {
  id: number;
  kind: 'beetle' | 'wasp' | 'guard';
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  r: number;
  hp: number;
  maxHp: number;
  vx: number;
  minX: number;
  maxX: number;
  ampY?: number;
  phase: number;
  flash: number;
  defeated: boolean;
  facing: number;
  fireTimer?: number;
}

interface BossPlatform {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  state: 'PATROL' | 'TELEGRAPH' | 'DASH' | 'LEAP';
  stateTimer: number;
  facing: number;
  flash: number;
  grounded: boolean;
  defeated: boolean;
}

interface FloorWave {
  x: number;
  y: number;
  vx: number;
  life: number;
}

interface PatrolDrone {
  x: number;
  y: number;
  r: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  speed: number;
  t: number;
  dir: number;
  angle: number;
}

interface Boss2D {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  shieldAngle: number;
  fireTimer: number;
  movePhase: number;
  flash: number;
  defeated: boolean;
}

interface LockedDoor {
  x: number;
  y: number;
  w: number;
  h: number;
  keysNeeded: number;
  unlocked: boolean;
  openProgress: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevX: number;
  prevY: number;
  life: number;
  fromBoss?: boolean;
  isBladeWave?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const VIEW_W = 1280;
const VIEW_H = 720;

export const Canvas2DEngine: React.FC<Canvas2DEngineProps> = ({
  stage,
  paused,
  lowPowerMode,
  resetSignal,
  onInputChange,
  onStatusUpdate,
  onCoachHint,
  onComplete,
  onTimeout,
  onDefeated,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const lowPowerRef = useRef(lowPowerMode);
  lowPowerRef.current = lowPowerMode;

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
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const isPlatformer = stage.engine === '2D-PLATFORM';
    const hasRanged = stage.activeControls.includes('MOUSE_CLICK');
    const hasMelee = stage.activeControls.includes('F');
    const isPlatformCombat = isPlatformer && (hasRanged || hasMelee);
    const maxAmmo = hasRanged ? 5 : 0;

    const worldW = isPlatformer
      ? stage.id === 22
        ? 1440
        : stage.id === 21
          ? 2800
          : stage.id === 20
            ? 2600
            : stage.id === 19
              ? 2300
              : stage.id === 18
                ? 2750
                : stage.id === 17
                  ? 2850
                  : stage.id === 16
                    ? 1520
                    : stage.id === 15
                      ? 2500
                      : stage.id === 14
                        ? 2480
                        : 2350
      : VIEW_W;
    const worldH = isPlatformer && stage.id === 16 ? 1280 : VIEW_H;

    const keys: Record<string, boolean> = {};
    const mouse = {
      screenX: VIEW_W / 2,
      screenY: VIEW_H / 2,
      worldX: VIEW_W / 2,
      worldY: VIEW_H / 2,
      down: false,
      rightDown: false,
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
        mouseDown: mouse.down,
        rightMouseDown: mouse.rightDown,
      });
    };

    const player = {
      x: 160,
      y: 360,
      vx: 0,
      vy: 0,
      r: 18,
      w: 28,
      h: 32,
      crouching: false,
      sliding: false,
      slideTimer: 0,
      slideCooldown: 0,
      slideDir: 1 as -1 | 1,
      wasCrouchDown: false,
      facingX: 1,
      facingY: 0,
      aimAngle: 0,
      stamina: 100,
      staminaExhausted: false,
      staminaRegenDelay: 0,
      grounded: false,
      wallSliding: false,
      wallDir: 0 as -1 | 0 | 1,
      wallCoyoteTimer: 0,
      wallCoyoteDir: 0 as -1 | 0 | 1,
      wallJumpLockTimer: 0,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      jumpsUsed: 0,
      lastSafeX: 160,
      lastSafeY: 360,
      invulnTimer: 0,
      squashX: 1,
      squashY: 1,
      walkCycle: 0,
      recoil: 0,
      slashTimer: 0,
      slashAngle: 0,
      trailTimer: 0,
      cape: [
        { x: 160, y: 360 },
        { x: 146, y: 362 },
        { x: 132, y: 364 },
      ],
    };

    let standingWall: Rect | null = null;
    let walls: Rect[] = [];
    let lasers: LaserGate[] = [];
    let collectibles: Collectible[] = [];
    let enemies: EnemyBot[] = [];
    let platformEnemies: PlatformEnemy[] = [];
    let bossPlatform: BossPlatform | null = null;
    let floorWaves: FloorWave[] = [];
    let drones: PatrolDrone[] = [];
    let boss: Boss2D | null = null;
    let lockedDoor: LockedDoor | null = null;
    let projectiles: Projectile[] = [];
    let particles: Particle[] = [];
    let shockwaves: Shockwave[] = [];
    let floatTexts: FloatingText[] = [];
    let goalPortal: { x: number; y: number; active: boolean; requiresDoor?: boolean } | null = null;

    let elapsedSec = 0;
    let bumps = 0;
    let shotsFired = 0;
    let shotsHit = 0;
    let finished = false;
    let timedOut = false;
    let shootCooldown = 0;
    let meleeCooldown = 0;
    let ammo = maxAmmo;
    let ammoRegenTimer = 0;
    let wallBumpCooldown = 0;
    let camX = 0;
    let camY = 0;
    let shakeTimer = 0;
    let hudSyncTimer = 0;
    let hintShownTimer = 0;
    let diagOnlyTimer = 0;

    const showHint = (msg: string) => {
      callbacksRef.current.onCoachHint(msg);
      hintShownTimer = 4.5;
    };

    // Finite Hearts/HP on all stages with active hazards, enemies, abysses, or bosses
    const stageMaxHp =
      stage.id === 1 || stage.id === 2 || stage.id === 7
        ? undefined
        : stage.objectiveType === 'BOSS' ||
            stage.id === 3 ||
            stage.id === 13 ||
            stage.id === 14 ||
            stage.id === 19
          ? 5
          : 4;
    let playerHp = stageMaxHp ?? 99;

    // ================= STAGE LAYOUTS (1 - 22) =================
    if (stage.id === 1) {
      // Stage 1: Colheita na Praça do Mercado (fonte central + 4 barracas temáticas)
      player.x = 640;
      player.y = 490;
      walls = [
        { x: 585, y: 305, w: 110, h: 110 },
        { x: 255, y: 185, w: 80, h: 64 },
        { x: 945, y: 185, w: 80, h: 64 },
        { x: 255, y: 470, w: 80, h: 64 },
        { x: 945, y: 470, w: 80, h: 64 },
      ];
      const pts = [
        [640, 145],
        [940, 360],
        [640, 575],
        [340, 360],
        [175, 115],
        [1105, 115],
        [1105, 605],
        [175, 605],
        [135, 360],
        [1145, 360],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'coin',
        x,
        y,
        r: 18,
        collected: false,
        charge: 0,
      }));
    } else if (stage.id === 2) {
      // Stage 2: Rota de Correio nos Jardins (serpentina contínua de cercas)
      player.x = 110;
      player.y = 580;
      walls = [
        { x: 225, y: 230, w: 62, h: 490 },
        { x: 455, y: 0, w: 62, h: 475 },
        { x: 685, y: 230, w: 62, h: 490 },
        { x: 915, y: 0, w: 62, h: 475 },
        { x: 1095, y: 230, w: 56, h: 490 },
      ];
      const pts = [
        [130, 390],
        [140, 140],
        [345, 135],
        [370, 575],
        [595, 575],
        [605, 135],
        [830, 135],
        [830, 575],
        [1035, 575],
        [1035, 135],
        [1205, 155],
        [1205, 595],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'portal',
        x,
        y,
        r: 20,
        collected: false,
        charge: 0,
      }));
    } else if (stage.id === 3) {
      // Stage 3: Ronda Noturna do Armazém (Shift + finite stamina)
      player.x = 105;
      player.y = 360;
      walls = [
        { x: 290, y: 170, w: 46, h: 155 },
        { x: 290, y: 395, w: 46, h: 155 },
        { x: 620, y: 120, w: 46, h: 480 },
        { x: 940, y: 0, w: 46, h: 245 },
        { x: 940, y: 475, w: 46, h: 245 },
      ];
      const pts = [
        [200, 135],
        [200, 585],
        [475, 155],
        [475, 565],
        [780, 155],
        [780, 565],
        [1135, 175],
        [1135, 545],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'coin',
        x,
        y,
        r: 18,
        collected: false,
        charge: 0,
      }));
      drones = [
        { x: 475, y: 360, r: 19, ax: 475, ay: 125, bx: 475, by: 595, speed: 145, t: 0.25, dir: 1, angle: 0 },
        { x: 780, y: 360, r: 19, ax: 710, ay: 360, bx: 880, by: 360, speed: 150, t: 0.5, dir: 1, angle: 0 },
      ];
    } else if (stage.id === 4) {
      // Stage 4: Alarme no Setor de Energia (42s)
      player.x = 110;
      player.y = 360;
      walls = [
        { x: 250, y: 120, w: 38, h: 185 },
        { x: 250, y: 415, w: 38, h: 185 },
        { x: 565, y: 0, w: 38, h: 215 },
        { x: 565, y: 505, w: 38, h: 215 },
        { x: 895, y: 145, w: 38, h: 430 },
      ];
      const pts = [
        [155, 120],
        [155, 600],
        [415, 135],
        [415, 585],
        [730, 145],
        [730, 575],
        [1105, 140],
        [1105, 580],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'coin',
        x,
        y,
        r: 18,
        collected: false,
        charge: 0,
      }));
      drones = [
        { x: 415, y: 120, r: 20, ax: 415, ay: 100, bx: 415, by: 620, speed: 175, t: 0.15, dir: 1, angle: 0 },
        { x: 730, y: 360, r: 20, ax: 635, ay: 360, bx: 840, by: 360, speed: 180, t: 0.5, dir: 1, angle: 0 },
        { x: 1105, y: 360, r: 20, ax: 975, ay: 360, bx: 1205, by: 360, speed: 195, t: 0.2, dir: 1, angle: 0 },
      ];
    } else if (stage.id === 5) {
      // Stage 5: Cofre dos Sensores: Chave e Porta (cada feixe protege uma seção clara)
      player.x = 120;
      player.y = 580;
      walls = [
        { x: 290, y: 190, w: 48, h: 530 },
        { x: 620, y: 0, w: 48, h: 510 },
        { x: 940, y: 0, w: 48, h: 270 },
        { x: 940, y: 450, w: 48, h: 270 },
      ];
      lasers = [
        { x1: 22, y1: 355, x2: 290, y2: 355, period: 1, offset: 0, activeRatio: 1, crouchSensor: true },
        { x1: 338, y1: 360, x2: 620, y2: 360, period: 1, offset: 0, activeRatio: 1, crouchSensor: true },
        { x1: 668, y1: 360, x2: 940, y2: 360, period: 1, offset: 0, activeRatio: 1, crouchSensor: true },
      ];
      collectibles = [
        { id: 1, kind: 'key', x: 480, y: 600, r: 20, collected: false, charge: 0 },
      ];
      lockedDoor = { x: 940, y: 270, w: 48, h: 180, keysNeeded: 1, unlocked: false, openProgress: 0 };
      goalPortal = { x: 1135, y: 360, active: false, requiresDoor: true };
    } else if (stage.id === 6) {
      // Stage 6: Resgate no Laboratório
      player.x = 110;
      player.y = 605;
      walls = [
        { x: 235, y: 175, w: 44, h: 545 },
        { x: 480, y: 0, w: 44, h: 525 },
        { x: 735, y: 190, w: 44, h: 530 },
        { x: 990, y: 0, w: 44, h: 265 },
        { x: 990, y: 455, w: 44, h: 265 },
      ];
      lasers = [
        { x1: 279, y1: 360, x2: 480, y2: 360, period: 3.3, offset: 0, activeRatio: 0.44 },
        { x1: 524, y1: 265, x2: 735, y2: 265, period: 1, offset: 0, activeRatio: 1, crouchSensor: true },
        { x1: 779, y1: 390, x2: 990, y2: 390, period: 1, offset: 0, activeRatio: 1, crouchSensor: true },
      ];
      drones = [
        { x: 130, y: 100, r: 19, ax: 90, ay: 95, bx: 400, by: 95, speed: 175, t: 0.3, dir: 1, angle: 0 },
        { x: 615, y: 440, r: 19, ax: 615, ay: 330, bx: 615, by: 625, speed: 195, t: 0.5, dir: 1, angle: 0 },
        { x: 870, y: 210, r: 19, ax: 870, ay: 115, bx: 870, by: 330, speed: 175, t: 0.25, dir: 1, angle: 0 },
      ];
      collectibles = [
        { id: 1, kind: 'key', x: 365, y: 595, r: 20, collected: false, charge: 0 },
        { id: 2, kind: 'key', x: 870, y: 130, r: 20, collected: false, charge: 0 },
      ];
      lockedDoor = { x: 990, y: 265, w: 44, h: 190, keysNeeded: 2, unlocked: false, openProgress: 0 };
      goalPortal = { x: 1165, y: 360, active: false, requiresDoor: true };
    } else if (stage.id === 7) {
      // Stage 7: Sincronizar Torres de Rádio (muros exigem linha de visão livre!)
      player.x = 640;
      player.y = 360;
      walls = [
        { x: 355, y: 220, w: 54, h: 280 },
        { x: 871, y: 220, w: 54, h: 280 },
      ];
      const pts = [
        [165, 125],
        [640, 100],
        [1115, 125],
        [165, 360],
        [1115, 360],
        [165, 595],
        [640, 620],
        [1115, 595],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'radar',
        x,
        y,
        r: 23,
        collected: false,
        charge: 0,
      }));
    } else if (stage.id === 8) {
      // Stage 8: Treino de Lâmina & Defesa (Melee F / Botão Direito + Aparar Orbes)
      player.x = 640;
      player.y = 560;
      walls = [
        { x: 340, y: 380, w: 120, h: 36 },
        { x: 820, y: 380, w: 120, h: 36 },
      ];
      const meleeLocs = [
        [240, 210],
        [640, 185],
        [1040, 210],
        [220, 480],
        [640, 340],
        [1060, 480],
      ];
      enemies = meleeLocs.map(([x, y], i) => ({
        id: i + 1,
        x,
        y,
        r: 21,
        hp: 2,
        maxHp: 2,
        vx: i % 2 === 0 ? 48 : -48,
        vy: 0,
        minX: x - 55,
        maxX: x + 55,
        minY: y - 20,
        maxY: y + 20,
        flash: 0,
        defeated: false,
        angle: Math.PI / 2,
        fireTimer: 1.8 + (i % 3) * 0.75,
      }));
    } else if (stage.id === 9) {
      // Stage 9: Estande de Tiro & Energia Limitada (5 cargas + cobertura + Melee recarga)
      player.x = 640;
      player.y = 590;
      walls = [
        { x: 300, y: 400, w: 145, h: 38 },
        { x: 835, y: 400, w: 145, h: 38 },
        { x: 565, y: 345, w: 150, h: 38 },
      ];
      const staticLocs = [
        [160, 140],
        [380, 220],
        [640, 130],
        [900, 220],
        [1120, 140],
        [210, 310],
        [640, 250],
        [1070, 310],
      ];
      enemies = staticLocs.map(([x, y], i) => ({
        id: i + 1,
        x,
        y,
        r: 21,
        hp: 2,
        maxHp: 2,
        vx: i % 2 === 0 ? 35 : -35,
        vy: 0,
        minX: x - 40,
        maxX: x + 40,
        minY: y - 20,
        maxY: y + 20,
        flash: 0,
        defeated: false,
        angle: Math.PI / 2,
        fireTimer: 1.5 + (i % 4) * 0.75,
      }));
    } else if (stage.id === 10) {
      // Stage 10: Limpeza do Pátio dos Sentinelas (60s + disparos de patrulha)
      player.x = 640;
      player.y = 585;
      walls = [
        { x: 260, y: 425, w: 160, h: 34 },
        { x: 860, y: 425, w: 160, h: 34 },
      ];
      enemies = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        x: 190 + (i % 5) * 225,
        y: 120 + Math.floor(i / 5) * 145,
        r: 20,
        hp: 2,
        maxHp: 2,
        vx: (i % 2 === 0 ? 1 : -1) * (120 + (i % 3) * 35),
        vy: i % 3 === 0 ? 75 : 0,
        minX: 110,
        maxX: 1170,
        minY: 95,
        maxY: 365,
        flash: 0,
        defeated: false,
        angle: 0,
        fireTimer: 1.6 + (i % 5) * 0.65,
      }));
    } else if (stage.id === 11) {
      // Stage 11: Defesa do Perímetro (55s + fogo cruzado)
      player.x = 640;
      player.y = 595;
      walls = [
        { x: 340, y: 365, w: 96, h: 64 },
        { x: 844, y: 365, w: 96, h: 64 },
        { x: 585, y: 245, w: 110, h: 52 },
      ];
      enemies = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        x: 165 + (i % 6) * 185,
        y: 105 + Math.floor(i / 6) * 95,
        r: 17,
        hp: 2,
        maxHp: 2,
        vx: (i % 2 === 0 ? 1 : -1) * (155 + (i % 4) * 30),
        vy: i % 2 === 0 ? 90 : -90,
        minX: 105,
        maxX: 1175,
        minY: 85,
        maxY: 320,
        flash: 0,
        defeated: false,
        angle: 0,
        fireTimer: 1.5 + (i % 6) * 0.6,
      }));
    } else if (stage.id === 12) {
      // Stage 12: O Guardião Blindado (Chefe 2D)
      player.x = 640;
      player.y = 595;
      walls = [
        { x: 280, y: 215, w: 74, h: 74 },
        { x: 926, y: 215, w: 74, h: 74 },
        { x: 280, y: 445, w: 74, h: 74 },
        { x: 926, y: 445, w: 74, h: 74 },
      ];
      boss = {
        x: 640,
        y: 260,
        r: 44,
        hp: 24,
        maxHp: 24,
        shieldAngle: 0,
        fireTimer: 1.4,
        movePhase: 0,
        flash: 0,
        defeated: false,
      };
    } else if (stage.id === 13) {
      // Stage 13: Travessia das Ruínas Antigas (moedas rentes ao piso para pegar andando!)
      player.x = 110;
      player.y = 520;
      walls = [
        { x: 0, y: 600, w: 400, h: 120 },
        { x: 475, y: 535, w: 205, h: 36 },
        { x: 760, y: 465, w: 200, h: 36 },
        { x: 1040, y: 525, w: 205, h: 36 },
        { x: 1320, y: 445, w: 195, h: 36 },
        { x: 1590, y: 375, w: 200, h: 36 },
        { x: 1865, y: 435, w: 200, h: 36 },
        { x: 2120, y: 380, w: 240, h: 340 },
      ];
      const pts = [
        [290, 578],
        [575, 513],
        [860, 443],
        [1140, 503],
        [1415, 423],
        [1690, 353],
        [1965, 413],
        [2200, 358],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'coin',
        x,
        y,
        r: 16,
        collected: false,
        charge: 0,
      }));
      goalPortal = { x: 2290, y: 380, active: false };
    } else if (stage.id === 14) {
      // Stage 14: Elevadores da Mina (Móveis horizontais e verticais)
      player.x = 110;
      player.y = 520;
      walls = [
        { x: 0, y: 600, w: 340, h: 120 },
        { x: 455, y: 535, w: 185, h: 32, baseX: 455, baseY: 535, moveAmpX: 70, moveSpeed: 1.35, phase: 0 },
        { x: 790, y: 470, w: 190, h: 32 },
        { x: 1100, y: 440, w: 185, h: 32, baseX: 1100, baseY: 440, moveAmpY: 68, moveSpeed: 1.4, phase: 0.6 },
        { x: 1410, y: 390, w: 190, h: 32 },
        { x: 1735, y: 430, w: 185, h: 32, baseX: 1735, baseY: 430, moveAmpX: 80, moveSpeed: 1.45, phase: 1.2 },
        { x: 2090, y: 380, w: 390, h: 340 },
      ];
      const pts = [
        [250, 578],
        [545, 513],
        [880, 448],
        [1190, 345],
        [1505, 368],
        [1825, 408],
        [2160, 358],
        [2270, 358],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'coin',
        x,
        y,
        r: 16,
        collected: false,
        charge: 0,
      }));
      goalPortal = { x: 2385, y: 380, active: false };
    } else if (stage.id === 15) {
      // Stage 15: A Chave da Torre de Vigia (Salto Duplo + Porta murada até o teto!)
      player.x = 100;
      player.y = 520;
      walls = [
        { x: 0, y: 600, w: 340, h: 120 },
        { x: 475, y: 530, w: 180, h: 34 },
        { x: 820, y: 475, w: 175, h: 30, baseX: 820, baseY: 475, moveAmpX: 85, moveSpeed: 1.4, phase: 0 },
        { x: 1185, y: 320, w: 210, h: 34 },
        { x: 1190, y: 525, w: 210, h: 34 },
        { x: 1545, y: 460, w: 175, h: 30, baseX: 1545, baseY: 460, moveAmpY: 70, moveSpeed: 1.45, phase: 1.0 },
        { x: 1875, y: 390, w: 180, h: 34 },
        { x: 2145, y: 390, w: 355, h: 330 },
        { x: 2275, y: 0, w: 36, h: 250 },
      ];
      lasers = [
        { x1: 1295, y1: 354, x2: 1295, y2: 525, period: 3.0, offset: 0, activeRatio: 0.45 },
      ];
      collectibles = [
        { id: 1, kind: 'key', x: 1290, y: 270, r: 19, collected: false, charge: 0 },
      ];
      lockedDoor = { x: 2275, y: 250, w: 36, h: 140, keysNeeded: 1, unlocked: false, openProgress: 0 };
      goalPortal = { x: 2410, y: 390, active: false, requiresDoor: true };
    } else if (stage.id === 16) {
      // Stage 16: Chaminé dos Cristais (Wall Jump fluido com chaminés de 195px e saída limpa)
      player.x = 180;
      player.y = 1130;
      camY = worldH - VIEW_H;
      walls = [
        { x: 0, y: 1200, w: 1520, h: 80 },
        { x: 300, y: 1095, w: 175, h: 32 },
        // Chaminé 1: x: 540..735 (195px livre entre paredes 496..540 e 735..779)
        { x: 496, y: 600, w: 44, h: 600, wallClimbable: true },
        { x: 735, y: 520, w: 44, h: 545, wallClimbable: true },
        { x: 735, y: 520, w: 490, h: 34 },
        // Chaminé 2: entrada aberta sob parede esquerda (y=390..520) -> x: 960..1155 (195px livre!)
        { x: 916, y: 120, w: 44, h: 270, wallClimbable: true },
        { x: 1155, y: 235, w: 44, h: 285, wallClimbable: true },
        { x: 1155, y: 235, w: 365, h: 42 },
      ];
      const pts = [
        [575, 960],
        [700, 815],
        [575, 670],
        [855, 498],
        [1005, 360],
        [1120, 210],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'crystal',
        x,
        y,
        r: 17,
        collected: false,
        charge: 0,
      }));
      goalPortal = { x: 1410, y: 235, active: false };
    } else if (stage.id === 17) {
      // Stage 17: Corredores de Deslize (Slide obrigatório sob vigas baixas com 22px de vão!)
      player.x = 100;
      player.y = 540;
      walls = [
        { x: 0, y: 600, w: 720, h: 120 },
        { x: 300, y: 0, w: 290, h: 578, overheadBar: true },
        { x: 830, y: 530, w: 590, h: 42 },
        { x: 985, y: 0, w: 275, h: 508, overheadBar: true },
        { x: 1530, y: 470, w: 590, h: 42 },
        { x: 1685, y: 0, w: 280, h: 448, overheadBar: true },
        { x: 2230, y: 520, w: 620, h: 200 },
        { x: 2380, y: 0, w: 220, h: 498, overheadBar: true },
      ];
      const pts = [
        [390, 584],
        [520, 584],
        [1065, 514],
        [1200, 514],
        [1765, 448],
        [1905, 448],
        [2450, 504],
        [2640, 498],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'coin',
        x,
        y,
        r: 16,
        collected: false,
        charge: 0,
      }));
      goalPortal = { x: 2770, y: 520, active: false };
    } else if (stage.id === 18) {
      // Stage 18: Fuga da Forja Sob Vigas (Slide + Salto Duplo + Elevador móvel em 52s)
      player.x = 100;
      player.y = 520;
      walls = [
        { x: 0, y: 600, w: 580, h: 120 },
        { x: 300, y: 0, w: 195, h: 578, overheadBar: true },
        { x: 700, y: 530, w: 480, h: 42 },
        { x: 855, y: 0, w: 185, h: 508, overheadBar: true },
        { x: 1310, y: 460, w: 440, h: 42 },
        { x: 1455, y: 0, w: 180, h: 438, overheadBar: true },
        { x: 1880, y: 495, w: 185, h: 32, baseX: 1880, baseY: 495, moveAmpX: 75, moveSpeed: 1.4, phase: 0 },
        { x: 2290, y: 430, w: 460, h: 290 },
      ];
      const pts = [
        [240, 578],
        [400, 584],
        [540, 578],
        [780, 508],
        [945, 514],
        [1390, 438],
        [1540, 444],
        [2380, 408],
      ];
      collectibles = pts.map(([x, y], i) => ({
        id: i + 1,
        kind: 'coin',
        x,
        y,
        r: 16,
        collected: false,
        charge: 0,
      }));
      goalPortal = { x: 2630, y: 430, active: false };
    } else if (stage.id === 19) {
      // Stage 19: Despertar da Lâmina (Cap 4 - Plataforma + Combate Melee F + Ranged limitado)
      player.x = 110;
      player.y = 530;
      walls = [
        { x: 0, y: 600, w: 780, h: 120 },
        { x: 380, y: 495, w: 220, h: 32 },
        { x: 860, y: 550, w: 620, h: 170 },
        { x: 1020, y: 430, w: 240, h: 32 },
        { x: 1560, y: 580, w: 740, h: 140 },
        { x: 1760, y: 460, w: 240, h: 32 },
      ];
      platformEnemies = [
        { id: 1, kind: 'beetle', x: 420, y: 580, baseX: 420, baseY: 580, r: 19, hp: 2, maxHp: 2, vx: 65, minX: 280, maxX: 730, phase: 0, flash: 0, defeated: false, facing: 1 },
        { id: 2, kind: 'beetle', x: 480, y: 475, baseX: 480, baseY: 475, r: 19, hp: 2, maxHp: 2, vx: -55, minX: 400, maxX: 580, phase: 1, flash: 0, defeated: false, facing: -1 },
        { id: 3, kind: 'beetle', x: 1120, y: 530, baseX: 1120, baseY: 530, r: 19, hp: 2, maxHp: 2, vx: 80, minX: 900, maxX: 1440, phase: 0.4, flash: 0, defeated: false, facing: 1 },
        { id: 4, kind: 'beetle', x: 1140, y: 410, baseX: 1140, baseY: 410, r: 19, hp: 2, maxHp: 2, vx: -60, minX: 1040, maxX: 1240, phase: 0.8, flash: 0, defeated: false, facing: -1 },
        { id: 5, kind: 'beetle', x: 1860, y: 440, baseX: 1860, baseY: 440, r: 19, hp: 2, maxHp: 2, vx: 65, minX: 1780, maxX: 1980, phase: 1.1, flash: 0, defeated: false, facing: 1 },
        { id: 6, kind: 'guard', x: 1980, y: 558, baseX: 1980, baseY: 558, r: 22, hp: 3, maxHp: 3, vx: -85, minX: 1620, maxX: 2240, phase: 0.2, flash: 0, defeated: false, facing: -1, fireTimer: 2.1 },
      ];
    } else if (stage.id === 20) {
      // Stage 20: Emboscada nas Pontes Aéreas (65s + vespas disparam ferrões lentos)
      player.x = 100;
      player.y = 530;
      walls = [
        { x: 0, y: 600, w: 360, h: 120 },
        { x: 460, y: 525, w: 220, h: 32 },
        { x: 780, y: 460, w: 180, h: 30, baseX: 780, baseY: 460, moveAmpX: 70, moveSpeed: 1.35, phase: 0 },
        { x: 1090, y: 430, w: 320, h: 34 },
        { x: 1520, y: 460, w: 180, h: 30, baseX: 1520, baseY: 460, moveAmpY: 65, moveSpeed: 1.4, phase: 0.8 },
        { x: 1820, y: 395, w: 300, h: 34 },
        { x: 2220, y: 450, w: 380, h: 270 },
      ];
      platformEnemies = [
        { id: 1, kind: 'wasp', x: 410, y: 380, baseX: 410, baseY: 380, r: 18, hp: 2, maxHp: 2, vx: 55, minX: 330, maxX: 520, ampY: 28, phase: 0, flash: 0, defeated: false, facing: -1, fireTimer: 2.3 },
        { id: 2, kind: 'beetle', x: 560, y: 505, baseX: 560, baseY: 505, r: 19, hp: 2, maxHp: 2, vx: 55, minX: 480, maxX: 660, phase: 0.3, flash: 0, defeated: false, facing: 1 },
        { id: 3, kind: 'wasp', x: 900, y: 310, baseX: 900, baseY: 310, r: 18, hp: 2, maxHp: 2, vx: 70, minX: 780, maxX: 1020, ampY: 32, phase: 1.1, flash: 0, defeated: false, facing: -1, fireTimer: 2.5 },
        { id: 4, kind: 'guard', x: 1240, y: 408, baseX: 1240, baseY: 408, r: 22, hp: 3, maxHp: 3, vx: -65, minX: 1110, maxX: 1385, phase: 0.5, flash: 0, defeated: false, facing: -1, fireTimer: 2.0 },
        { id: 5, kind: 'wasp', x: 1590, y: 290, baseX: 1590, baseY: 290, r: 18, hp: 2, maxHp: 2, vx: 75, minX: 1470, maxX: 1710, ampY: 34, phase: 1.7, flash: 0, defeated: false, facing: 1, fireTimer: 2.4 },
        { id: 6, kind: 'beetle', x: 1960, y: 375, baseX: 1960, baseY: 375, r: 19, hp: 2, maxHp: 2, vx: 65, minX: 1840, maxX: 2095, phase: 0.2, flash: 0, defeated: false, facing: 1 },
        { id: 7, kind: 'wasp', x: 2180, y: 270, baseX: 2180, baseY: 270, r: 18, hp: 2, maxHp: 2, vx: -65, minX: 2040, maxX: 2340, ampY: 26, phase: 2.3, flash: 0, defeated: false, facing: -1, fireTimer: 2.2 },
        { id: 8, kind: 'guard', x: 2410, y: 428, baseX: 2410, baseY: 428, r: 22, hp: 3, maxHp: 3, vx: 70, minX: 2250, maxX: 2560, phase: 0.9, flash: 0, defeated: false, facing: -1, fireTimer: 1.9 },
      ];
    } else if (stage.id === 21) {
      // Stage 21: Masmorra da Chave Blindada (Ponte -> Túnel Slide Selado + Laser -> Poço Wall Jump 195px -> Chave -> Elevador -> Porta Selada)
      player.x = 100;
      player.y = 525;
      walls = [
        { x: 0, y: 600, w: 360, h: 120 },
        { x: 460, y: 530, w: 310, h: 34 },
        { x: 860, y: 530, w: 500, h: 34 },
        { x: 995, y: 0, w: 180, h: 508, overheadBar: true },
        // Poço de escalada Wall Jump: vão livre de 195px (1482..1677)
        { x: 1440, y: 170, w: 42, h: 225, wallClimbable: true },
        { x: 1360, y: 530, w: 410, h: 34 },
        { x: 1677, y: 215, w: 42, h: 315, wallClimbable: true },
        { x: 1260, y: 170, w: 222, h: 30 },
        { x: 1875, y: 405, w: 170, h: 30, baseX: 1875, baseY: 405, moveAmpY: 65, moveSpeed: 1.45, phase: 0.6 },
        { x: 2155, y: 360, w: 645, h: 360 },
        { x: 2540, y: 0, w: 38, h: 220 },
      ];
      lasers = [
        { x1: 1265, y1: 350, x2: 1265, y2: 530, period: 3.1, offset: 0.2, activeRatio: 0.42 },
      ];
      platformEnemies = [
        { id: 1, kind: 'beetle', x: 610, y: 510, baseX: 610, baseY: 510, r: 19, hp: 2, maxHp: 2, vx: 65, minX: 490, maxX: 740, phase: 0, flash: 0, defeated: false, facing: 1 },
        { id: 2, kind: 'wasp', x: 810, y: 340, baseX: 810, baseY: 340, r: 18, hp: 2, maxHp: 2, vx: 55, minX: 720, maxX: 900, ampY: 26, phase: 0.6, flash: 0, defeated: false, facing: -1, fireTimer: 2.3 },
        { id: 3, kind: 'guard', x: 1580, y: 508, baseX: 1580, baseY: 508, r: 21, hp: 3, maxHp: 3, vx: 55, minX: 1470, maxX: 1650, phase: 1.2, flash: 0, defeated: false, facing: -1, fireTimer: 2.1 },
        { id: 4, kind: 'wasp', x: 1960, y: 245, baseX: 1960, baseY: 245, r: 18, hp: 2, maxHp: 2, vx: 65, minX: 1840, maxX: 2070, ampY: 28, phase: 1.5, flash: 0, defeated: false, facing: 1, fireTimer: 2.2 },
        { id: 5, kind: 'guard', x: 2330, y: 338, baseX: 2330, baseY: 338, r: 22, hp: 3, maxHp: 3, vx: 70, minX: 2190, maxX: 2480, phase: 0.4, flash: 0, defeated: false, facing: -1, fireTimer: 1.9 },
      ];
      collectibles = [
        { id: 1, kind: 'key', x: 1320, y: 140, r: 19, collected: false, charge: 0 },
      ];
      lockedDoor = { x: 2540, y: 220, w: 38, h: 140, keysNeeded: 1, unlocked: false, openProgress: 0 };
      goalPortal = { x: 2700, y: 360, active: false, requiresDoor: true };
    } else if (stage.id === 22) {
      // Stage 22: O Cavaleiro Sombrio (Chefe Plataforma)
      player.x = 180;
      player.y = 540;
      walls = [
        { x: 0, y: 610, w: 1440, h: 110 },
        { x: 190, y: 470, w: 210, h: 28 },
        { x: 1040, y: 470, w: 210, h: 28 },
        { x: 615, y: 375, w: 210, h: 28 },
        { x: 70, y: 295, w: 135, h: 26 },
        { x: 1235, y: 295, w: 135, h: 26 },
        { x: 35, y: 180, w: 34, h: 430, wallClimbable: true },
        { x: 1371, y: 180, w: 34, h: 430, wallClimbable: true },
      ];
      bossPlatform = {
        x: 1120,
        y: 558,
        vx: 0,
        vy: 0,
        w: 44,
        h: 52,
        hp: 24,
        maxHp: 24,
        state: 'PATROL',
        stateTimer: 1.5,
        facing: -1,
        flash: 0,
        grounded: true,
        defeated: false,
      };
    }

    player.lastSafeX = player.x;
    player.lastSafeY = player.y;
    player.cape.forEach((p, idx) => {
      p.x = player.x - idx * 10;
      p.y = player.y;
    });

    const spawnParticles = (x: number, y: number, color: string, count = 10, speedBase = 80) => {
      if (lowPowerRef.current) count = Math.min(count, 5);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = speedBase + Math.random() * 140;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.42,
          maxLife: 0.42,
          color,
          size: 3 + Math.random() * 3.2,
        });
      }
    };

    const spawnShockwave = (x: number, y: number, color: string, maxR = 46) => {
      if (lowPowerRef.current) return;
      shockwaves.push({ x, y, r: 8, maxR, life: 0.28, maxLife: 0.28, color });
    };

    const spawnFloatText = (x: number, y: number, text: string, color = '#FBBF24') => {
      floatTexts.push({ x, y, text, color, life: 0.7 });
    };

    const updateStamina = (wantsSprint: boolean, canSprint: boolean, dt: number): boolean => {
      if (!canSprint) {
        player.stamina = 100;
        player.staminaExhausted = false;
        player.staminaRegenDelay = 0;
        return false;
      }

      if (wantsSprint && !player.staminaExhausted && player.stamina > 0) {
        player.stamina = Math.max(0, player.stamina - 33 * dt);
        player.staminaRegenDelay = 0.65;
        if (player.stamina <= 0) {
          player.staminaExhausted = true;
          player.staminaRegenDelay = 1.05;
          showHint('Fôlego esgotado! Solte o Shift por um instante para recarregar.');
        }
        return true;
      }

      player.staminaRegenDelay = Math.max(0, player.staminaRegenDelay - dt);
      if (player.staminaRegenDelay <= 0 && (!wantsSprint || player.staminaExhausted)) {
        const regenRate = player.staminaExhausted ? 24 : 28;
        player.stamina = Math.min(100, player.stamina + regenRate * dt);
        if (player.staminaExhausted && player.stamina >= 32) {
          player.staminaExhausted = false;
        }
      }
      return false;
    };

    const damagePlayer = (knockX = 0, knockY = 0, respawnSafe = false, invulnDuration = 0.9) => {
      if (finished || timedOut || player.invulnTimer > 0) return;
      bumps += 1;
      player.invulnTimer = invulnDuration;
      soundEngine.playBump();
      shakeTimer = 0.18;
      spawnParticles(player.x, player.y, '#EF4444', 12);

      if (stageMaxHp !== undefined) {
        playerHp = Math.max(0, playerHp - 1);
        spawnFloatText(player.x, player.y - 24, '-1 ♥', '#FB7185');
        if (playerHp <= 0) {
          timedOut = true;
          soundEngine.playFail();
          callbacksRef.current.onCoachHint(null);
          callbacksRef.current.onDefeated();
          return;
        }
      }

      if (respawnSafe) {
        player.x = player.lastSafeX;
        player.y = player.lastSafeY;
        player.vx = 0;
        player.vy = 0;
        standingWall = null;
      } else {
        if (knockX !== 0) player.vx = knockX;
        if (knockY !== 0) player.vy = knockY;
      }
    };

    const completeStage = () => {
      if (finished || timedOut) return;
      finished = true;
      soundEngine.playComplete();
      callbacksRef.current.onCoachHint(null);

      let accuracyPct = 100;
      if ((stage.engine === '2D-SHOOTER' && stage.id >= 8) || isPlatformCombat) {
        accuracyPct = shotsFired > 0 ? Math.min(100, (shotsHit / shotsFired) * 100) : 100;
      } else {
        accuracyPct = Math.max(40, 100 - bumps * 6);
      }

      callbacksRef.current.onComplete({
        stageId: stage.id,
        elapsedSec,
        accuracyPct,
        bumps,
      });
    };

    const refillAmmoFromMelee = () => {
      if (maxAmmo > 0 && ammo < maxAmmo) {
        ammo = Math.min(maxAmmo, ammo + 2);
        spawnFloatText(player.x, player.y - 26, '+2 ⚡', '#38BDF8');
      }
    };

    const triggerMeleeSlash = (angleOverride?: number) => {
      if (!hasMelee || meleeCooldown > 0 || pausedRef.current || finished || timedOut) return;
      meleeCooldown = 0.28;
      shotsFired += 1;
      const ang =
        angleOverride ??
        (stage.activeControls.includes('MOUSE_AIM')
          ? Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x)
          : player.facingX >= 0
            ? 0
            : Math.PI);
      player.facingX = Math.cos(ang) >= 0 ? 1 : -1;
      player.slashTimer = 0.18;
      player.slashAngle = ang;
      soundEngine.playMeleeSlash();

      let landedHit = false;

      // Deflect / slice incoming enemy projectiles within slash arc!
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (!p.fromBoss) continue;
        const dx = p.x - player.x;
        const dy = p.y - player.y;
        const dist = Math.hypot(dx, dy);
        let diff = Math.atan2(dy, dx) - ang;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (dist <= 96 && Math.abs(diff) <= 1.35) {
          landedHit = true;
          spawnParticles(p.x, p.y, '#A78BFA', 6, 70);
          projectiles.splice(i, 1);
        }
      }

      if (isPlatformer) {
        for (const en of platformEnemies) {
          if (en.defeated) continue;
          const dx = en.x - player.x;
          const dy = en.y - player.y;
          const dist = Math.hypot(dx, dy);
          let diff = Math.atan2(dy, dx) - ang;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (dist <= 92 + en.r && Math.abs(diff) <= 1.25) {
            landedHit = true;
            shotsHit += 1;
            en.hp -= 2;
            en.flash = 0.16;
            spawnParticles(en.x, en.y, '#A78BFA', 10);
            if (en.hp <= 0) {
              en.defeated = true;
              soundEngine.playEnemyDefeat();
              spawnShockwave(en.x, en.y, '#A78BFA', 48);
              spawnParticles(en.x, en.y, '#FBBF24', 14);
              const deadCount = platformEnemies.filter((e) => e.defeated).length;
              spawnFloatText(en.x, en.y - 16, `${deadCount}/${platformEnemies.length}`, '#C4B5FD');
              if (stage.objectiveType === 'ENEMIES' && deadCount >= platformEnemies.length) {
                completeStage();
              }
            } else {
              soundEngine.playEnemyHit();
            }
          }
        }

        if (bossPlatform && !bossPlatform.defeated) {
          const dx = bossPlatform.x - player.x;
          const dy = bossPlatform.y - player.y;
          const dist = Math.hypot(dx, dy);
          let diff = Math.atan2(dy, dx) - ang;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (dist <= 98 && Math.abs(diff) <= 1.25) {
            landedHit = true;
            shotsHit += 1;
            bossPlatform.hp = Math.max(0, bossPlatform.hp - 2);
            bossPlatform.flash = 0.15;
            soundEngine.playEnemyHit();
            spawnParticles(bossPlatform.x, bossPlatform.y, '#FBBF24', 10);
            if (bossPlatform.hp <= 0) {
              bossPlatform.defeated = true;
              soundEngine.playEnemyDefeat();
              spawnShockwave(bossPlatform.x, bossPlatform.y, '#A78BFA', 95);
              spawnParticles(bossPlatform.x, bossPlatform.y, '#FBBF24', 28);
              completeStage();
            }
          }
        }
      } else {
        for (const en of enemies) {
          if (en.defeated) continue;
          const dx = en.x - player.x;
          const dy = en.y - player.y;
          const dist = Math.hypot(dx, dy);
          let diff = Math.atan2(dy, dx) - ang;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (dist <= 92 + en.r && Math.abs(diff) <= 1.25) {
            landedHit = true;
            shotsHit += 1;
            en.hp -= 2;
            en.flash = 0.16;
            spawnParticles(en.x, en.y, '#A78BFA', 10);
            if (en.hp <= 0) {
              en.defeated = true;
              soundEngine.playEnemyDefeat();
              spawnShockwave(en.x, en.y, '#F59E0B', 48);
              spawnParticles(en.x, en.y, '#FBBF24', 14);
              const deadCount = enemies.filter((e) => e.defeated).length;
              spawnFloatText(en.x, en.y - 16, `${deadCount}/${enemies.length}`, '#38BDF8');
              if (deadCount >= enemies.length) completeStage();
            } else {
              soundEngine.playEnemyHit();
            }
          }
        }

        if (boss && !boss.defeated) {
          const dx = boss.x - player.x;
          const dy = boss.y - player.y;
          const dist = Math.hypot(dx, dy);
          let diff = Math.atan2(dy, dx) - ang;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (dist <= boss.r + 74 && Math.abs(diff) <= 1.2) {
            landedHit = true;
            shotsHit += 1;
            boss.hp = Math.max(0, boss.hp - 2);
            boss.flash = 0.15;
            soundEngine.playEnemyHit();
            spawnParticles(boss.x, boss.y, '#FBBF24', 10);
            if (boss.hp <= 0) {
              boss.defeated = true;
              soundEngine.playEnemyDefeat();
              spawnShockwave(boss.x, boss.y, '#F59E0B', 95);
              spawnParticles(boss.x, boss.y, '#FBBF24', 28);
              completeStage();
            }
          }
        }
      }

      if (landedHit) {
        refillAmmoFromMelee();
      }
    };

    const firePlatformWave = () => {
      if (!isPlatformer || !hasRanged || shootCooldown > 0 || pausedRef.current || finished || timedOut) return;
      if (ammo <= 0) {
        shootCooldown = 0.22;
        soundEngine.playBump();
        showHint('Sem cargas! Golpeie de perto ou corte orbes com F / Botão Direito para recarregar!');
        return;
      }
      ammo -= 1;
      shootCooldown = 0.24;
      shotsFired += 1;
      const ang = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
      player.facingX = Math.cos(ang) >= 0 ? 1 : -1;
      player.recoil = 0.7;
      soundEngine.playShoot();

      const mx = player.x + Math.cos(ang) * 20;
      const my = player.y + Math.sin(ang) * 20;
      projectiles.push({
        x: mx,
        y: my,
        prevX: mx,
        prevY: my,
        vx: Math.cos(ang) * 780,
        vy: Math.sin(ang) * 780,
        life: 0.75,
        isBladeWave: true,
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!keys[e.code]) {
        keys[e.code] = true;
        if (e.code === 'Space') {
          player.jumpBufferTimer = 0.14;
        }
        if ((e.code === 'KeyF' || e.code === 'KeyJ') && hasMelee) {
          triggerMeleeSlash();
        }
        emitInput();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      emitInput();
    };

    const updateMousePos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const cssScale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
      const cssOffX = (rect.width - VIEW_W * cssScale) / 2;
      const cssOffY = (rect.height - VIEW_H * cssScale) / 2;
      const sx = (clientX - rect.left - cssOffX) / cssScale;
      const sy = (clientY - rect.top - cssOffY) / cssScale;
      mouse.screenX = sx;
      mouse.screenY = sy;
      mouse.worldX = sx + camX;
      mouse.worldY = sy + camY;
    };

    const handlePointerMove = (e: PointerEvent) => updateMousePos(e.clientX, e.clientY);
    const handlePointerDown = (e: PointerEvent) => {
      updateMousePos(e.clientX, e.clientY);
      if (e.button === 2) {
        mouse.rightDown = true;
        if (hasMelee) {
          triggerMeleeSlash();
        }
        emitInput();
        return;
      }
      if (e.button !== 0) return;
      mouse.down = true;
      if (isPlatformCombat) {
        firePlatformWave();
      }
      emitInput();
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (e.button === 2) {
        mouse.rightDown = false;
      } else {
        mouse.down = false;
      }
      emitInput();
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = lowPowerRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(320, Math.floor(rect.width * dpr));
      canvas.height = Math.max(200, Math.floor(rect.height * dpr));
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);

    const isLaserActive = (l: LaserGate, t: number) => {
      if (l.crouchSensor) return true;
      const cycle = ((t + l.offset) % l.period) / l.period;
      return cycle < l.activeRatio;
    };

    const isLaserWarning = (l: LaserGate, t: number) => {
      if (l.crouchSensor) return false;
      const cycle = ((t + l.offset) % l.period) / l.period;
      return cycle >= 0.85;
    };

    const pointToSegmentDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
      const vx = x2 - x1;
      const vy = y2 - y1;
      const wx = px - x1;
      const wy = py - y1;
      const c1 = vx * wx + vy * wy;
      if (c1 <= 0) return Math.hypot(px - x1, py - y1);
      const c2 = vx * vx + vy * vy;
      if (c2 <= c1) return Math.hypot(px - x2, py - y2);
      const b = c1 / c2;
      return Math.hypot(px - (x1 + b * vx), py - (y1 + b * vy));
    };

    const segmentIntersectsRect = (x1: number, y1: number, x2: number, y2: number, r: Rect): boolean => {
      const steps = 14;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
          return true;
        }
      }
      return false;
    };

    const circleRectResolve = (cx: number, cy: number, r: number, rect: Rect) => {
      const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
      const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
      const dx = cx - closestX;
      const dy = cy - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq < r * r) {
        const dist = Math.sqrt(distSq) || 0.001;
        const overlap = r - dist;
        return { hit: true, nx: cx + (dx / dist) * overlap, ny: cy + (dy / dist) * overlap };
      }
      return { hit: false, nx: cx, ny: cy };
    };

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      if (!pausedRef.current && !finished && !timedOut) {
        elapsedSec += dt;

        if (stage.timeLimitSec && elapsedSec >= stage.timeLimitSec) {
          timedOut = true;
          soundEngine.playFail();
          callbacksRef.current.onCoachHint(null);
          callbacksRef.current.onTimeout();
        }

        shootCooldown = Math.max(0, shootCooldown - dt);
        meleeCooldown = Math.max(0, meleeCooldown - dt);
        wallBumpCooldown = Math.max(0, wallBumpCooldown - dt);
        player.invulnTimer = Math.max(0, player.invulnTimer - dt);
        player.recoil = Math.max(0, player.recoil - dt * 6);
        player.slashTimer = Math.max(0, player.slashTimer - dt);
        player.slideCooldown = Math.max(0, player.slideCooldown - dt);
        player.wallCoyoteTimer = Math.max(0, player.wallCoyoteTimer - dt);
        player.wallJumpLockTimer = Math.max(0, player.wallJumpLockTimer - dt);
        shakeTimer = Math.max(0, shakeTimer - dt);

        if (maxAmmo > 0) {
          if (ammo < maxAmmo) {
            ammoRegenTimer += dt;
            if (ammoRegenTimer >= 1.05) {
              ammoRegenTimer = 0;
              ammo += 1;
            }
          } else {
            ammoRegenTimer = 0;
          }
        }

        if (hintShownTimer > 0) {
          hintShownTimer -= dt;
          if (hintShownTimer <= 0) {
            callbacksRef.current.onCoachHint(null);
          }
        }

        player.squashX += (1 - player.squashX) * Math.min(1, dt * 14);
        player.squashY += (1 - player.squashY) * Math.min(1, dt * 14);

        const crouchPressed =
          stage.activeControls.includes('CTRL') &&
          Boolean(
            keys['ControlLeft'] ||
              keys['ControlRight'] ||
              keys['KeyC'] ||
              (isPlatformer && (keys['KeyS'] || keys['ArrowDown']))
          );

        for (const w of walls) {
          w.prevX = w.x;
          w.prevY = w.y;
          if (w.baseX !== undefined && w.moveAmpX) {
            w.x = w.baseX + Math.sin(elapsedSec * (w.moveSpeed ?? 1.5) + (w.phase ?? 0)) * w.moveAmpX;
          }
          if (w.baseY !== undefined && w.moveAmpY) {
            w.y = w.baseY + Math.sin(elapsedSec * (w.moveSpeed ?? 1.5) + (w.phase ?? 0)) * w.moveAmpY;
          }
        }

        if (lockedDoor && lockedDoor.unlocked) {
          lockedDoor.openProgress = Math.min(1, lockedDoor.openProgress + dt * 2.5);
        }

        const keysCollected = collectibles.filter((c) => c.kind === 'key' && c.collected).length;

        if (isPlatformer) {
          // --- Carry player WITH moving standing platform BEFORE collision checks (fixes vertical teleport bug!) ---
          const wasStandingPlatform = standingWall;
          if (wasStandingPlatform) {
            const pDx = wasStandingPlatform.x - (wasStandingPlatform.prevX ?? wasStandingPlatform.x);
            player.x += pDx;
            player.y = wasStandingPlatform.y - player.h / 2;
          }

          const moveLeft = Boolean(keys['KeyA'] || keys['ArrowLeft']);
          const moveRight = Boolean(keys['KeyD'] || keys['ArrowRight']);
          const inputX = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
          const canSprint = stage.activeControls.includes('SHIFT');
          const shiftKeyDown = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
          const sprinting = updateStamina(
            shiftKeyDown && inputX !== 0 && !crouchPressed && player.slideTimer <= 0,
            canSprint,
            dt
          );
          const spaceHeld = Boolean(keys['Space']);

          // Trigger Slide when pressing C/Ctrl/S while sprinting or moving quickly on ground
          const crouchJustPressed = crouchPressed && !player.wasCrouchDown;
          player.wasCrouchDown = crouchPressed;

          if (
            stage.activeControls.includes('CTRL') &&
            (crouchJustPressed || (crouchPressed && shiftKeyDown)) &&
            player.grounded &&
            player.slideTimer <= 0 &&
            player.slideCooldown <= 0 &&
            (sprinting || Math.abs(player.vx) > 225)
          ) {
            player.slideTimer = 0.44;
            player.slideCooldown = 0.54;
            player.slideDir = (inputX !== 0 ? inputX : Math.sign(player.vx) || player.facingX) as -1 | 1;
            player.facingX = player.slideDir;
            player.vx = player.slideDir * 520;
            soundEngine.playSlide();
            spawnParticles(player.x, player.y + player.h / 2, '#38BDF8', 8, 70);
          }

          if (player.slideTimer > 0) {
            player.slideTimer = Math.max(0, player.slideTimer - dt);
            player.sliding = true;
            if (Math.random() < 0.45 && player.grounded) {
              particles.push({
                x: player.x - player.slideDir * 10,
                y: player.y + player.h / 2 - 2,
                vx: -player.slideDir * (40 + Math.random() * 45),
                vy: -18 - Math.random() * 25,
                life: 0.22,
                maxLife: 0.22,
                color: '#7DD3FC',
                size: 3.2,
              });
            }
          } else {
            player.sliding = false;
          }

          const wantsLowProfile = crouchPressed || player.sliding;
          const prevFeetY = player.y + player.h / 2;
          const targetH = player.sliding ? 16 : crouchPressed ? 20 : 32;
          if (player.h !== targetH) {
            if (targetH > player.h) {
              const testTop = prevFeetY - targetH;
              const blockedUp = walls.some(
                (w) =>
                  player.x + player.w / 2 > w.x + 2 &&
                  player.x - player.w / 2 < w.x + w.w - 2 &&
                  testTop < w.y + w.h &&
                  prevFeetY > w.y + 4
              );
              if (!blockedUp) {
                player.h = targetH;
                player.y = prevFeetY - player.h / 2;
                player.crouching = crouchPressed;
              } else {
                // Keep low profile under overhead beams so player cannot stand up inside ceiling!
                player.h = Math.min(player.h, 20);
                player.y = prevFeetY - player.h / 2;
                player.crouching = true;
              }
            } else {
              player.h = targetH;
              player.y = prevFeetY - player.h / 2;
              player.crouching = true;
            }
          } else {
            player.crouching = wantsLowProfile || player.h < 32;
          }

          const maxSpeed = player.sliding ? 520 : player.crouching ? 215 : sprinting ? 425 : 295;
          let accel = player.grounded ? 2350 : 1550;
          if (player.wallJumpLockTimer > 0 && inputX === -player.facingX) {
            accel *= 0.16;
          }

          if (player.sliding) {
            player.vx = player.slideDir * (350 + (player.slideTimer / 0.44) * 170);
          } else if (inputX !== 0) {
            player.vx += inputX * accel * dt;
            if (Math.abs(player.vx) > maxSpeed) {
              player.vx = Math.sign(player.vx) * maxSpeed;
            }
            if (player.wallJumpLockTimer <= 0) {
              player.facingX = inputX;
            }
            if (player.grounded) {
              player.walkCycle += dt * (sprinting ? 16 : 11);
            }
          } else {
            const friction = player.grounded ? 2250 : 620;
            if (Math.abs(player.vx) <= friction * dt) {
              player.vx = 0;
            } else {
              player.vx -= Math.sign(player.vx) * friction * dt;
            }
          }

          if (player.grounded) {
            player.coyoteTimer = 0.14;
            player.jumpsUsed = 0;
          } else {
            player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
          }
          player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);

          const standingHeadBlocked =
            player.h < 32 &&
            walls.some(
              (w) =>
                player.x + player.w / 2 > w.x + 2 &&
                player.x - player.w / 2 < w.x + w.w - 2 &&
                player.y + player.h / 2 - 32 < w.y + w.h &&
                player.y + player.h / 2 > w.y + 4
            );

          const maxJumps = stage.id >= 15 ? 2 : 1;
          if (player.jumpBufferTimer > 0 && !standingHeadBlocked && (!player.crouching || player.sliding)) {
            if ((player.wallSliding || player.wallCoyoteTimer > 0) && (player.wallDir !== 0 || player.wallCoyoteDir !== 0)) {
              const kickDir = (player.wallDir || player.wallCoyoteDir) as -1 | 1;
              player.vy = -595;
              player.vx = -kickDir * 375;
              player.facingX = -kickDir;
              player.wallSliding = false;
              player.wallCoyoteTimer = 0;
              player.wallJumpLockTimer = 0.16;
              player.sliding = false;
              player.slideTimer = 0;
              standingWall = null;
              player.jumpBufferTimer = 0;
              player.jumpsUsed = 1;
              player.squashX = 0.76;
              player.squashY = 1.26;
              soundEngine.playWallJump();
              spawnShockwave(player.x + kickDir * 14, player.y, '#38BDF8', 36);
              spawnParticles(player.x + kickDir * 14, player.y, '#99F6E4', 8, 65);
            } else if (player.coyoteTimer > 0) {
              player.vy = -595;
              player.grounded = false;
              player.sliding = false;
              player.slideTimer = 0;
              standingWall = null;
              player.coyoteTimer = 0;
              player.jumpBufferTimer = 0;
              player.jumpsUsed = 1;
              player.squashX = 0.78;
              player.squashY = 1.24;
              soundEngine.playJump();
              spawnParticles(player.x, player.y + player.h / 2, '#38BDF8', 7, 50);
            } else if (maxJumps === 2 && player.jumpsUsed < 2) {
              player.vy = -550;
              standingWall = null;
              player.jumpBufferTimer = 0;
              player.jumpsUsed = 2;
              player.squashX = 0.8;
              player.squashY = 1.22;
              soundEngine.playJump();
              spawnShockwave(player.x, player.y + player.h / 2, '#FBBF24', 36);
              spawnParticles(player.x, player.y + player.h / 2, '#FBBF24', 8, 60);
            }
          }

          if (!spaceHeld && player.vy < -220) {
            player.vy += 1720 * dt;
          }

          const grav = player.crouching && !player.grounded ? 2250 : 1450;
          player.vy = Math.min(920, player.vy + grav * dt);
          player.x += player.vx * dt;
          player.x = Math.max(20, Math.min(worldW - 20, player.x));

          const halfW = player.w / 2;
          const halfH = player.h / 2;
          const currentFeetY = player.y + halfH;

          let touchingClimbWallDir: -1 | 0 | 1 = 0;

          const activeSolidWalls: Rect[] = [...walls];
          if (lockedDoor && !lockedDoor.unlocked) {
            activeSolidWalls.push({ x: lockedDoor.x, y: lockedDoor.y, w: lockedDoor.w, h: lockedDoor.h });
          }

          // Strict horizontal collision check: overheadBar walls allow ZERO top-edge forgiveness so standing players cannot clip under!
          for (const w of activeSolidWalls) {
            if (w === wasStandingPlatform) continue;
            const prevTop = w.prevY ?? w.y;
            if (!w.overheadBar && currentFeetY <= prevTop + 10 && player.vy >= 0) continue;

            const topForgiveness = w.overheadBar ? 0 : 5;
            if (
              player.x + halfW > w.x &&
              player.x - halfW < w.x + w.w &&
              player.y + halfH - (w.overheadBar ? 3 : 9) > w.y &&
              player.y - halfH + topForgiveness < w.y + w.h
            ) {
              if (player.vx > 0) {
                player.x = w.x - halfW;
                if (w.wallClimbable) touchingClimbWallDir = 1;
              } else if (player.vx < 0) {
                player.x = w.x + w.w + halfW;
                if (w.wallClimbable) touchingClimbWallDir = -1;
              }
              player.vx = 0;
              player.sliding = false;
              player.slideTimer = 0;
              if (w.overheadBar && !player.crouching) {
                showHint('Aperte C, Ctrl ou S (ou Shift+C para Slide) para passar por baixo da viga!');
              }
            }
          }

          // Proximity-only Wall Jump scan (<= 8px) even if player released A/D right before pressing Space!
          if (!player.grounded && touchingClimbWallDir === 0) {
            for (const w of walls) {
              if (!w.wallClimbable) continue;
              const overlapY = player.y + halfH - 4 > w.y && player.y - halfH + 4 < w.y + w.h;
              if (!overlapY) continue;
              if (Math.abs(player.x + halfW - w.x) <= 8) touchingClimbWallDir = 1;
              else if (Math.abs(player.x - halfW - (w.x + w.w)) <= 8) touchingClimbWallDir = -1;
            }
          }

          if (touchingClimbWallDir !== 0 && !player.grounded) {
            player.wallCoyoteTimer = 0.16;
            player.wallCoyoteDir = touchingClimbWallDir;
          }

          const wasGrounded = player.grounded;
          const prevBottom = player.y + halfH;
          player.y += player.vy * dt;
          player.grounded = false;
          standingWall = null;

          for (const w of activeSolidWalls) {
            if (
              player.x + halfW > w.x + 2 &&
              player.x - halfW < w.x + w.w - 2 &&
              player.y + halfH > w.y &&
              player.y - halfH < w.y + w.h
            ) {
              const prevPlatTop = w.prevY ?? w.y;
              if (player.vy >= 0 && prevBottom <= prevPlatTop + 26) {
                player.y = w.y - halfH;
                player.vy = 0;
                player.grounded = true;
                standingWall = w;
                if (!wasGrounded) {
                  player.squashX = 1.22;
                  player.squashY = 0.82;
                  spawnParticles(player.x, player.y + halfH, '#94A3B8', 5, 45);
                }

                if (!w.moveAmpX && !w.moveAmpY && !w.overheadBar && w.w >= 90) {
                  player.lastSafeX = Math.max(w.x + 28, Math.min(w.x + w.w - 28, player.x));
                  player.lastSafeY = w.y - halfH - 4;
                }
              } else if (player.vy < 0 && w.y + w.h <= prevBottom) {
                player.y = w.y + w.h + halfH;
                player.vy = 0;
              }
            }
          }

          // Hollow Knight Wall-Slide friction (only when falling along wall)
          if (!player.grounded && touchingClimbWallDir !== 0 && player.vy > 0) {
            player.wallSliding = true;
            player.wallDir = touchingClimbWallDir;
            player.vy = Math.min(player.vy, 118);
            player.jumpsUsed = 1;
            if (Math.random() < 0.35) {
              particles.push({
                x: player.x + touchingClimbWallDir * halfW,
                y: player.y + (Math.random() - 0.5) * 20,
                vx: -touchingClimbWallDir * 25,
                vy: -30,
                life: 0.22,
                maxLife: 0.22,
                color: '#38BDF8',
                size: 3,
              });
            }
          } else {
            player.wallSliding = false;
            player.wallDir = 0;
          }

          // Continuous firing if holding left mouse button in platformer combat
          if (isPlatformCombat && hasRanged && mouse.down && shootCooldown <= 0) {
            firePlatformWave();
          }

          // Platform Enemies AI + Attacks + Collision
          for (const en of platformEnemies) {
            if (en.defeated) continue;
            en.flash = Math.max(0, en.flash - dt);
            if (en.kind === 'wasp') {
              en.x += en.vx * dt;
              if (en.x < en.minX || en.x > en.maxX) {
                en.vx *= -1;
                en.x = Math.max(en.minX, Math.min(en.maxX, en.x));
              }
              en.facing = en.vx >= 0 ? 1 : -1;
              en.y = en.baseY + Math.sin(elapsedSec * 2.8 + en.phase) * (en.ampY ?? 26);
            } else {
              en.x += en.vx * dt;
              if (en.x < en.minX || en.x > en.maxX) {
                en.vx *= -1;
                en.x = Math.max(en.minX, Math.min(en.maxX, en.x));
              }
              en.facing = en.vx >= 0 ? 1 : -1;
            }

            if (en.fireTimer !== undefined) {
              en.fireTimer -= dt;
              const distP = Math.hypot(player.x - en.x, player.y - en.y);
              if (en.fireTimer <= 0 && distP < 520) {
                en.fireTimer = en.kind === 'guard' ? 2.1 : 2.5;
                const a = Math.atan2(player.y - en.y, player.x - en.x);
                projectiles.push({
                  x: en.x,
                  y: en.y,
                  prevX: en.x,
                  prevY: en.y,
                  vx: Math.cos(a) * 235,
                  vy: Math.sin(a) * 235,
                  life: 2.2,
                  fromBoss: true,
                });
              }
            }

            if (Math.hypot(player.x - en.x, player.y - en.y) < 16 + en.r && player.invulnTimer <= 0) {
              damagePlayer((player.x >= en.x ? 1 : -1) * 320, -280, false, 0.9);
            }
          }

          // Stage 20 Platformer Boss AI (O Cavaleiro Sombrio!)
          if (bossPlatform && !bossPlatform.defeated) {
            const phase2 = bossPlatform.hp <= bossPlatform.maxHp / 2;
            bossPlatform.flash = Math.max(0, bossPlatform.flash - dt);
            bossPlatform.stateTimer -= dt;

            if (bossPlatform.state === 'PATROL') {
              const dir = Math.sign(player.x - bossPlatform.x) || 1;
              bossPlatform.facing = dir;
              bossPlatform.vx = dir * (phase2 ? 155 : 115);
              if (bossPlatform.stateTimer <= 0) {
                if (Math.random() < 0.55) {
                  bossPlatform.state = 'TELEGRAPH';
                  bossPlatform.stateTimer = phase2 ? 0.45 : 0.6;
                  bossPlatform.vx = 0;
                } else {
                  bossPlatform.state = 'LEAP';
                  bossPlatform.vy = -680;
                  bossPlatform.vx = dir * 240;
                  bossPlatform.grounded = false;
                  bossPlatform.stateTimer = 2.0;
                }
              }
            } else if (bossPlatform.state === 'TELEGRAPH') {
              bossPlatform.vx = 0;
              if (bossPlatform.stateTimer <= 0) {
                bossPlatform.state = 'DASH';
                bossPlatform.stateTimer = 0.45;
                bossPlatform.vx = bossPlatform.facing * (phase2 ? 560 : 450);
                const baseA = Math.atan2(player.y - bossPlatform.y, player.x - bossPlatform.x);
                const count = phase2 ? 3 : 2;
                for (let k = 0; k < count; k++) {
                  const spread = (k - (count - 1) / 2) * 0.24;
                  const a = baseA + spread;
                  projectiles.push({
                    x: bossPlatform.x,
                    y: bossPlatform.y - 6,
                    prevX: bossPlatform.x,
                    prevY: bossPlatform.y - 6,
                    vx: Math.cos(a) * 290,
                    vy: Math.sin(a) * 290,
                    life: 3.0,
                    fromBoss: true,
                  });
                }
              }
            } else if (bossPlatform.state === 'DASH') {
              if (bossPlatform.stateTimer <= 0) {
                bossPlatform.state = 'PATROL';
                bossPlatform.stateTimer = phase2 ? 1.2 : 1.7;
              }
            } else if (bossPlatform.state === 'LEAP') {
              if (bossPlatform.grounded && bossPlatform.vy >= 0) {
                floorWaves.push({ x: bossPlatform.x - 20, y: 598, vx: phase2 ? -350 : -280, life: 2.6 });
                floorWaves.push({ x: bossPlatform.x + 20, y: 598, vx: phase2 ? 350 : 280, life: 2.6 });
                spawnShockwave(bossPlatform.x, 608, '#A78BFA', 70);
                shakeTimer = 0.16;
                soundEngine.playBump();
                bossPlatform.state = 'PATROL';
                bossPlatform.stateTimer = phase2 ? 1.3 : 1.9;
              }
            }

            bossPlatform.vy += 1450 * dt;
            bossPlatform.x = Math.max(100, Math.min(worldW - 100, bossPlatform.x + bossPlatform.vx * dt));
            bossPlatform.y += bossPlatform.vy * dt;
            if (bossPlatform.y >= 610 - bossPlatform.h / 2) {
              bossPlatform.y = 610 - bossPlatform.h / 2;
              bossPlatform.vy = 0;
              bossPlatform.grounded = true;
            }

            if (
              Math.abs(player.x - bossPlatform.x) < (player.w + bossPlatform.w) / 2 - 4 &&
              Math.abs(player.y - bossPlatform.y) < (player.h + bossPlatform.h) / 2 - 4 &&
              player.invulnTimer <= 0
            ) {
              damagePlayer((player.x >= bossPlatform.x ? 1 : -1) * 380, -340, false, 0.95);
            }
          }

          for (let i = floorWaves.length - 1; i >= 0; i--) {
            const fw = floorWaves[i];
            fw.x += fw.vx * dt;
            fw.life -= dt;
            if (Math.hypot(player.x - fw.x, player.y + player.h / 2 - fw.y) < 26 && player.invulnTimer <= 0) {
              damagePlayer(0, -260, false, 0.9);
            }
            if (fw.life <= 0 || fw.x < 40 || fw.x > worldW - 40) {
              floorWaves.splice(i, 1);
            }
          }

          for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.prevX = p.x;
            p.prevY = p.y;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            if (p.life <= 0 || p.x < 0 || p.x > worldW || p.y < 0 || p.y > worldH) {
              projectiles.splice(i, 1);
              continue;
            }

            let hitWall = false;
            for (const w of walls) {
              if (p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h) {
                hitWall = true;
                spawnParticles(p.x, p.y, p.fromBoss ? '#EF4444' : '#A78BFA', 4, 40);
                break;
              }
            }
            if (hitWall) {
              projectiles.splice(i, 1);
              continue;
            }

            if (p.fromBoss) {
              if (Math.hypot(p.x - player.x, p.y - player.y) < 18 && player.invulnTimer <= 0) {
                damagePlayer(Math.sign(p.vx) * 200, -180, false, 0.85);
                projectiles.splice(i, 1);
              }
              continue;
            }

            let hitSomething = false;
            for (const en of platformEnemies) {
              if (en.defeated) continue;
              if (Math.hypot(p.x - en.x, p.y - en.y) <= en.r + 12) {
                shotsHit += 1;
                en.hp -= 1;
                en.flash = 0.14;
                hitSomething = true;
                if (en.hp <= 0) {
                  en.defeated = true;
                  soundEngine.playEnemyDefeat();
                  spawnShockwave(en.x, en.y, '#A78BFA', 46);
                  spawnParticles(en.x, en.y, '#FBBF24', 14);
                  const deadCount = platformEnemies.filter((e) => e.defeated).length;
                  spawnFloatText(en.x, en.y - 16, `${deadCount}/${platformEnemies.length}`, '#C4B5FD');
                  if (stage.objectiveType === 'ENEMIES' && deadCount >= platformEnemies.length) {
                    completeStage();
                  }
                } else {
                  soundEngine.playEnemyHit();
                  spawnParticles(p.x, p.y, '#A78BFA', 6);
                }
                break;
              }
            }

            if (!hitSomething && bossPlatform && !bossPlatform.defeated) {
              if (
                Math.abs(p.x - bossPlatform.x) < bossPlatform.w / 2 + 12 &&
                Math.abs(p.y - bossPlatform.y) < bossPlatform.h / 2 + 12
              ) {
                hitSomething = true;
                shotsHit += 1;
                bossPlatform.hp -= 1;
                bossPlatform.flash = 0.14;
                soundEngine.playEnemyHit();
                spawnParticles(p.x, p.y, '#FBBF24', 8);
                if (bossPlatform.hp <= 0) {
                  bossPlatform.defeated = true;
                  soundEngine.playEnemyDefeat();
                  spawnShockwave(bossPlatform.x, bossPlatform.y, '#A78BFA', 95);
                  spawnParticles(bossPlatform.x, bossPlatform.y, '#FBBF24', 28);
                  completeStage();
                }
              }
            }

            if (hitSomething) {
              projectiles.splice(i, 1);
            }
          }

          for (const l of lasers) {
            if (isLaserActive(l, elapsedSec) && player.invulnTimer <= 0) {
              const dist = pointToSegmentDist(player.x, player.y, l.x1, l.y1, l.x2, l.y2);
              if (dist < 18) {
                damagePlayer(0, 0, true, 0.9);
              }
            }
          }

          if (player.y > worldH + 70) {
            player.invulnTimer = 0;
            damagePlayer(0, 0, true, 0.8);
          }

          for (const c of collectibles) {
            if (c.collected) continue;
            const hitAABB =
              Math.abs(player.x - c.x) < halfW + c.r + 8 &&
              Math.abs(player.y - c.y) < halfH + c.r + 8;
            if (hitAABB) {
              c.collected = true;
              const count = collectibles.filter((x) => x.collected).length;
              if (c.kind === 'key') {
                soundEngine.playKeyPickup();
                spawnShockwave(c.x, c.y, '#FBBF24', 56);
                spawnParticles(c.x, c.y, '#FDE047', 16);
                spawnFloatText(c.x, c.y - 18, 'Chave Obtida!', '#FDE047');
              } else if (c.kind === 'coin') {
                soundEngine.playCoin(count);
                spawnShockwave(c.x, c.y, '#FBBF24', 40);
                spawnParticles(c.x, c.y, '#FBBF24', 10);
                spawnFloatText(c.x, c.y - 16, `${count}/${collectibles.length}`);
              } else {
                soundEngine.playPickup(count);
                spawnShockwave(c.x, c.y, '#38BDF8', 42);
                spawnParticles(c.x, c.y, '#38BDF8', 12);
                spawnFloatText(c.x, c.y - 16, `${count}/${collectibles.length}`, '#38BDF8');
              }
            }
          }

          if (lockedDoor && !lockedDoor.unlocked && keysCollected >= lockedDoor.keysNeeded) {
            const distDoor = Math.hypot(
              player.x - (lockedDoor.x + lockedDoor.w / 2),
              player.y - (lockedDoor.y + lockedDoor.h / 2)
            );
            if (distDoor < 130) {
              lockedDoor.unlocked = true;
              soundEngine.playDoorUnlock();
              spawnShockwave(lockedDoor.x + lockedDoor.w / 2, lockedDoor.y + lockedDoor.h / 2, '#10B981', 70);
              spawnFloatText(lockedDoor.x, lockedDoor.y - 14, 'Porta Aberta!', '#34D399');
            }
          }

          const allPicked = collectibles.every((c) => c.collected);
          if (goalPortal) {
            goalPortal.active = allPicked && (!lockedDoor || lockedDoor.unlocked);
            if (goalPortal.active) {
              const dx = player.x - goalPortal.x;
              const dy = player.y - (goalPortal.y - 36);
              if (dx * dx + dy * dy < 44 * 44) {
                completeStage();
              }
            }
          }

          const targetCamX = Math.max(0, Math.min(worldW - VIEW_W, player.x - 440));
          const targetCamY = Math.max(0, Math.min(worldH - VIEW_H, player.y - 360));
          camX += (targetCamX - camX) * Math.min(1, dt * 7);
          camY += (targetCamY - camY) * Math.min(1, dt * 7);

          mouse.worldX = mouse.screenX + camX;
          mouse.worldY = mouse.screenY + camY;
          player.aimAngle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
        } else {
          // --- 2D TOP-DOWN & SHOOTER PHYSICS ---
          player.crouching = crouchPressed;
          player.r = player.crouching ? 12 : 18;

          const up = Boolean(keys['KeyW'] || keys['ArrowUp']);
          const down = Boolean(keys['KeyS'] || keys['ArrowDown']);
          const left = Boolean(keys['KeyA'] || keys['ArrowLeft']);
          const right = Boolean(keys['KeyD'] || keys['ArrowRight']);

          let ix = (right ? 1 : 0) - (left ? 1 : 0);
          let iy = (down ? 1 : 0) - (up ? 1 : 0);
          const movingDiagonal = ix !== 0 && iy !== 0;

          if (stage.id === 2) {
            if ((ix !== 0 || iy !== 0) && !movingDiagonal) {
              diagOnlyTimer += dt;
              if (diagOnlyTimer > 5.5) {
                diagOnlyTimer = 0;
                showHint('Dica: segure W e D (ou W e A) juntos para cortar curvas na diagonal!');
              }
            } else if (movingDiagonal) {
              diagOnlyTimer = 0;
            }
          }

          const len = Math.hypot(ix, iy);
          if (len > 0) {
            ix /= len;
            iy /= len;
            player.facingX = ix;
            player.facingY = iy;
            player.walkCycle += dt * 10;
          }

          const canSprint = stage.activeControls.includes('SHIFT');
          const shiftKeyDown = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
          const sprinting = updateStamina(shiftKeyDown && len > 0 && !player.crouching, canSprint, dt);

          player.trailTimer += dt;
          if (len > 0 && player.trailTimer > (sprinting ? 0.035 : 0.09)) {
            player.trailTimer = 0;
            particles.push({
              x: player.x - player.facingX * 14,
              y: player.y - player.facingY * 14,
              vx: (Math.random() - 0.5) * 20,
              vy: (Math.random() - 0.5) * 20,
              life: 0.25,
              maxLife: 0.25,
              color: player.crouching ? '#818CF8' : sprinting ? '#38BDF8' : '#14B8A6',
              size: sprinting ? 5 : 3.2,
            });
          }

          const topSpeed = player.crouching ? 155 : sprinting ? 405 : 265;
          const smooth = 1 - Math.exp(-15 * dt);
          player.vx += (ix * topSpeed - player.vx) * smooth;
          player.vy += (iy * topSpeed - player.vy) * smooth;

          player.x += player.vx * dt;
          player.y += player.vy * dt;

          const margin = player.r + 18;
          player.x = Math.max(margin, Math.min(VIEW_W - margin, player.x));
          player.y = Math.max(margin, Math.min(VIEW_H - margin, player.y));

          const solidRects: Rect[] = [...walls];
          if (lockedDoor && !lockedDoor.unlocked) {
            solidRects.push({ x: lockedDoor.x, y: lockedDoor.y, w: lockedDoor.w, h: lockedDoor.h });
          }

          for (const w of solidRects) {
            const res = circleRectResolve(player.x, player.y, player.r, w);
            if (res.hit) {
              if (wallBumpCooldown <= 0) {
                bumps += 1;
                wallBumpCooldown = 0.45;
                soundEngine.playBump();
                if (lockedDoor && w.x === lockedDoor.x && keysCollected < lockedDoor.keysNeeded) {
                  showHint(`Você precisa pegar ${lockedDoor.keysNeeded > 1 ? 'as Chaves Douradas' : 'a Chave Dourada'} para abrir a porta!`);
                }
              }
              player.x = res.nx;
              player.y = res.ny;
            }
          }

          mouse.worldX = mouse.screenX + camX;
          mouse.worldY = mouse.screenY + camY;
          player.aimAngle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);

          for (const l of lasers) {
            if (l.crouchSensor && player.crouching) continue;
            if (isLaserActive(l, elapsedSec) && player.invulnTimer <= 0) {
              const dist = pointToSegmentDist(player.x, player.y, l.x1, l.y1, l.x2, l.y2);
              if (dist < player.r + 4) {
                damagePlayer(-player.facingX * 360, -player.facingY * 360, false, 0.85);
                if (l.crouchSensor) {
                  showHint('Segure Ctrl ou C ao passar pelos sensores azuis!');
                }
              }
            }
          }

          for (const d of drones) {
            const segLen = Math.hypot(d.bx - d.ax, d.by - d.ay) || 1;
            d.t += (d.speed / segLen) * d.dir * dt;
            if (d.t >= 1) {
              d.t = 1;
              d.dir = -1;
            } else if (d.t <= 0) {
              d.t = 0;
              d.dir = 1;
            }
            const nextX = d.ax + (d.bx - d.ax) * d.t;
            const nextY = d.ay + (d.by - d.ay) * d.t;
            d.angle = Math.atan2(nextY - d.y, nextX - d.x);
            d.x = nextX;
            d.y = nextY;

            const dist = Math.hypot(player.x - d.x, player.y - d.y);
            if (dist < player.r + d.r && player.invulnTimer <= 0) {
              const pushAng = Math.atan2(player.y - d.y, player.x - d.x);
              damagePlayer(Math.cos(pushAng) * 440, Math.sin(pushAng) * 440, false, 0.9);
            }
          }

          if (stage.engine === '2D-TOP') {
            for (const c of collectibles) {
              if (c.collected) continue;
              const dist = Math.hypot(player.x - c.x, player.y - c.y);
              if (dist < player.r + c.r + 6) {
                c.collected = true;
                const count = collectibles.filter((x) => x.collected).length;
                if (c.kind === 'key') {
                  soundEngine.playKeyPickup();
                  spawnShockwave(c.x, c.y, '#FBBF24', 52);
                  spawnParticles(c.x, c.y, '#FDE047', 16);
                  spawnFloatText(c.x, c.y - 18, `Chave ${count}/${collectibles.length}`, '#FDE047');
                } else if (c.kind === 'coin') {
                  soundEngine.playCoin(count);
                  spawnShockwave(c.x, c.y, '#FBBF24', 42);
                  spawnParticles(c.x, c.y, '#FBBF24', 12);
                  spawnFloatText(c.x, c.y - 16, `${count}/${collectibles.length}`, '#FBBF24');
                } else {
                  soundEngine.playPickup(count);
                  spawnShockwave(c.x, c.y, '#10B981', 42);
                  spawnParticles(c.x, c.y, '#10B981', 12);
                  spawnFloatText(c.x, c.y - 16, `${count}/${collectibles.length}`, '#34D399');
                }
                if (!lockedDoor && !goalPortal && count >= collectibles.length) {
                  completeStage();
                }
              }
            }

            if (lockedDoor && !lockedDoor.unlocked && keysCollected >= lockedDoor.keysNeeded) {
              const distDoor = Math.hypot(
                player.x - (lockedDoor.x + lockedDoor.w / 2),
                player.y - (lockedDoor.y + lockedDoor.h / 2)
              );
              if (distDoor < 95) {
                lockedDoor.unlocked = true;
                soundEngine.playDoorUnlock();
                spawnShockwave(lockedDoor.x + lockedDoor.w / 2, lockedDoor.y + lockedDoor.h / 2, '#10B981', 65);
                spawnFloatText(lockedDoor.x, lockedDoor.y - 16, 'Porta Destrancada!', '#34D399');
              }
            }

            if (goalPortal) {
              goalPortal.active = (!lockedDoor || lockedDoor.unlocked) && collectibles.every((c) => c.collected);
              if (goalPortal.active && Math.hypot(player.x - goalPortal.x, player.y - goalPortal.y) < 38) {
                completeStage();
              }
            }
          }

          if (stage.id === 7) {
            for (const c of collectibles) {
              if (c.collected) continue;
              const dx = c.x - player.x;
              const dy = c.y - player.y;
              const dist = Math.hypot(dx, dy);
              const angleTo = Math.atan2(dy, dx);
              let diff = angleTo - player.aimAngle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;

              const blockedByWall = walls.some((w) => segmentIntersectsRect(player.x, player.y, c.x, c.y, w));
              const cursorDist = Math.hypot(mouse.worldX - c.x, mouse.worldY - c.y);
              if (!blockedByWall && ((Math.abs(diff) < 0.22 && dist < 640) || cursorDist < 55)) {
                c.charge = Math.min(1, c.charge + dt * 1.45);
                if (c.charge >= 1) {
                  c.collected = true;
                  const count = collectibles.filter((x) => x.collected).length;
                  soundEngine.playPickup(count);
                  spawnShockwave(c.x, c.y, '#38BDF8', 50);
                  spawnParticles(c.x, c.y, '#38BDF8', 14);
                  spawnFloatText(c.x, c.y - 18, 'Calibrado!', '#38BDF8');
                  if (count >= collectibles.length) completeStage();
                }
              } else {
                c.charge = Math.max(0, c.charge - dt * 0.45);
              }
            }
          }

          for (const en of enemies) {
            if (en.defeated) continue;
            en.flash = Math.max(0, en.flash - dt);
            en.x += en.vx * dt;
            en.y += en.vy * dt;
            if (en.x < en.minX || en.x > en.maxX) {
              en.vx *= -1;
              en.x = Math.max(en.minX, Math.min(en.maxX, en.x));
            }
            if (en.y < en.minY || en.y > en.maxY) {
              en.vy *= -1;
              en.y = Math.max(en.minY, Math.min(en.maxY, en.y));
            }
            en.angle = Math.atan2(player.y - en.y, player.x - en.x);

            if (en.fireTimer !== undefined) {
              en.fireTimer -= dt;
              if (en.fireTimer <= 0) {
                en.fireTimer = stage.id === 8 ? 2.8 : stage.id === 9 ? 2.5 : 2.2;
                const clearShot = !walls.some((w) => segmentIntersectsRect(en.x, en.y, player.x, player.y, w));
                if (clearShot) {
                  const spd = stage.id === 8 ? 225 : 255;
                  projectiles.push({
                    x: en.x + Math.cos(en.angle) * (en.r + 6),
                    y: en.y + Math.sin(en.angle) * (en.r + 6),
                    prevX: en.x,
                    prevY: en.y,
                    vx: Math.cos(en.angle) * spd,
                    vy: Math.sin(en.angle) * spd,
                    life: 2.8,
                    fromBoss: true,
                  });
                }
              }
            }

            if (Math.hypot(player.x - en.x, player.y - en.y) < player.r + en.r && player.invulnTimer <= 0) {
              const ang = Math.atan2(player.y - en.y, player.x - en.x);
              damagePlayer(Math.cos(ang) * 400, Math.sin(ang) * 400, false, 0.85);
            }
          }

          if (boss && !boss.defeated) {
            const phase2 = boss.hp <= boss.maxHp / 2;
            boss.flash = Math.max(0, boss.flash - dt);
            boss.movePhase += dt * (phase2 ? 1.55 : 0.95);
            boss.x = 640 + Math.sin(boss.movePhase) * 230;
            boss.y = 240 + Math.cos(boss.movePhase * 1.3) * 85;
            boss.shieldAngle += dt * (phase2 ? 2.4 : 1.5);

            boss.fireTimer -= dt;
            if (boss.fireTimer <= 0) {
              boss.fireTimer = phase2 ? 1.35 : 1.95;
              const volleyCount = phase2 ? 8 : 6;
              const baseAng = Math.atan2(player.y - boss.y, player.x - boss.x);
              for (let k = 0; k < volleyCount; k++) {
                const a = baseAng + (Math.PI * 2 * k) / volleyCount;
                projectiles.push({
                  x: boss.x + Math.cos(a) * (boss.r + 8),
                  y: boss.y + Math.sin(a) * (boss.r + 8),
                  vx: Math.cos(a) * (phase2 ? 270 : 215),
                  vy: Math.sin(a) * (phase2 ? 270 : 215),
                  prevX: boss.x,
                  prevY: boss.y,
                  life: 3.4,
                  fromBoss: true,
                });
              }
            }
          }

          if (stage.activeControls.includes('MOUSE_CLICK') && mouse.down && shootCooldown <= 0) {
            if (ammo <= 0) {
              shootCooldown = 0.25;
              soundEngine.playBump();
              showHint('Sem cargas! Golpeie inimigos ou orbes com F / Botão Direito para recarregar!');
            } else {
              ammo -= 1;
              shootCooldown = 0.19;
              shotsFired += 1;
              player.recoil = 1;
              soundEngine.playShoot();

              const muzzleX = player.x + Math.cos(player.aimAngle) * 24;
              const muzzleY = player.y + Math.sin(player.aimAngle) * 24;
              projectiles.push({
                x: muzzleX,
                y: muzzleY,
                prevX: muzzleX,
                prevY: muzzleY,
                vx: Math.cos(player.aimAngle) * 860,
                vy: Math.sin(player.aimAngle) * 860,
                life: 1.5,
              });
            }
          }

          for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.prevX = p.x;
            p.prevY = p.y;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            if (p.life <= 0 || p.x < 0 || p.x > VIEW_W || p.y < 0 || p.y > VIEW_H) {
              projectiles.splice(i, 1);
              continue;
            }

            let hitWall = false;
            for (const w of walls) {
              if (p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h) {
                hitWall = true;
                spawnParticles(p.x, p.y, p.fromBoss ? '#EF4444' : '#38BDF8', 4, 40);
                break;
              }
            }
            if (hitWall) {
              projectiles.splice(i, 1);
              continue;
            }

            if (p.fromBoss) {
              if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 7 && player.invulnTimer <= 0) {
                damagePlayer(Math.sign(p.vx) * 180, Math.sign(p.vy) * 180, false, 0.85);
                projectiles.splice(i, 1);
              }
              continue;
            }

            let hitSomething = false;
            for (const en of enemies) {
              if (en.defeated) continue;
              if (Math.hypot(p.x - en.x, p.y - en.y) <= en.r + 8) {
                shotsHit += 1;
                en.hp -= 1;
                en.flash = 0.14;
                hitSomething = true;
                if (en.hp <= 0) {
                  en.defeated = true;
                  soundEngine.playEnemyDefeat();
                  spawnShockwave(en.x, en.y, '#F59E0B', 46);
                  spawnParticles(en.x, en.y, '#FBBF24', 14);
                  const deadCount = enemies.filter((e) => e.defeated).length;
                  spawnFloatText(en.x, en.y - 14, `${deadCount}/${enemies.length}`);
                  if (deadCount >= enemies.length) completeStage();
                } else {
                  soundEngine.playEnemyHit();
                  spawnParticles(p.x, p.y, '#38BDF8', 6);
                }
                break;
              }
            }

            if (!hitSomething && boss && !boss.defeated) {
              const distToBoss = Math.hypot(p.x - boss.x, p.y - boss.y);
              if (distToBoss <= boss.r + 14) {
                const hitAng = Math.atan2(p.y - boss.y, p.x - boss.x);
                let blockedByShield = false;
                for (let s = 0; s < 2; s++) {
                  const sAng = boss.shieldAngle + s * Math.PI;
                  let diff = hitAng - sAng;
                  while (diff > Math.PI) diff -= Math.PI * 2;
                  while (diff < -Math.PI) diff += Math.PI * 2;
                  if (Math.abs(diff) < 0.65 && distToBoss > boss.r - 4) {
                    blockedByShield = true;
                    break;
                  }
                }
                hitSomething = true;
                if (blockedByShield) {
                  soundEngine.playBump();
                  spawnParticles(p.x, p.y, '#94A3B8', 5);
                } else {
                  shotsHit += 1;
                  boss.hp -= 1;
                  boss.flash = 0.14;
                  soundEngine.playEnemyHit();
                  spawnParticles(p.x, p.y, '#FBBF24', 8);
                  if (boss.hp <= 0) {
                    boss.defeated = true;
                    soundEngine.playEnemyDefeat();
                    spawnShockwave(boss.x, boss.y, '#F59E0B', 95);
                    spawnParticles(boss.x, boss.y, '#FBBF24', 28);
                    completeStage();
                  }
                }
              }
            }

            if (hitSomething) {
              projectiles.splice(i, 1);
            }
          }
        }

        // Flowing cape physics
        const anchorX = player.x - (isPlatformer ? player.facingX * 6 : Math.cos(player.aimAngle) * 7);
        const anchorY = player.y - (isPlatformer ? 4 : Math.sin(player.aimAngle) * 7);
        let prevNodeX = anchorX;
        let prevNodeY = anchorY;
        for (const node of player.cape) {
          const dx = node.x - prevNodeX;
          const dy = node.y - prevNodeY;
          const d = Math.hypot(dx, dy) || 1;
          const maxDist = 11;
          if (d > maxDist) {
            node.x = prevNodeX + (dx / d) * maxDist;
            node.y = prevNodeY + (dy / d) * maxDist;
          }
          if (isPlatformer) node.y += 22 * dt;
          prevNodeX = node.x;
          prevNodeY = node.y;
        }

        for (let i = particles.length - 1; i >= 0; i--) {
          const pt = particles[i];
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.life -= dt;
          if (pt.life <= 0) particles.splice(i, 1);
        }

        for (let i = shockwaves.length - 1; i >= 0; i--) {
          const sw = shockwaves[i];
          sw.life -= dt;
          sw.r = sw.maxR * (1 - sw.life / sw.maxLife);
          if (sw.life <= 0) shockwaves.splice(i, 1);
        }

        for (let i = floatTexts.length - 1; i >= 0; i--) {
          const ft = floatTexts[i];
          ft.y -= 34 * dt;
          ft.life -= dt;
          if (ft.life <= 0) floatTexts.splice(i, 1);
        }

        hudSyncTimer += dt;
        if (hudSyncTimer >= 0.08) {
          hudSyncTimer = 0;
          let collected = collectibles.filter((c) => c.collected).length;
          let total = collectibles.length;
          let objectiveText = stage.goalLabel;

          if (stage.objectiveType === 'ENEMIES') {
            if (isPlatformer) {
              collected = platformEnemies.filter((e) => e.defeated).length;
              total = platformEnemies.length;
              objectiveText = `Inimigos restantes: ${total - collected}`;
            } else {
              collected = enemies.filter((e) => e.defeated).length;
              total = enemies.length;
              objectiveText = `Sentinelas restantes: ${total - collected}`;
            }
          } else if (stage.objectiveType === 'BOSS') {
            if (bossPlatform) {
              collected = bossPlatform.maxHp - bossPlatform.hp;
              total = bossPlatform.maxHp;
              objectiveText = `Cavaleiro Sombrio · HP ${Math.round((bossPlatform.hp / bossPlatform.maxHp) * 100)}%`;
            } else if (boss) {
              collected = boss.maxHp - boss.hp;
              total = boss.maxHp;
              objectiveText = `Chefe Núcleo Titã · HP ${Math.round((boss.hp / boss.maxHp) * 100)}%`;
            }
          } else if (stage.objectiveType === 'KEY_DOOR' && lockedDoor) {
            collected = keysCollected + (lockedDoor.unlocked ? 1 : 0);
            total = lockedDoor.keysNeeded + 1;
            objectiveText =
              keysCollected < lockedDoor.keysNeeded
                ? `Pegue a Chave (${keysCollected}/${lockedDoor.keysNeeded})`
                : !lockedDoor.unlocked
                  ? 'Leve a Chave até a Porta!'
                  : 'Porta aberta! Entre no Portal';
          }

          callbacksRef.current.onStatusUpdate({
            collected,
            total,
            elapsedSec,
            hp: stageMaxHp !== undefined ? playerHp : undefined,
            maxHp: stageMaxHp,
            ammo: maxAmmo > 0 ? ammo : undefined,
            maxAmmo: maxAmmo > 0 ? maxAmmo : undefined,
            staminaPct: stage.activeControls.includes('SHIFT') ? player.stamina : undefined,
            staminaExhausted: stage.activeControls.includes('SHIFT') ? player.staminaExhausted : undefined,
            objectiveText,
            bossHpPct: bossPlatform
              ? Math.round((bossPlatform.hp / bossPlatform.maxHp) * 100)
              : boss
                ? Math.round((boss.hp / boss.maxHp) * 100)
                : undefined,
            hasKey: lockedDoor ? keysCollected >= lockedDoor.keysNeeded : undefined,
            totalKeys: lockedDoor?.keysNeeded,
          });
        }
      }

      // ================= RENDER =================
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.min(cw / VIEW_W, ch / VIEW_H);
      const offX = (cw - VIEW_W * scale) / 2;
      const offY = (ch - VIEW_H * scale) / 2;

      ctx.fillStyle = '#060A13';
      ctx.fillRect(0, 0, cw, ch);

      ctx.save();
      ctx.translate(offX, offY);
      ctx.scale(scale, scale);

      ctx.beginPath();
      ctx.rect(0, 0, VIEW_W, VIEW_H);
      ctx.clip();

      // Parallax Background for Platformers vs Contextual Floor for Top-Down
      if (isPlatformer) {
        const isBladeBiome = stage.id >= 19;
        const isCavernBiome = stage.id >= 16 && stage.id <= 18;

        // Layer 0: Deep atmospheric gradient sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        if (isBladeBiome) {
          skyGrad.addColorStop(0, '#130B24');
          skyGrad.addColorStop(0.55, '#1D1436');
          skyGrad.addColorStop(1, '#090D18');
        } else if (isCavernBiome) {
          skyGrad.addColorStop(0, '#09111F');
          skyGrad.addColorStop(0.6, '#132238');
          skyGrad.addColorStop(1, '#070B14');
        } else {
          skyGrad.addColorStop(0, '#0B1628');
          skyGrad.addColorStop(0.6, '#12293A');
          skyGrad.addColorStop(1, '#08101A');
        }
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);

        // Celestial Moon / Eclipse (ultra-slow 0.04x parallax)
        const moonX = 960 - camX * 0.04;
        const moonY = 135 - camY * 0.03;
        const halo = ctx.createRadialGradient(moonX, moonY, 16, moonX, moonY, 150);
        halo.addColorStop(0, isBladeBiome ? 'rgba(167, 139, 250, 0.38)' : 'rgba(45, 212, 191, 0.28)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 150, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isBladeBiome ? '#EDE9FE' : '#E2E8F0';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 34, 0, Math.PI * 2);
        ctx.fill();
        if (isBladeBiome) {
          ctx.fillStyle = '#18102E';
          ctx.beginPath();
          ctx.arc(moonX - 10, moonY - 5, 29, 0, Math.PI * 2);
          ctx.fill();
        }

        // Layer 1: Twinkling Stars / Deep Spore Motes (0.08x parallax)
        ctx.fillStyle = isBladeBiome ? 'rgba(216, 180, 254, 0.45)' : 'rgba(153, 246, 228, 0.4)';
        for (let s = 0; s < 26; s++) {
          const sxPos = ((s * 197 - camX * 0.08) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40) - 20;
          const syPos = (s * 83) % 340 + 24;
          const sz = (s % 3) + 1;
          ctx.fillRect(sxPos, syPos, sz, sz);
        }

        // Layer 2: Distant Mountain & Ruin Ridges (0.16x parallax)
        ctx.fillStyle = isBladeBiome ? '#1A1330' : isCavernBiome ? '#0E192B' : '#0E1F31';
        ctx.beginPath();
        ctx.moveTo(0, VIEW_H);
        const ridgeStep = 220;
        const rStart = Math.floor((camX * 0.16) / ridgeStep) * ridgeStep - ridgeStep;
        for (let rx = rStart; rx <= camX * 0.16 + VIEW_W + ridgeStep; rx += ridgeStep) {
          const drawX = rx - camX * 0.16;
          const hVar = Math.sin(rx * 0.015) * 65 + Math.cos(rx * 0.008) * 35;
          ctx.lineTo(drawX, 420 - hVar);
          ctx.lineTo(drawX + ridgeStep * 0.45, 360 - hVar);
          ctx.lineTo(drawX + ridgeStep * 0.78, 430 - hVar * 0.5);
        }
        ctx.lineTo(VIEW_W, VIEW_H);
        ctx.closePath();
        ctx.fill();

        // Layer 3: Mid-ground Gothic Arches & Ruin Pillars (0.35x parallax)
        const pillarStep = 260;
        const pStart = Math.floor((camX * 0.35) / pillarStep) * pillarStep - pillarStep;
        for (let px = pStart; px <= camX * 0.35 + VIEW_W + pillarStep; px += pillarStep) {
          const drawX = px - camX * 0.35;
          const drawY = 230 + Math.sin(px * 0.01) * 35 - camY * 0.15;
          ctx.fillStyle = isBladeBiome ? 'rgba(30, 22, 54, 0.85)' : 'rgba(15, 29, 48, 0.85)';
          ctx.fillRect(drawX, drawY, 44, VIEW_H - drawY);
          // Archway crossbar
          ctx.fillRect(drawX - 30, drawY, pillarStep * 0.52, 22);
          // Hanging chain or lantern glow
          ctx.fillStyle = isBladeBiome ? 'rgba(167, 139, 250, 0.38)' : 'rgba(56, 189, 248, 0.34)';
          ctx.beginPath();
          ctx.arc(drawX + 22, drawY + 42, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Layer 4: Foreground Drifting Bioluminescent Spores / Embers (0.62x parallax)
        if (!lowPowerRef.current) {
          for (let f = 0; f < 16; f++) {
            const fx = ((f * 137 + now * 0.018 - camX * 0.62) % VIEW_W + VIEW_W) % VIEW_W;
            const fy = ((f * 97 + Math.sin(now * 0.002 + f) * 28 - camY * 0.35) % VIEW_H + VIEW_H) % VIEW_H;
            ctx.fillStyle = isBladeBiome ? 'rgba(196, 181, 253, 0.32)' : 'rgba(94, 234, 212, 0.28)';
            ctx.beginPath();
            ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        ctx.fillStyle = '#0B111E';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);

        // Contextual floor landmarks for 2D Top-Down / Shooter
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.065)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx <= VIEW_W; gx += 80) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, VIEW_H);
          ctx.stroke();
        }
        for (let gy = 0; gy <= VIEW_H; gy += 80) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(VIEW_W, gy);
          ctx.stroke();
        }

        if (stage.id === 1) {
          // Market Plaza central fountain circle + cobblestone plaza lanes
          ctx.fillStyle = 'rgba(20, 184, 166, 0.08)';
          ctx.beginPath();
          ctx.arc(640, 360, 130, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.28)';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
          ctx.beginPath();
          ctx.arc(640, 360, 42, 0, Math.PI * 2);
          ctx.fill();
        } else if (stage.id >= 7 && stage.id <= 12) {
          // Tactical arena perimeter circle
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(640, 360, 220, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(20, 184, 166, 0.28)';
        ctx.lineWidth = 3;
        ctx.strokeRect(18, 18, VIEW_W - 36, VIEW_H - 36);
      }

      const sx = shakeTimer > 0 ? (Math.random() - 0.5) * 8 : 0;
      const sy = shakeTimer > 0 ? (Math.random() - 0.5) * 8 : 0;

      ctx.save();
      ctx.translate(-camX + sx, -camY + sy);

      // Walls & Platforms (plus decorative market awnings on Stage 1)
      walls.forEach((w, idx) => {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.52)';
        ctx.fillRect(w.x + 5, w.y + 7, w.w, w.h);

        ctx.fillStyle = w.overheadBar
          ? '#312E81'
          : w.wallClimbable
            ? '#1E3A5F'
            : w.moveAmpX || w.moveAmpY
              ? '#1E3A4C'
              : stage.id === 1 && idx > 0
                ? idx % 2 === 1
                  ? '#7C2D12'
                  : '#0F4C5C'
                : '#1E293B';
        ctx.fillRect(w.x, w.y, w.w, w.h);

        if (stage.id === 1 && idx === 0) {
          // Stone Fountain basin
          ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.beginPath();
          ctx.arc(w.x + w.w / 2, w.y + w.h / 2, 38, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#99F6E4';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (stage.id === 1 && idx > 0) {
          // Striped Market Stall Canopy
          ctx.fillStyle = idx % 2 === 1 ? '#F59E0B' : '#14B8A6';
          for (let sxOff = 0; sxOff < w.w; sxOff += 16) {
            ctx.fillRect(w.x + sxOff, w.y, 8, w.h);
          }
          ctx.strokeStyle = '#FDE68A';
          ctx.lineWidth = 2;
          ctx.strokeRect(w.x, w.y, w.w, w.h);
        } else if (w.wallClimbable) {
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(w.x, w.y, 4, w.h);
          ctx.fillRect(w.x + w.w - 4, w.y, 4, w.h);
        } else {
          ctx.fillStyle = w.overheadBar
            ? '#818CF8'
            : w.moveAmpX || w.moveAmpY
              ? '#38BDF8'
              : stage.id >= 19
                ? '#A78BFA'
                : '#14B8A6';
          ctx.fillRect(w.x, w.overheadBar ? w.y + w.h - 5 : w.y, w.w, 5);
        }
      });

      // Locked Door
      if (lockedDoor) {
        const slideOffset = lockedDoor.openProgress * (lockedDoor.h * 0.9);
        if (lockedDoor.openProgress < 0.98) {
          ctx.fillStyle = lockedDoor.unlocked ? '#10B981' : '#EF4444';
          ctx.fillRect(lockedDoor.x, lockedDoor.y - slideOffset, lockedDoor.w, lockedDoor.h);
          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 2;
          ctx.strokeRect(lockedDoor.x + 2, lockedDoor.y - slideOffset + 2, lockedDoor.w - 4, lockedDoor.h - 4);

          ctx.fillStyle = '#0F172A';
          ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            lockedDoor.unlocked ? 'ABERTA' : 'TRANCADA',
            lockedDoor.x + lockedDoor.w / 2,
            lockedDoor.y + lockedDoor.h / 2 - slideOffset + 4
          );
        }
      }

      // Lasers & Blue Crouch Sensors
      for (const l of lasers) {
        const active = isLaserActive(l, elapsedSec);
        const warn = isLaserWarning(l, elapsedSec);

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(l.x1, l.y1, 7, 0, Math.PI * 2);
        ctx.arc(l.x2, l.y2, 7, 0, Math.PI * 2);
        ctx.fill();

        if (l.crouchSensor) {
          ctx.setLineDash([10, 7]);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(l.x1, l.y1);
          ctx.lineTo(l.x2, l.y2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (active) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(l.x1, l.y1);
          ctx.lineTo(l.x2, l.y2);
          ctx.stroke();

          ctx.strokeStyle = '#F87171';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(l.x1, l.y1);
          ctx.lineTo(l.x2, l.y2);
          ctx.stroke();
        } else {
          ctx.setLineDash([6, 8]);
          ctx.strokeStyle = warn ? 'rgba(245, 158, 11, 0.8)' : 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(l.x1, l.y1);
          ctx.lineTo(l.x2, l.y2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if (stage.id === 7) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.arc(player.x, player.y, 460, player.aimAngle - 0.16, player.aimAngle + 0.16);
        ctx.closePath();
        const grad = ctx.createRadialGradient(player.x, player.y, 12, player.x, player.y, 460);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

      if (goalPortal) {
        const gx = goalPortal.x;
        const gy = isPlatformer ? goalPortal.y - 40 : goalPortal.y;
        const pulse = 1 + Math.sin(now * 0.006) * 0.09;

        ctx.beginPath();
        ctx.arc(gx, gy, 32 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = goalPortal.active ? 'rgba(16, 185, 129, 0.24)' : 'rgba(148, 163, 184, 0.12)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = goalPortal.active ? '#10B981' : '#64748B';
        ctx.stroke();

        ctx.fillStyle = goalPortal.active ? '#A7F3D0' : '#94A3B8';
        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(goalPortal.active ? 'SAÍDA' : 'BLOQUEADO', gx, gy - 42);
      }

      for (const c of collectibles) {
        if (c.collected) continue;
        const pulse = 1 + Math.sin(now * 0.0055 + c.id) * 0.09;

        if (c.kind === 'coin') {
          const spinWidth = Math.max(0.32, Math.abs(Math.cos(now * 0.004 + c.id)));
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.scale(spinWidth, 1);
          ctx.beginPath();
          ctx.arc(0, 0, c.r, 0, Math.PI * 2);
          ctx.fillStyle = '#F59E0B';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#FDE047';
          ctx.stroke();
          ctx.fillStyle = '#78350F';
          ctx.fillRect(-3, -7, 6, 14);
          ctx.restore();
        } else if (c.kind === 'key') {
          ctx.save();
          ctx.translate(c.x, c.y + Math.sin(now * 0.005) * 4);
          ctx.beginPath();
          ctx.arc(0, 0, c.r * 1.45 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
          ctx.fill();

          ctx.strokeStyle = '#FDE047';
          ctx.fillStyle = '#F59E0B';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(-8, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillRect(0, -3, 18, 6);
          ctx.fillRect(10, 3, 4, 6);
          ctx.fillRect(15, 3, 4, 5);
          ctx.restore();
        } else if (c.kind === 'radar') {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r * 1.3 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r * pulse, 0, Math.PI * 2);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#38BDF8';
          ctx.stroke();
          if (c.charge > 0) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c.charge);
            ctx.lineWidth = 4.5;
            ctx.strokeStyle = '#10B981';
            ctx.stroke();
          }
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r * 1.25 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#38BDF8';
          ctx.stroke();

          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(now * 0.002 + c.id);
          const s = c.r * 0.62;
          ctx.fillStyle = '#2DD4BF';
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s, 0);
          ctx.lineTo(0, s);
          ctx.lineTo(-s, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Top-down Enemies
      for (const en of enemies) {
        if (en.defeated) continue;
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.beginPath();
        ctx.arc(0, 0, en.r, 0, Math.PI * 2);
        ctx.fillStyle = en.flash > 0 ? '#FEF08A' : '#EA580C';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#FDBA74';
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(Math.cos(en.angle) * 6, Math.sin(en.angle) * 6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(Math.cos(en.angle) * 7, Math.sin(en.angle) * 7, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-14, -en.r - 10, 28, 4);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-14, -en.r - 10, 28 * (en.hp / en.maxHp), 4);
        ctx.restore();
      }

      // Platformer Enemies (Beetles, Flying Wasps, Guards)
      for (const en of platformEnemies) {
        if (en.defeated) continue;
        ctx.save();
        ctx.translate(en.x, en.y);

        if (en.kind === 'wasp') {
          const wingY = Math.sin(now * 0.04 + en.id) * 6;
          ctx.fillStyle = 'rgba(224, 231, 255, 0.72)';
          ctx.beginPath();
          ctx.ellipse(-6, -12 + wingY, 10, 5, -0.35, 0, Math.PI * 2);
          ctx.ellipse(6, -12 - wingY, 10, 5, 0.35, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = en.flash > 0 ? '#FEF08A' : '#7C3AED';
          ctx.beginPath();
          ctx.ellipse(0, 0, en.r, en.r * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#C4B5FD';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#FBBF24';
          ctx.beginPath();
          ctx.arc(en.facing * 7, -2, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Beetle / Armored Guard dome shell
          ctx.fillStyle = en.flash > 0 ? '#FEF08A' : en.kind === 'guard' ? '#B91C1C' : '#EA580C';
          ctx.beginPath();
          ctx.arc(0, 4, en.r, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = en.kind === 'guard' ? '#FCA5A5' : '#FDBA74';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Scuttling legs
          const legOff = Math.sin(now * 0.02 + en.id) * 3;
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(-10 + legOff, 4, 5, 10);
          ctx.fillRect(5 - legOff, 4, 5, 10);

          // Glowing eye
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.arc(en.facing * 8, -3, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // HP bar
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-15, -en.r - 12, 30, 4);
        ctx.fillStyle = en.kind === 'guard' ? '#EF4444' : '#A78BFA';
        ctx.fillRect(-15, -en.r - 12, 30 * (en.hp / en.maxHp), 4);
        ctx.restore();
      }

      // Platformer Boss: O Cavaleiro Sombrio
      if (bossPlatform && !bossPlatform.defeated) {
        ctx.save();
        ctx.translate(bossPlatform.x, bossPlatform.y);

        // Telegraph aura before dash
        if (bossPlatform.state === 'TELEGRAPH') {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 38, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Cloak
        ctx.fillStyle = bossPlatform.flash > 0 ? '#FEF08A' : '#3B0764';
        ctx.beginPath();
        ctx.moveTo(-18, -10);
        ctx.lineTo(18, -10);
        ctx.lineTo(24, 24);
        ctx.lineTo(8, 18);
        ctx.lineTo(0, 26);
        ctx.lineTo(-8, 18);
        ctx.lineTo(-24, 24);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#C084FC';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Boss Mask + Swept Dark Horns
        ctx.fillStyle = bossPlatform.flash > 0 ? '#FEF08A' : '#1E1B4B';
        ctx.beginPath();
        ctx.roundRect(-18, -28, 36, 24, 9);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-14, -22);
        ctx.quadraticCurveTo(-22, -44, -8, -46);
        ctx.quadraticCurveTo(-9, -34, -5, -24);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(14, -22);
        ctx.quadraticCurveTo(22, -44, 8, -46);
        ctx.quadraticCurveTo(9, -34, 5, -24);
        ctx.closePath();
        ctx.fill();

        // Glowing crimson void eyes
        const bShift = bossPlatform.facing * 4;
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.ellipse(-6 + bShift, -16, 3.5, 4.5, 0, 0, Math.PI * 2);
        ctx.ellipse(6 + bShift, -16, 3.5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Floor Shockwaves (Platform Boss)
      for (const fw of floorWaves) {
        ctx.fillStyle = '#A855F7';
        ctx.beginPath();
        ctx.arc(fw.x, fw.y, 16, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Top-down Boss 2D
      if (boss && !boss.defeated) {
        ctx.save();
        ctx.translate(boss.x, boss.y);

        ctx.lineWidth = 7;
        ctx.strokeStyle = '#38BDF8';
        for (let s = 0; s < 2; s++) {
          const sa = boss.shieldAngle + s * Math.PI;
          ctx.beginPath();
          ctx.arc(0, 0, boss.r + 12, sa - 0.58, sa + 0.58);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(0, 0, boss.r, 0, Math.PI * 2);
        ctx.fillStyle = boss.flash > 0 ? '#FEF08A' : boss.hp <= boss.maxHp / 2 ? '#DC2626' : '#B91C1C';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#FCA5A5';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#FBBF24';
        ctx.fill();
        ctx.restore();
      }

      // Patrol Drones
      for (const d of drones) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.save();
        ctx.rotate(d.angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, d.r + 36, -0.45, 0.45);
        ctx.closePath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(0, 0, d.r, 0, Math.PI * 2);
        ctx.fillStyle = '#DC2626';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FCA5A5';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FEF2F2';
        ctx.fill();
        ctx.restore();
      }

      // Projectiles
      for (const p of projectiles) {
        ctx.strokeStyle = p.fromBoss
          ? 'rgba(239, 68, 68, 0.5)'
          : p.isBladeWave
            ? 'rgba(196, 181, 253, 0.7)'
            : 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = p.isBladeWave ? 6 : 4;
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.fromBoss ? 7 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = p.fromBoss ? '#FCA5A5' : p.isBladeWave ? '#DDD6FE' : '#E0F2FE';
        ctx.fill();
      }

      for (const sw of shockwaves) {
        ctx.globalAlpha = Math.max(0, sw.life / sw.maxLife);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const pt of particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      // Flowing Hero Scarf/Cape
      ctx.strokeStyle = player.crouching ? '#818CF8' : isPlatformCombat ? '#A78BFA' : '#F59E0B';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - (isPlatformer ? 4 : 0));
      for (const node of player.cape) {
        ctx.lineTo(node.x, node.y);
      }
      ctx.stroke();

      // Expressive Compact Hollow-Knight-Style Hero (Platformer) vs Top-Down Explorer
      if (isPlatformer) {
        ctx.save();
        ctx.translate(player.x, player.y + player.h / 2);
        if (player.sliding) {
          ctx.rotate(-0.34 * player.facingX);
        }
        ctx.scale(player.squashX, player.squashY);
        ctx.translate(0, -player.h / 2);

        const blink = Math.sin(elapsedSec * 2.4) > 0.975;
        const hurtFlash = player.invulnTimer > 0 && Math.floor(now / 70) % 2 === 0;

        // Small nimble dark legs
        const legSwing = player.grounded && Math.abs(player.vx) > 20 ? Math.sin(player.walkCycle) * 4.5 : 0;
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-7 + legSwing, player.h / 2 - 5, 5, 5);
        ctx.fillRect(2 - legSwing, player.h / 2 - 5, 5, 5);

        // Short tattered cloak body
        const cloakTop = player.crouching ? -4 : -2;
        ctx.fillStyle = hurtFlash ? '#FCA5A5' : player.wallSliding ? '#0E7490' : '#1E293B';
        ctx.beginPath();
        ctx.moveTo(-11, cloakTop);
        ctx.lineTo(11, cloakTop);
        ctx.lineTo(13, player.h / 2 - 3);
        ctx.lineTo(5, player.h / 2 - 6);
        ctx.lineTo(0, player.h / 2 - 2);
        ctx.lineTo(-6, player.h / 2 - 6);
        ctx.lineTo(-13, player.h / 2 - 3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = player.wallSliding
          ? '#38BDF8'
          : player.sliding
            ? '#38BDF8'
            : player.crouching
              ? '#818CF8'
              : isPlatformCombat
                ? '#A78BFA'
                : '#2DD4BF';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Compact ivory horned mask head
        const maskY = player.crouching ? -7 : -12;
        const maskW = 24;
        const maskH = player.crouching ? 15 : 18;
        ctx.fillStyle = hurtFlash ? '#FEE2E2' : '#F8FAFC';
        ctx.beginPath();
        ctx.roundRect(-maskW / 2, maskY - maskH / 2 + 4, maskW, maskH, 8);
        ctx.fill();

        // Curved Knight Horns
        ctx.fillStyle = hurtFlash ? '#FEE2E2' : '#F8FAFC';
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

        // Expressive Dark Void Eyes
        const eyeShift = player.facingX * 3;
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

        // Nail Blade held toward aimAngle in combat stages
        if (isPlatformCombat) {
          ctx.save();
          ctx.rotate(player.aimAngle);
          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.moveTo(14, -2);
          ctx.lineTo(34, 0);
          ctx.lineTo(14, 2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();

        // Crescent Blade Slash arc VFX
        if (player.slashTimer > 0) {
          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.rotate(player.slashAngle);
          ctx.globalAlpha = player.slashTimer / 0.18;
          ctx.strokeStyle = '#DDD6FE';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(10, 0, 58, -1.05, 1.05);
          ctx.stroke();
          ctx.restore();
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.save();
        ctx.translate(player.x, player.y);

        ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
        ctx.beginPath();
        ctx.arc(3, 5, player.r, 0, Math.PI * 2);
        ctx.fill();

        if (player.crouching) {
          ctx.beginPath();
          ctx.arc(0, 0, player.r + 6, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(129, 140, 248, 0.75)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        const angle = stage.activeControls.includes('MOUSE_AIM')
          ? player.aimAngle
          : Math.atan2(player.facingY, player.facingX);
        ctx.rotate(angle);

        const kick = player.recoil * 4;

        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(player.r * 0.68 - kick, -player.r * 0.65, 4.5, 0, Math.PI * 2);
        ctx.arc(player.r * 0.68 - kick, player.r * 0.65, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(-kick, 0, player.r, 0, Math.PI * 2);
        ctx.fillStyle = player.invulnTimer > 0 && Math.floor(now / 75) % 2 === 0 ? '#FCA5A5' : '#0D9488';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = player.crouching ? '#818CF8' : '#CCFBF1';
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect(player.r * 0.2 - kick, -8, player.r * 0.65, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(player.r * 0.55 - kick, -5, 4, 3.5);
        ctx.fillRect(player.r * 0.55 - kick, 1.5, 4, 3.5);
        ctx.restore();

        // Top-down Melee Slash Arc VFX
        if (player.slashTimer > 0) {
          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.rotate(player.slashAngle);
          ctx.globalAlpha = player.slashTimer / 0.18;
          ctx.strokeStyle = '#DDD6FE';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(8, 0, 58, -1.08, 1.08);
          ctx.stroke();
          ctx.restore();
          ctx.globalAlpha = 1;
        }
      }

      // Helpful golden pointer toward nearest objective in Top-Down Cap 1
      if (stage.id <= 6) {
        let targetPt: { x: number; y: number } | null = null;
        let bestDist = Infinity;
        for (const c of collectibles) {
          if (c.collected) continue;
          const d = Math.hypot(c.x - player.x, c.y - player.y);
          if (d < bestDist) {
            bestDist = d;
            targetPt = c;
          }
        }
        if (!targetPt && goalPortal) {
          targetPt = goalPortal;
          bestDist = Math.hypot(goalPortal.x - player.x, goalPortal.y - player.y);
        }
        if (targetPt && bestDist > 64) {
          const ang = Math.atan2(targetPt.y - player.y, targetPt.x - player.x);
          const ax = player.x + Math.cos(ang) * (player.r + 16);
          const ay = player.y + Math.sin(ang) * (player.r + 16);
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(9, 0);
          ctx.lineTo(-5, -5);
          ctx.lineTo(-5, 5);
          ctx.closePath();
          ctx.fillStyle = '#FBBF24';
          ctx.fill();
          ctx.restore();
        }
      }

      for (const ft of floatTexts) {
        ctx.globalAlpha = Math.min(1, ft.life * 2);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;

      if (stage.activeControls.includes('MOUSE_AIM')) {
        const mx = mouse.worldX;
        const my = mouse.worldY;
        ctx.strokeStyle = isPlatformCombat ? '#C4B5FD' : '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mx, my, 12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(mx - 18, my);
        ctx.lineTo(mx - 7, my);
        ctx.moveTo(mx + 7, my);
        ctx.lineTo(mx + 18, my);
        ctx.moveTo(mx, my - 18);
        ctx.lineTo(mx, my - 7);
        ctx.moveTo(mx, my + 7);
        ctx.lineTo(mx, my + 18);
        ctx.stroke();
      }

      ctx.restore();
      ctx.restore();
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [stage, resetSignal]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#060A13] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className={`w-full h-full block ${stage.activeControls.includes('MOUSE_AIM') ? 'cursor-crosshair' : 'cursor-default'}`}
      />
    </div>
  );
};
