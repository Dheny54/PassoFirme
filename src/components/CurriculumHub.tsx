import React, { useRef, useState } from 'react';
import {
  Play,
  Star,
  Lock,
  Download,
  Upload,
  RotateCcw,
  Cpu,
  Hand,
  Check,
  Volume2,
  VolumeX,
  Trophy,
  Clock,
  KeyRound,
  Swords,
  Coins,
  Compass,
  Mountain,
  Crosshair,
  Flag,
} from 'lucide-react';
import { CHAPTERS, STAGES } from '../data/curriculum';
import { ChapterMeta, LiveInputState, SaveData, StageMeta, UserSettings } from '../types/game';
import { exportSaveToFile, importSaveFromFile } from '../utils/storage';
import { LiveHeroPreview } from './LiveHeroPreview';
import { InteractiveMechanicPreview } from './InteractiveMechanicPreview';
import { KeyboardMouseHandDiagram } from './KeyboardMouseHandDiagram';
import { ScreenTransition } from './ScreenTransition';

interface CurriculumHubProps {
  save: SaveData;
  onSelectStage: (stage: StageMeta) => void;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  onToggleSandbox: () => void;
  onUpdatePlayerName: (name: string) => void;
  onReplaceSave: (next: SaveData) => void;
  onResetSave: () => void;
}

type HubView = 'TRILHA' | 'GUIA' | 'SALVAR';

const BIOME_STYLES: Record<
  ChapterMeta['accent'],
  {
    bannerBg: string;
    bannerBorder: string;
    badgeText: string;
    progressBar: string;
    nodeActive: string;
    nodeDone: string;
    pathStroke: string;
  }
> = {
  teal: {
    bannerBg: 'bg-gradient-to-r from-teal-950/60 via-[#111827] to-[#111827]',
    bannerBorder: 'border-teal-500/35',
    badgeText: 'text-teal-400',
    progressBar: 'bg-teal-400',
    nodeActive: 'bg-teal-400 text-slate-950 border-teal-600 shadow-[0_0_24px_rgba(45,212,191,0.4)]',
    nodeDone: 'bg-teal-900/90 text-teal-200 border-teal-500',
    pathStroke: '#14B8A6',
  },
  sky: {
    bannerBg: 'bg-gradient-to-r from-sky-950/60 via-[#111827] to-[#111827]',
    bannerBorder: 'border-sky-500/35',
    badgeText: 'text-sky-400',
    progressBar: 'bg-sky-400',
    nodeActive: 'bg-sky-400 text-slate-950 border-sky-600 shadow-[0_0_24px_rgba(56,189,248,0.4)]',
    nodeDone: 'bg-sky-900/90 text-sky-200 border-sky-500',
    pathStroke: '#38BDF8',
  },
  indigo: {
    bannerBg: 'bg-gradient-to-r from-indigo-950/65 via-[#111827] to-[#111827]',
    bannerBorder: 'border-indigo-500/35',
    badgeText: 'text-indigo-400',
    progressBar: 'bg-indigo-400',
    nodeActive: 'bg-indigo-400 text-slate-950 border-indigo-600 shadow-[0_0_24px_rgba(129,140,248,0.4)]',
    nodeDone: 'bg-indigo-900/90 text-indigo-200 border-indigo-500',
    pathStroke: '#818CF8',
  },
  violet: {
    bannerBg: 'bg-gradient-to-r from-violet-950/65 via-[#111827] to-[#111827]',
    bannerBorder: 'border-violet-500/35',
    badgeText: 'text-violet-400',
    progressBar: 'bg-violet-400',
    nodeActive: 'bg-violet-400 text-slate-950 border-violet-600 shadow-[0_0_24px_rgba(167,139,250,0.4)]',
    nodeDone: 'bg-violet-900/90 text-violet-200 border-violet-500',
    pathStroke: '#A78BFA',
  },
  amber: {
    bannerBg: 'bg-gradient-to-r from-amber-950/55 via-[#111827] to-[#111827]',
    bannerBorder: 'border-amber-500/35',
    badgeText: 'text-amber-400',
    progressBar: 'bg-amber-400',
    nodeActive: 'bg-amber-400 text-slate-950 border-amber-600 shadow-[0_0_24px_rgba(251,191,36,0.4)]',
    nodeDone: 'bg-amber-900/85 text-amber-200 border-amber-500',
    pathStroke: '#F59E0B',
  },
  rose: {
    bannerBg: 'bg-gradient-to-r from-rose-950/60 via-[#111827] to-[#111827]',
    bannerBorder: 'border-rose-500/35',
    badgeText: 'text-rose-400',
    progressBar: 'bg-rose-400',
    nodeActive: 'bg-rose-400 text-slate-950 border-rose-600 shadow-[0_0_24px_rgba(251,113,133,0.4)]',
    nodeDone: 'bg-rose-900/85 text-rose-200 border-rose-500',
    pathStroke: '#F43F5E',
  },
};

