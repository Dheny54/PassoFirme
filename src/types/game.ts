export type EngineDimension = '2D-TOP' | '2D-SHOOTER' | '2D-PLATFORM' | '3D-THIRD' | '3D-FPS';

export type KeyControlId =
  | 'W'
  | 'A'
  | 'S'
  | 'D'
  | 'SHIFT'
  | 'CTRL'
  | 'SPACE'
  | 'F'
  | 'MOUSE_AIM'
  | 'MOUSE_CLICK';

export type ObjectiveType =
  | 'COINS'
  | 'PORTALS'
  | 'KEY_DOOR'
  | 'ENEMIES'
  | 'WALL_CLIMB'
  | 'BOSS';

export type DemoActionType =
  | 'WALK'
  | 'DIAGONAL'
  | 'SPRINT'
  | 'CROUCH'
  | 'KEY_DOOR'
  | 'AIM'
  | 'MELEE'
  | 'SHOOT'
  | 'BOSS_2D'
  | 'JUMP'
  | 'DOUBLE_JUMP'
  | 'WALL_CLIMB'
  | 'SLIDE'
  | 'SLIDE_CROUCH'
  | 'PLATFORM_COMBAT'
  | 'BOSS_PLATFORM'
  | 'CAMERA_3D'
  | 'JUMP_3D'
  | 'PARKOUR_3D'
  | 'SPRINT_3D'
  | 'FPS_CROUCH'
  | 'FPS_SLIDE'
  | 'FPS_MELEE'
  | 'FPS_SHOOT'
  | 'BOSS_3D';

export interface WarmupPrompt {
  control: KeyControlId;
  keyLabel: string;
  fingerLabel: string;
  actionTitle: string;
  worldExplanation: string;
  previewAction: DemoActionType;
}

export interface StageMeta {
  id: number;
  chapterId: number;
  chapterTitle: string;
  title: string;
  dimensionLabel: string;
  engine: EngineDimension;
  objectiveType: ObjectiveType;
  demoAction: DemoActionType;
  showPreview: boolean;
  timeLimitSec?: number;
  isChallenge?: boolean;
  newMechanic: string;
  masteredSkills: string[];
  activeControls: KeyControlId[];
  warmupPrompts: WarmupPrompt[];
  briefingText: string;
  coachTip: string;
  goalLabel: string;
  targetCount: number;
  parTimeSec: number;
}

export interface ChapterMeta {
  id: number;
  title: string;
  biomeName: string;
  subtitle: string;
  dimensionSummary: string;
  accent: 'teal' | 'sky' | 'indigo' | 'violet' | 'amber' | 'rose';
}

export interface StageResult {
  completed: boolean;
  stars: number; // 1 to 3
  bestTimeSec: number | null;
  accuracyPct: number;
  attempts: number;
}

export interface UserSettings {
  mouseSensitivity: number; // 0.3 to 2.5
  lowPowerMode: boolean; // Celeron / 4GB RAM optimization
  soundEnabled: boolean;
  showVirtualKeys: boolean;
  invertY: boolean;
}

export interface SaveData {
  version: number;
  playerName: string;
  updatedAt: string;
  results: Record<number, StageResult>;
  settings: UserSettings;
  unlockAllSandbox: boolean;
}

export interface LiveInputState {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  shift: boolean;
  ctrl: boolean;
  space: boolean;
  f?: boolean;
  mouseDown: boolean;
  rightMouseDown?: boolean;
}

export interface StageHudStatus {
  collected: number;
  total: number;
  elapsedSec: number;
  hp?: number;
  maxHp?: number;
  ammo?: number;
  maxAmmo?: number;
  staminaPct?: number;
  staminaExhausted?: boolean;
  objectiveText?: string;
  bossHpPct?: number;
  hasKey?: boolean;
  totalKeys?: number;
}

export interface StageCompletionPayload {
  stageId: number;
  elapsedSec: number;
  accuracyPct: number;
  bumps: number;
}
