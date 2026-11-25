import { SaveData, StageResult, UserSettings } from '../types/game';

const STORAGE_KEY = 'passofirme_save_v4';
const LEGACY_KEYS = ['passofirme_save_v1', 'passofirme_save_v2', 'passofirme_save_v3'];

export function detectHardwareLowPowerDefault(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowRam = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
    const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    let softwareGl = false;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      softwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    return lowRam || lowCores || softwareGl;
  } catch {
    return false;
  }
}

export function createDefaultSave(): SaveData {
  const defaultSettings: UserSettings = {
    mouseSensitivity: 1.0,
    lowPowerMode: detectHardwareLowPowerDefault(),
    soundEnabled: true,
    showVirtualKeys: true,
    invertY: false,
  };

  return {
    version: 3,
    playerName: 'Aprendiz',
    updatedAt: new Date().toISOString(),
    results: {},
    settings: defaultSettings,
    unlockAllSandbox: false,
  };
}

export function loadSave(): SaveData {
  try {
    // Clear legacy save versions so stage numbering changes stay clean
    for (const oldKey of LEGACY_KEYS) {
      if (localStorage.getItem(oldKey) !== null) {
        localStorage.removeItem(oldKey);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const fallback = createDefaultSave();
    return {
      version: 3,
      playerName: typeof parsed.playerName === 'string' && parsed.playerName.trim() ? parsed.playerName : fallback.playerName,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
      results: parsed.results && typeof parsed.results === 'object' ? parsed.results : {},
      settings: {
        ...fallback.settings,
        ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}),
      },
      unlockAllSandbox: Boolean(parsed.unlockAllSandbox),
    };
  } catch {
    return createDefaultSave();
  }
}

export function writeSave(data: SaveData): SaveData {
  const updated: SaveData = {
    ...data,
    version: 3,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors gracefully
  }
  return updated;
}

export function computeStars(elapsedSec: number, parTimeSec: number, accuracyPct: number): number {
  if (elapsedSec <= parTimeSec && accuracyPct >= 80) return 3;
  if (elapsedSec <= parTimeSec * 1.45 && accuracyPct >= 55) return 2;
  return 1;
}

export function mergeStageResult(
  save: SaveData,
  stageId: number,
  elapsedSec: number,
  parTimeSec: number,
  accuracyPct: number
): SaveData {
  const prev: StageResult | undefined = save.results[stageId];
  const stars = computeStars(elapsedSec, parTimeSec, accuracyPct);
  const nextResult: StageResult = {
    completed: true,
    stars: Math.max(prev?.stars ?? 0, stars),
    bestTimeSec: prev?.bestTimeSec != null ? Math.min(prev.bestTimeSec, elapsedSec) : elapsedSec,
    accuracyPct: Math.max(prev?.accuracyPct ?? 0, accuracyPct),
    attempts: (prev?.attempts ?? 0) + 1,
  };

  return writeSave({
    ...save,
    results: {
      ...save.results,
      [stageId]: nextResult,
    },
  });
}

export function exportSaveToFile(save: SaveData): void {
  const payload = JSON.stringify(save, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const datePart = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `passofirme-progresso-${datePart}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function importSaveFromFile(file: File): Promise<SaveData> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<SaveData>;
  if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number' || !parsed.results) {
    throw new Error('Arquivo de progresso inválido. Use um arquivo .json exportado pelo PassoFirme.');
  }
  const fallback = createDefaultSave();
  const sanitized: SaveData = {
    version: 2,
    playerName: typeof parsed.playerName === 'string' && parsed.playerName.trim() ? parsed.playerName.slice(0, 32) : 'Aprendiz',
    updatedAt: new Date().toISOString(),
    results: parsed.results,
    settings: {
      ...fallback.settings,
      ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}),
    },
    unlockAllSandbox: Boolean(parsed.unlockAllSandbox),
  };
  return writeSave(sanitized);
}

export function clearSave(): SaveData {
  const fresh = createDefaultSave();
  try {
    localStorage.removeItem(STORAGE_KEY);
    for (const oldKey of LEGACY_KEYS) {
      localStorage.removeItem(oldKey);
    }
  } catch {
    // ignore
  }
  return writeSave(fresh);
}
