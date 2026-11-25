/**
 * Intercepts browser/Windows keyboard shortcuts (Ctrl+W, Ctrl+A, Ctrl+S, Ctrl+D, Ctrl+R, Space scroll, etc.)
 * during active practice or warmup so holding Ctrl to crouch + WASD never triggers unintended browser actions.
 * Also supports experimental Keyboard Lock API when entering Fullscreen.
 */

const BLOCKED_CODES_ON_CTRL = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyC',
  'KeyR',
  'KeyF',
  'KeyP',
  'KeyS',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'KeyO',
  'KeyU',
  'KeyT',
  'KeyN',
  'Space',
  'Tab',
]);

const ALWAYS_PREVENT_SCROLL_CODES = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

export function installGameShortcutGuard(options?: { preventTabUnload?: boolean }): () => void {
  const onKeyDownCapture = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (ALWAYS_PREVENT_SCROLL_CODES.has(e.code)) {
      e.preventDefault();
    }

    if (e.ctrlKey || e.metaKey || e.altKey) {
      if (BLOCKED_CODES_ON_CTRL.has(e.code) || e.code.startsWith('Digit') || e.code.startsWith('F')) {
        e.preventDefault();
      }
    }

    if (e.code === 'F1' || e.code === 'F3' || e.code === 'F5' || e.code === 'F6' || e.code === 'F7' || e.code === 'Tab') {
      e.preventDefault();
    }
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (options?.preventTabUnload) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  window.addEventListener('keydown', onKeyDownCapture, { capture: true, passive: false });
  window.addEventListener('contextmenu', onContextMenu);
  if (options?.preventTabUnload) {
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  return () => {
    window.removeEventListener('keydown', onKeyDownCapture, { capture: true });
    window.removeEventListener('contextmenu', onContextMenu);
    if (options?.preventTabUnload) {
      window.removeEventListener('beforeunload', onBeforeUnload);
    }
  };
}

interface NavigatorWithKeyboard extends Navigator {
  keyboard?: {
    lock?: (keyCodes?: string[]) => Promise<void>;
    unlock?: () => void;
  };
}

export async function togglePracticeFullscreen(): Promise<boolean> {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      const nav = navigator as NavigatorWithKeyboard;
      await nav.keyboard?.lock?.([
        'ControlLeft',
        'ControlRight',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'KeyC',
        'KeyR',
        'ShiftLeft',
        'Space',
        'Tab',
      ]);
      return true;
    } else {
      const nav = navigator as NavigatorWithKeyboard;
      nav.keyboard?.unlock?.();
      await document.exitFullscreen();
      return false;
    }
  } catch {
    return Boolean(document.fullscreenElement);
  }
}

export function releaseKeyboardLockIfAny(): void {
  try {
    const nav = navigator as NavigatorWithKeyboard;
    nav.keyboard?.unlock?.();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  } catch {
    // ignore
  }
}
