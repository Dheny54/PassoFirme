import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Clock,
  Maximize2,
  Minimize2,
  Heart,
  Zap,
} from 'lucide-react';
import {
  LiveInputState,
  StageCompletionPayload,
  StageHudStatus,
  StageMeta,
  UserSettings,
} from '../types/game';
import { Canvas2DEngine } from './engines/Canvas2DEngine';
import { Three3DEngine } from './engines/Three3DEngine';
import { InputHUD } from './InputHUD';
import { StageBriefingScreen } from './StageBriefingScreen';
import { WarmupScreen } from './WarmupScreen';
import { StageResultsScreen } from './StageResultsScreen';
import { ScreenTransition } from './ScreenTransition';
import {
  installGameShortcutGuard,
  releaseKeyboardLockIfAny,
  togglePracticeFullscreen,
} from '../utils/shortcutGuard';

interface GameViewProps {
  stage: StageMeta;
  hasNextStage: boolean;
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  onStageComplete: (payload: StageCompletionPayload) => void;
  onNextStage: () => void;
  onExitToHub: () => void;
}

const EMPTY_INPUT: LiveInputState = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
  ctrl: false,
  space: false,
  f: false,
  mouseDown: false,
  rightMouseDown: false,
};

type GamePhase = 'BRIEFING' | 'WARMUP' | 'PLAYING' | 'RESULTS' | 'TIMEOUT' | 'DEFEATED';

function getBossDisplayName(stageId: number): string {
  if (stageId >= 30) return 'Chefe Colosso 3D';
  if (stageId >= 19) return 'Chefe Cavaleiro Sombrio';
  return 'Chefe Núcleo Titã';
}