function renderStageNodeIcon(stage: StageMeta, unlocked: boolean) {
  if (!unlocked) return <Lock className="w-6 h-6" />;
  if (stage.objectiveType === 'BOSS') return <Swords className="w-7 h-7" />;
  if (stage.isChallenge) return <Trophy className="w-6 h-6" />;
  if (stage.objectiveType === 'KEY_DOOR') return <KeyRound className="w-6 h-6" />;
  if (stage.objectiveType === 'WALL_CLIMB') return <Mountain className="w-6 h-6" />;
  if (stage.objectiveType === 'ENEMIES') return <Crosshair className="w-6 h-6" />;
  if (stage.objectiveType === 'PORTALS') return <Compass className="w-6 h-6" />;
  return <Coins className="w-6 h-6" />;
}

// Horizontal offset percentage along a winding S-curve path (-28% .. +28%)
function getNodeOffsetPct(index: number): number {
  const pattern = [0, -24, -30, -14, 16, 28, 18];
  return pattern[index % pattern.length];
}

export const CurriculumHub: React.FC<CurriculumHubProps> = ({
  save,
  onSelectStage,
  onUpdateSettings,
  onToggleSandbox,
  onUpdatePlayerName,
  onReplaceSave,
  onResetSave,
}) => {
  const [activeView, setActiveView] = useState<HubView>('TRILHA');
  const [selectedChapter, setSelectedChapter] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [guideLiveInput, setGuideLiveInput] = useState<LiveInputState>({
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
  });

  const completedCount = STAGES.filter((s) => save.results[s.id]?.completed).length;
  const totalStars = STAGES.reduce((acc, s) => acc + (save.results[s.id]?.stars ?? 0), 0);
  const maxStars = STAGES.length * 3;

  const accuracyEntries = STAGES.map((s) => save.results[s.id]?.accuracyPct).filter(
    (v): v is number => typeof v === 'number'
  );
  const avgAccuracy =
    accuracyEntries.length > 0
      ? Math.round(accuracyEntries.reduce((a, b) => a + b, 0) / accuracyEntries.length)
      : 0;

  const nextStage = STAGES.find((s) => !save.results[s.id]?.completed) ?? STAGES[0];

  const isStageUnlocked = (stageId: number) => {
    if (save.unlockAllSandbox || stageId === 1) return true;
    return Boolean(save.results[stageId - 1]?.completed);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const restored = await importSaveFromFile(file);
      onReplaceSave(restored);
      setImportMessage({
        type: 'ok',
        text: `Progresso de "${restored.playerName}" carregado com sucesso.`,
      });
    } catch (err) {
      setImportMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Não foi possível ler o arquivo selecionado.',
      });
    }
  };

  const visibleChapters =
    selectedChapter === 0 ? CHAPTERS : CHAPTERS.filter((c) => c.id === selectedChapter);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-[#090D16]/95 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveView('TRILHA')}
            className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            PassoFirme
          </button>

          <nav className="flex items-center gap-6 sm:gap-8 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveView('TRILHA')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeView === 'TRILHA'
                  ? 'text-teal-400 underline underline-offset-8'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Trilha ({STAGES.length} Fases)
            </button>
            <button
              type="button"
              onClick={() => setActiveView('GUIA')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeView === 'GUIA'
                  ? 'text-teal-400 underline underline-offset-8'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Guia de Mãos
            </button>
            <button
              type="button"
              onClick={() => setActiveView('SALVAR')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeView === 'SALVAR'
                  ? 'text-teal-400 underline underline-offset-8'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Salvar e Ajustes
            </button>
          </nav>

          <div className="hidden sm:block shrink-0">
            <button
              type="button"
              onClick={() => onSelectStage(nextStage)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {completedCount > 0 ? `Continuar · Fase ${String(nextStage.id).padStart(2, '0')}` : 'Começar Fase 01'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {activeView === 'TRILHA' && (
          <ScreenTransition screenKey="hub-trilha" className="space-y-10">
            {/* Hero Split */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-between bg-[#111827] rounded-2xl border border-slate-800 p-7 sm:p-8">
                <div>
                  <p className="text-xs font-medium text-teal-400 mb-3">
                    Jornada Progressiva de Teclado e Mouse · {STAGES.length} Fases Temáticas
                  </p>
                  <h1
                    className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4"
                    style={{ textWrap: 'balance' }}
                  >
                    Domine andar, escalar, desviar e mirar no PC.
                  </h1>
                  <p className="text-[15px] leading-relaxed text-slate-300 mb-5">
                    Siga a trilha de aventura passo a passo: domine o teclado no <strong className="text-white">Vale da Descoberta</strong>, enfrente inimigos em plataforma nas <strong className="text-white">Ruínas da Lâmina</strong> e conquiste o <strong className="text-white">Pico do Colosso 3D</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onSelectStage(nextStage)}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {completedCount > 0 ? `Jogar Fase ${String(nextStage.id).padStart(2, '0')}` : 'Iniciar Jornada · Fase 01'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView('GUIA')}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700/70 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Hand className="w-4 h-4 text-teal-400" />
                    Mapa das Mãos
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 min-h-[290px]">
                <LiveHeroPreview />
              </div>
            </section>

            {/* Progress Summary Strip */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5">
                <div className="text-xs text-slate-400 mb-1">Fases Concluídas</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white">
                  {completedCount}/{STAGES.length}
                </div>
              </div>

              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5">
                <div className="text-xs text-slate-400 mb-1">Estrelas Coletadas</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-amber-400">
                  {totalStars}/{maxStars}
                </div>
              </div>

              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5">
                <div className="text-xs text-slate-400 mb-1">Precisão Média</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-teal-400">
                  {completedCount > 0 ? `${avgAccuracy}%` : '—'}
                </div>
              </div>

              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5">
                <div className="text-xs text-slate-400 mb-1">Perfil Gráfico</div>
                <div className="text-lg font-semibold text-slate-100 truncate">
                  {save.settings.lowPowerMode ? 'Modo Leve (Celeron)' : 'Qualidade Padrão'}
                </div>
              </div>
            </section>

            {/* Chapter Filter + Sandbox Toggle */}
            <section className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedChapter(0)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      selectedChapter === 0
                        ? 'bg-teal-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Mapa Completo
                  </button>
                  {CHAPTERS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedChapter(c.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        selectedChapter === c.id
                          ? 'bg-teal-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Cap. {c.id}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={save.unlockAllSandbox}
                    onChange={onToggleSandbox}
                    className="w-4 h-4 accent-teal-400 rounded cursor-pointer"
                  />
                  <span>Liberar todas as fases (Treino Livre)</span>
                </label>
              </div>

              {/* Duolingo / Candy Crush Style Winding Adventure Trail */}
              <div className="space-y-10">
                {visibleChapters.map((chapter) => {
                  const chapterStages = STAGES.filter((s) => s.chapterId === chapter.id);
                  const chapterDone = chapterStages.filter((s) => save.results[s.id]?.completed).length;
                  const chapterPct = Math.round((chapterDone / chapterStages.length) * 100);
                  const theme = BIOME_STYLES[chapter.accent];

                  return (
                    <div
                      key={chapter.id}
                      className={`rounded-2xl border ${theme.bannerBorder} bg-[#0D1322] overflow-hidden`}
                    >
                      {/* Biome Header Banner */}
                      <div className={`px-6 py-5 border-b border-slate-800/80 ${theme.bannerBg}`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme.badgeText}`}>
                              {chapter.biomeName} · {chapter.dimensionSummary}
                            </div>
                            <h2 className="font-display text-xl font-bold text-white">
                              {chapter.title}
                            </h2>
                            <p className="text-sm text-slate-300 mt-0.5">{chapter.subtitle}</p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-mono tabular-nums text-slate-300">
                              {chapterDone}/{chapterStages.length} etapas
                            </span>
                            <div className="w-28 h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                              <div
                                className={`h-full ${theme.progressBar} transition-[width] duration-300`}
                                style={{ width: `${chapterPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Winding Adventure Path Nodes */}
                      <div className="py-8 px-4 sm:px-8 max-w-3xl mx-auto">
                        {chapterStages.map((stage, idx) => {
                          const unlocked = isStageUnlocked(stage.id);
                          const result = save.results[stage.id];
                          const stars = result?.stars ?? 0;
                          const isCurrent = stage.id === nextStage.id && !result?.completed;

                          const offsetPct = getNodeOffsetPct(idx);
                          const hasNextInChapter = idx + 1 < chapterStages.length;
                          const nextOffsetPct = hasNextInChapter ? getNodeOffsetPct(idx + 1) : offsetPct;

                          // Coordinates in a 400x100 connector SVG (200 = center)
                          const x1 = 200 + offsetPct * 2.1;
                          const x2 = 200 + nextOffsetPct * 2.1;

                          // Place info label on opposite side of the curve so it never clips
                          const labelOnRight = offsetPct <= 0;

                          return (
                            <div key={stage.id} className="relative flex flex-col items-center">
                              {/* Node Row */}
                              <div
                                className="relative z-10 flex items-center justify-center transition-transform"
                                style={{ transform: `translateX(${offsetPct}%)` }}
                              >
                                <div className="relative flex flex-col items-center">
                                  {isCurrent && (
                                    <div className="mb-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-bold tracking-wide shadow">
                                      <Flag className="w-3 h-3 fill-current" />
                                      VOCÊ ESTÁ AQUI
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    disabled={!unlocked}
                                    onClick={() => onSelectStage(stage)}
                                    className={`group relative w-20 h-20 rounded-full border-2 border-b-[6px] flex flex-col items-center justify-center transition-transform active:translate-y-0.5 ${
                                      result?.completed
                                        ? `${theme.nodeDone} hover:scale-105 cursor-pointer`
                                        : isCurrent
                                          ? `${theme.nodeActive} hover:scale-105 cursor-pointer ring-4 ring-white/15`
                                          : unlocked
                                            ? 'bg-slate-800 text-white border-slate-600 hover:border-teal-400 hover:scale-105 cursor-pointer'
                                            : 'bg-slate-900/70 text-slate-600 border-slate-800 cursor-not-allowed opacity-65'
                                    }`}
                                  >
                                    {renderStageNodeIcon(stage, unlocked)}
                                    <span className="font-mono text-[10px] font-bold mt-0.5 tabular-nums">
                                      {String(stage.id).padStart(2, '0')}
                                    </span>

                                    {/* Timed badge on corner */}
                                    {stage.timeLimitSec && (
                                      <span
                                        title={`Desafio cronometrado (${stage.timeLimitSec}s)`}
                                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center border-2 border-[#0D1322]"
                                      >
                                        <Clock className="w-3 h-3" />
                                      </span>
                                    )}
                                  </button>

                                  {/* Stars directly under node */}
                                  <div className="flex items-center gap-1 mt-1.5">
                                    {[1, 2, 3].map((sIdx) => (
                                      <Star
                                        key={sIdx}
                                        className={`w-3.5 h-3.5 ${
                                          result?.completed && sIdx <= stars
                                            ? 'fill-amber-400 text-amber-400'
                                            : 'text-slate-700'
                                        }`}
                                      />
                                    ))}
                                  </div>

                                  {/* Side Context Card on desktop */}
                                  <button
                                    type="button"
                                    disabled={!unlocked}
                                    onClick={() => onSelectStage(stage)}
                                    className={`hidden md:flex flex-col text-left w-60 p-3 rounded-xl border transition-colors absolute top-1/2 -translate-y-1/2 ${
                                      labelOnRight ? 'left-24' : 'right-24'
                                    } ${
                                      unlocked
                                        ? stage.isChallenge
                                          ? 'bg-amber-950/25 border-amber-500/40 hover:border-amber-400 cursor-pointer'
                                          : 'bg-[#111827] border-slate-800 hover:border-slate-600 cursor-pointer'
                                        : 'bg-[#0A0F1B] border-slate-800/50 opacity-60 cursor-not-allowed'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
                                      <span className={stage.isChallenge ? 'text-amber-400 font-semibold' : theme.badgeText}>
                                        {stage.dimensionLabel}
                                      </span>
                                      {result?.bestTimeSec != null && (
                                        <span className="font-mono tabular-nums text-slate-300">
                                          {result.bestTimeSec.toFixed(1)}s
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-display text-sm font-bold text-white leading-snug">
                                      {stage.title}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                                      {stage.goalLabel}
                                    </div>
                                  </button>

                                  {/* Mobile compact label under stars */}
                                  <div className="md:hidden text-center mt-1 max-w-[200px]">
                                    <div className="text-xs font-bold text-white">{stage.title}</div>
                                    <div className="text-[11px] text-slate-400">{stage.goalLabel}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Winding SVG Connector Path to Next Node */}
                              {hasNextInChapter && (
                                <svg
                                  viewBox="0 0 400 76"
                                  className="w-full max-w-[400px] h-14 -my-1 pointer-events-none"
                                  preserveAspectRatio="none"
                                  aria-hidden="true"
                                >
                                  <path
                                    d={`M ${x1} 0 C ${x1} 38, ${x2} 38, ${x2} 76`}
                                    fill="none"
                                    stroke={result?.completed ? theme.pathStroke : '#334155'}
                                    strokeWidth="5"
                                    strokeDasharray={result?.completed ? 'none' : '8 8'}
                                    strokeLinecap="round"
                                    strokeOpacity={result?.completed ? 0.75 : 0.65}
                                  />
                                </svg>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </ScreenTransition>
        )}

        {activeView === 'GUIA' && (
          <ScreenTransition screenKey="hub-guia" className="space-y-8">
            <div className="bg-[#111827] rounded-2xl border border-slate-800 p-7 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="text-xs font-medium text-teal-400">
                    Ergonomia e Memória Muscular
                  </div>
                  <h1 className="font-display text-3xl font-bold text-white">
                    Posição das Mãos e Dedos
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Deixe o dedo <strong className="text-white">Anelar no A</strong>, o <strong className="text-white">Médio no W</strong> e o <strong className="text-white">Indicador no D</strong>. Experimente pressionar as teclas ou testar a arena abaixo para ver cada dedo se acender ao vivo!
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <span><strong className="text-white">C</strong> ou <strong className="text-white">Ctrl</strong> agacha · corra com <strong className="text-white">Shift + C</strong> para dar <strong className="text-white">Deslize (Slide)</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <span><strong className="text-white">F</strong> ou <strong className="text-white">Botão Direito</strong> desfere golpe de lâmina (sem gastar munição!)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <span><strong className="text-white">Polegar no Espaço</strong> para pular e fazer Wall Jump</span>
                    </li>
                  </ul>
                </div>

                <div className="lg:col-span-7">
                  <KeyboardMouseHandDiagram
                    activeControls={['W', 'A', 'S', 'D', 'SHIFT', 'CTRL', 'SPACE', 'F', 'MOUSE_AIM', 'MOUSE_CLICK']}
                    liveInput={guideLiveInput}
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#111827] rounded-2xl border border-slate-800 p-7 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-2">
                  <div className="text-xs font-medium text-sky-400">Área Livre de Teste</div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Teste o pequeno cavaleiro agora
                  </h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Use <strong className="text-slate-200">A / D</strong> para caminhar, <strong className="text-slate-200">Shift</strong> para correr, <strong className="text-slate-200">C / Ctrl</strong> para agachar e <strong className="text-slate-200">Espaço</strong> para pular e escalar paredes. O teclado acima ilumina junto!
                  </p>
                </div>
                <div className="lg:col-span-7">
                  <InteractiveMechanicPreview
                    action="WALL_CLIMB"
                    mode="interactive"
                    onLiveInputChange={setGuideLiveInput}
                  />
                </div>
              </div>
            </div>
          </ScreenTransition>
        )}

        {activeView === 'SALVAR' && (
          <ScreenTransition screenKey="hub-salvar" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-[#111827] rounded-2xl border border-slate-800 p-7 space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold text-white">
                  Salvar e Exportar Progresso Local
                </h1>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  Seu avanço é salvo automaticamente neste navegador. Exporte um arquivo{' '}
                  <code className="font-mono text-xs bg-[#0B101B] border border-slate-800 px-1.5 py-0.5 rounded text-teal-300">.json</code>{' '}
                  para guardar uma cópia no computador ou continuar em outro PC.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label htmlFor="player-name" className="text-sm font-medium text-slate-300 shrink-0">
                  Nome no save:
                </label>
                <input
                  id="player-name"
                  type="text"
                  maxLength={28}
                  value={save.playerName}
                  onChange={(e) => onUpdatePlayerName(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 rounded-lg bg-[#0B101B] border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => exportSaveToFile(save)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Exportar Progresso (.json)
                </button>

                <button
                  type="button"
                  onClick={handleImportClick}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Importar Arquivo (.json)
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Zerar Progresso
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-rose-950/60 border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-rose-200 font-medium">Apagar tudo?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onResetSave();
                        setConfirmReset(false);
                        setImportMessage({ type: 'ok', text: 'Progresso reiniciado.' });
                      }}
                      className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold hover:bg-rose-500 cursor-pointer"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 cursor-pointer"
                    >
                      Não
                    </button>
                  </div>
                )}
              </div>

              {importMessage && (
                <div
                  className={`text-sm rounded-lg px-3.5 py-2.5 border ${
                    importMessage.type === 'ok'
                      ? 'bg-teal-950/40 border-teal-500/40 text-teal-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {importMessage.text}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bg-[#111827] rounded-2xl border border-slate-800 p-7 space-y-5">
              <div className="flex items-start gap-3">
                <Cpu className="w-5 h-5 text-teal-400 shrink-0 mt-1" />
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    Desempenho e Controles
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Otimizado para notebooks com 4 GB de RAM e processador Intel Celeron.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-1">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-slate-100">Modo Leve (Celeron / 4GB)</div>
                    <div className="text-xs text-slate-400">Reduz resolução 3D e desativa sombras pesadas</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={save.settings.lowPowerMode}
                    onChange={(e) => onUpdateSettings({ lowPowerMode: e.target.checked })}
                    className="w-4 h-4 accent-teal-400 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-slate-100">Visor de Teclas na Tela</div>
                    <div className="text-xs text-slate-400">Mostra W-A-S-D, Shift e C/Ctrl acendendo em tempo real</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={save.settings.showVirtualKeys}
                    onChange={(e) => onUpdateSettings({ showVirtualKeys: e.target.checked })}
                    className="w-4 h-4 accent-teal-400 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div className="flex items-center gap-2">
                    {save.settings.soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-teal-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-sm font-medium text-slate-100">Efeitos Sonoros</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={save.settings.soundEnabled}
                    onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
                    className="w-4 h-4 accent-teal-400 cursor-pointer"
                  />
                </label>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-100">Sensibilidade do Mouse (3D)</span>
                    <span className="font-mono tabular-nums text-teal-400">
                      {save.settings.mouseSensitivity.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={2.4}
                    step={0.1}
                    value={save.settings.mouseSensitivity}
                    onChange={(e) => onUpdateSettings({ mouseSensitivity: parseFloat(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </ScreenTransition>
        )}
      </main>

      <footer className="max-w-6xl w-full mx-auto px-6 py-7 border-t border-slate-800/80 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <span>PassoFirme · Treinamento progressivo de mobilidade e mira para PC</span>
        <span>Progresso salvo localmente no navegador com exportação em JSON</span>
      </footer>
    </div>
  );
};