export const GameView: React.FC<GameViewProps> = ({
  stage,
  hasNextStage,
  settings,
  onUpdateSettings,
  onStageComplete,
  onNextStage,
  onExitToHub,
}) => {
  const [phase, setPhase] = useState<GamePhase>(() => (stage.showPreview ? 'BRIEFING' : 'PLAYING'));
  const [resetSignal, setResetSignal] = useState(0);
  const [inputState, setInputState] = useState<LiveInputState>(EMPTY_INPUT);
  const [hud, setHud] = useState<StageHudStatus>({
    collected: 0,
    total: stage.targetCount,
    elapsedSec: 0,
    staminaPct: stage.activeControls.includes('SHIFT') ? 100 : undefined,
    objectiveText: stage.goalLabel,
  });
  const [coachHint, setCoachHint] = useState<string | null>(null);
  const [quickBanner, setQuickBanner] = useState<boolean>(!stage.showPreview);
  const [completionResult, setCompletionResult] = useState<StageCompletionPayload | null>(null);
  const [dockExpanded, setDockExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Guarantee zero vertical or horizontal scroll while inside any stage flow
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.removeEventListener('fullscreenchange', onFsChange);
      releaseKeyboardLockIfAny();
    };
  }, []);

  // Block Windows/browser shortcuts (Ctrl+W, Ctrl+A, Ctrl+S, Ctrl+D, Ctrl+R, Space scroll) during active practice
  useEffect(() => {
    if (phase !== 'PLAYING' && phase !== 'WARMUP') return;
    return installGameShortcutGuard({ preventTabUnload: phase === 'PLAYING' });
  }, [phase]);

  useEffect(() => {
    setPhase(stage.showPreview ? 'BRIEFING' : 'PLAYING');
    setQuickBanner(!stage.showPreview);
    setHud({
      collected: 0,
      total: stage.targetCount,
      elapsedSec: 0,
      staminaPct: stage.activeControls.includes('SHIFT') ? 100 : undefined,
      objectiveText: stage.goalLabel,
    });
    setCoachHint(null);
    setCompletionResult(null);
    setInputState(EMPTY_INPUT);
    setResetSignal((n) => n + 1);
  }, [stage.id, stage.showPreview, stage.targetCount, stage.activeControls, stage.goalLabel]);

  useEffect(() => {
    if (!quickBanner || phase !== 'PLAYING') return;
    const timer = window.setTimeout(() => setQuickBanner(false), 3200);
    return () => window.clearTimeout(timer);
  }, [quickBanner, phase]);

  const handleRestart = useCallback(() => {
    setHud({
      collected: 0,
      total: stage.targetCount,
      elapsedSec: 0,
      staminaPct: stage.activeControls.includes('SHIFT') ? 100 : undefined,
      objectiveText: stage.goalLabel,
    });
    setCoachHint(null);
    setQuickBanner(false);
    setCompletionResult(null);
    setPhase('PLAYING');
    setResetSignal((n) => n + 1);
  }, [stage.activeControls, stage.targetCount, stage.goalLabel]);

  const handleStatusUpdate = useCallback((status: StageHudStatus) => {
    setHud(status);
  }, []);

  const handleComplete = useCallback(
    (payload: StageCompletionPayload) => {
      setCompletionResult(payload);
      setPhase('RESULTS');
      onStageComplete(payload);
    },
    [onStageComplete]
  );

  const handleTimeout = useCallback(() => {
    setPhase('TIMEOUT');
  }, []);

  const handleDefeated = useCallback(() => {
    setPhase('DEFEATED');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && phase === 'PLAYING') {
        handleRestart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, handleRestart]);

  const is3D = stage.engine === '3D-THIRD' || stage.engine === '3D-FPS';
  const isBossStage = stage.objectiveType === 'BOSS' || hud.bossHpPct !== undefined;
  const remainingTime =
    stage.timeLimitSec !== undefined ? Math.max(0, stage.timeLimitSec - hud.elapsedSec) : null;

  if (phase === 'BRIEFING') {
    return (
      <ScreenTransition screenKey={`briefing-${stage.id}`}>
        <StageBriefingScreen
          stage={stage}
          onStartWarmup={() => setPhase(stage.warmupPrompts.length > 0 ? 'WARMUP' : 'PLAYING')}
          onBack={onExitToHub}
        />
      </ScreenTransition>
    );
  }

  if (phase === 'WARMUP') {
    return (
      <ScreenTransition screenKey={`warmup-${stage.id}`}>
        <WarmupScreen
          stage={stage}
          onComplete={() => setPhase('PLAYING')}
          onBackToBriefing={() => setPhase('BRIEFING')}
        />
      </ScreenTransition>
    );
  }

  if (phase === 'RESULTS' || phase === 'TIMEOUT' || phase === 'DEFEATED') {
    return (
      <ScreenTransition screenKey={`results-${stage.id}-${phase}`}>
        <StageResultsScreen
          stage={stage}
          result={completionResult}
          failReason={phase === 'TIMEOUT' ? 'timeout' : phase === 'DEFEATED' ? 'defeated' : null}
          hasNextStage={hasNextStage}
          onNext={onNextStage}
          onReplay={handleRestart}
          onMenu={onExitToHub}
        />
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition
      screenKey={`playing-${stage.id}-${resetSignal}`}
      className="fixed inset-0 h-dvh w-screen bg-[#090D16] text-slate-100 select-none overflow-hidden"
    >
      <main
        className="relative w-full h-full overflow-hidden"
        onContextMenu={(e) => e.preventDefault()}
      >
        {is3D ? (
          <Three3DEngine
            stage={stage}
            paused={false}
            lowPowerMode={settings.lowPowerMode}
            mouseSensitivity={settings.mouseSensitivity}
            invertY={settings.invertY}
            resetSignal={resetSignal}
            onInputChange={setInputState}
            onStatusUpdate={handleStatusUpdate}
            onCoachHint={setCoachHint}
            onComplete={handleComplete}
            onTimeout={handleTimeout}
            onDefeated={handleDefeated}
          />
        ) : (
          <Canvas2DEngine
            stage={stage}
            paused={false}
            lowPowerMode={settings.lowPowerMode}
            resetSignal={resetSignal}
            onInputChange={setInputState}
            onStatusUpdate={handleStatusUpdate}
            onCoachHint={setCoachHint}
            onComplete={handleComplete}
            onTimeout={handleTimeout}
            onDefeated={handleDefeated}
          />
        )}

        {/* Top-Left Minimal Corner Overlay: Back + Essential Gameplay Objective / Player HP / Ammo / Timer */}
        <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onExitToHub}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 text-xs">
            {/* On Boss stages, center Boss Bar already shows boss name & HP%, so keep top-left compact & put Player Hearts front-and-center */}
            {!isBossStage && (
              <>
                <span className="font-semibold text-slate-100 whitespace-nowrap">
                  {hud.objectiveText ?? stage.goalLabel}
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums font-bold text-amber-400">
                  {hud.collected}/{hud.total}
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
              </>
            )}

            {hud.maxHp !== undefined && hud.hp !== undefined && (
              <>
                <div className="flex items-center gap-1" title={`Sua Vida: ${hud.hp} de ${hud.maxHp}`}>
                  {Array.from({ length: hud.maxHp }).map((_, idx) => (
                    <Heart
                      key={idx}
                      className={`w-3.5 h-3.5 ${
                        idx < hud.hp!
                          ? 'text-rose-400 fill-rose-400'
                          : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-slate-600" aria-hidden="true">·</span>
              </>
            )}

            {remainingTime !== null ? (
              <span
                className={`inline-flex items-center gap-1 font-mono tabular-nums font-bold ${
                  remainingTime <= 7
                    ? 'text-rose-400'
                    : remainingTime <= 14
                      ? 'text-amber-400'
                      : 'text-teal-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {remainingTime.toFixed(1)}s
              </span>
            ) : (
              <span className="font-mono tabular-nums text-slate-300">
                {hud.elapsedSec.toFixed(1)}s
              </span>
            )}

            {hud.maxAmmo !== undefined && hud.ammo !== undefined && (
              <>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <div
                  className="flex items-center gap-1"
                  title="Cargas de Disparo (recarga sozinho ou +2 ao acertar golpe corpo a corpo com F / Botão Dir.)"
                >
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: hud.maxAmmo }).map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-2 h-2.5 rounded-[2px] ${
                          idx < hud.ammo! ? 'bg-sky-400' : 'bg-slate-800 border border-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {hud.staminaPct !== undefined && (
              <>
                <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
                <div
                  className="hidden sm:flex items-center gap-1.5"
                  title={hud.staminaExhausted ? 'Sem fôlego — solte o Shift para recarregar' : 'Fôlego (Shift)'}
                >
                  <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-[width] duration-75 ${
                        hud.staminaExhausted
                          ? 'bg-rose-400'
                          : hud.staminaPct < 30
                            ? 'bg-amber-400'
                            : 'bg-sky-400'
                      }`}
                      style={{ width: `${Math.round(hud.staminaPct)}%` }}
                    />
                  </div>
                  {hud.staminaExhausted && (
                    <span className="text-[10px] font-semibold text-rose-300">Cansado</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Boss HP Bar (Top-Center only during Boss stages — zero overlap with compact top-left HUD) */}
        {hud.bossHpPct !== undefined && (
          <div className="pointer-events-none absolute top-14 sm:top-3.5 left-1/2 -translate-x-1/2 z-20 w-60 sm:w-76 rounded-lg bg-slate-950/90 border border-rose-500/50 px-3.5 py-2">
            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
              <span className="text-rose-300">{getBossDisplayName(stage.id)}</span>
              <span className="font-mono tabular-nums text-white">{hud.bossHpPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-[width] duration-100"
                style={{ width: `${hud.bossHpPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Top-Right Minimal Corner Actions: Restart, Fullscreen Shortcut Lock, Example, Audio */}
        <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={handleRestart}
            title="Reiniciar fase (Tecla R)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reiniciar (R)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              togglePracticeFullscreen().then(setIsFullscreen);
            }}
            title="Tela Cheia (bloqueia atalhos como Ctrl+W)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-teal-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPhase('BRIEFING')}
            title="Ver instruções e controles"
            className="p-2 rounded-lg bg-slate-950/90 border border-slate-700/80 text-slate-200 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            title={settings.soundEnabled ? 'Silenciar áudio' : 'Ativar áudio'}
            className="p-2 rounded-lg bg-slate-950/90 border border-slate-700/80 text-slate-200 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {/* Brief Non-blocking Goal Banner on Direct-Play Stages (no preview) */}
        {quickBanner && !coachHint && (
          <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-slate-950/92 border border-teal-500/50 text-xs text-slate-100 shadow-lg text-center">
            <span className="font-semibold text-teal-300">Fase {String(stage.id).padStart(2, '0')} · {stage.title}:</span>{' '}
            <span>{stage.goalLabel}</span>
          </div>
        )}

        {/* Real-time Contextual Coach Hint (non-blocking) */}
        {coachHint && (
          <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-amber-950/95 border border-amber-500/60 text-xs font-medium text-amber-100 shadow-lg max-w-md text-center">
            {coachHint}
          </div>
        )}

        {/* Bottom-left Live Virtual Keyboard & Mouse Visualizer */}
        <div className="absolute bottom-3.5 left-3.5 z-20">
          <InputHUD
            input={inputState}
            activeControls={stage.activeControls}
            visible={settings.showVirtualKeys}
          />
        </div>

        {/* Bottom-right Compact Collapsible Adjustments Dock */}
        <div className="absolute bottom-3.5 right-3.5 z-20 flex flex-col items-end gap-2">
          {dockExpanded && (
            <div className="w-72 rounded-xl bg-slate-950/95 border border-slate-700/80 p-4 text-xs shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Ajustes Rápidos</span>
                <button
                  type="button"
                  onClick={() => setDockExpanded(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {is3D && (
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Sensibilidade do Mouse</span>
                    <span className="font-mono tabular-nums">{settings.mouseSensitivity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={2.4}
                    step={0.1}
                    value={settings.mouseSensitivity}
                    onChange={(e) => onUpdateSettings({ mouseSensitivity: parseFloat(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>
              )}

              <label className="flex items-center justify-between gap-2 text-slate-300 cursor-pointer">
                <span>Visor de Teclas (WASD)</span>
                <input
                  type="checkbox"
                  checked={settings.showVirtualKeys}
                  onChange={(e) => onUpdateSettings({ showVirtualKeys: e.target.checked })}
                  className="accent-teal-400 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between gap-2 text-slate-300 cursor-pointer">
                <span>Modo Leve (Celeron / 4GB)</span>
                <input
                  type="checkbox"
                  checked={settings.lowPowerMode}
                  onChange={(e) => onUpdateSettings({ lowPowerMode: e.target.checked })}
                  className="accent-teal-400 w-4 h-4"
                />
              </label>

              {is3D && (
                <label className="flex items-center justify-between gap-2 text-slate-300 cursor-pointer">
                  <span>Inverter Eixo Y do Mouse</span>
                  <input
                    type="checkbox"
                    checked={settings.invertY}
                    onChange={(e) => onUpdateSettings({ invertY: e.target.checked })}
                    className="accent-teal-400 w-4 h-4"
                  />
                </label>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setDockExpanded((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-teal-400" />
            Ajustes
            {dockExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </main>
    </ScreenTransition>
  );
};
