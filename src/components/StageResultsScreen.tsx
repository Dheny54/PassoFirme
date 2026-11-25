import React from 'react';
import { ArrowRight, RotateCcw, Star, LayoutGrid, Clock, CheckCircle2, HeartCrack } from 'lucide-react';
import { StageCompletionPayload, StageMeta } from '../types/game';
import { computeStars } from '../utils/storage';

interface StageResultsScreenProps {
  stage: StageMeta;
  result: StageCompletionPayload | null;
  failReason: 'timeout' | 'defeated' | null;
  hasNextStage: boolean;
  onNext: () => void;
  onReplay: () => void;
  onMenu: () => void;
}

export const StageResultsScreen: React.FC<StageResultsScreenProps> = ({
  stage,
  result,
  failReason,
  hasNextStage,
  onNext,
  onReplay,
  onMenu,
}) => {
  if (failReason) {
    const isDefeated = failReason === 'defeated';
    return (
      <div className="h-dvh w-screen overflow-hidden bg-[#090D16] text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-rose-500/40 p-7 space-y-5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-rose-400">
            {isDefeated ? <HeartCrack className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            {isDefeated ? 'Vidas Esgotadas' : 'Tempo Esgotado'} · Fase {String(stage.id).padStart(2, '0')}
          </div>

          <h1 className="font-display text-3xl font-bold text-white">
            {isDefeated ? 'Você perdeu todas as vidas!' : 'Quase lá! O relógio zerou.'}
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            {isDefeated ? (
              <>
                Em <strong>{stage.title}</strong>, os obstáculos e ataques drenaram seus corações. Use cobertura, observe os padrões antes de avançar e tente de novo!
              </>
            ) : (
              <>
                O limite de <strong className="text-white">{stage.timeLimitSec}s</strong> em <strong>{stage.title}</strong> terminou antes de concluir o objetivo. Use o <strong className="text-teal-400">Shift</strong> para acelerar nos trechos retos e economizar segundos preciosos!
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onMenu}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4" />
              Voltar à Trilha
            </button>

            <button
              type="button"
              onClick={onReplay}
              autoFocus
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;
  const stars = computeStars(result.elapsedSec, stage.parTimeSec, result.accuracyPct);

  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#090D16] text-slate-100 flex flex-col">
      <header className="shrink-0 border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={onMenu}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4" />
            Voltar à Trilha
          </button>

          <div className="text-xs font-medium text-slate-400">
            Etapa 3 de 3 · Resultados da Fase {String(stage.id).padStart(2, '0')}
          </div>

          <div className="text-xs font-medium text-teal-400">Salvo automaticamente</div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-6">
        <div className="w-full max-w-2xl max-h-full overflow-y-auto rounded-2xl bg-[#111827] border border-slate-800 p-7 sm:p-8 space-y-5">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-400 mb-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Missão Concluída · {stage.dimensionLabel}
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">
              {stage.title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                  idx <= stars
                    ? 'bg-amber-500/15 border-amber-400/50 text-amber-400'
                    : 'bg-[#0B101B] border-slate-800 text-slate-600'
                }`}
              >
                <Star className={`w-6 h-6 ${idx <= stars ? 'fill-amber-400' : ''}`} />
              </div>
            ))}
            <span className="ml-2 text-base font-medium text-slate-200">
              {stars === 3
                ? 'Domínio excelente!'
                : stars === 2
                  ? 'Muito bem! Movimento firme.'
                  : 'Objetivo cumprido! Repita quando quiser buscar 3 estrelas.'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-[#0B101B] border border-slate-800 p-4">
              <div className="text-xs text-slate-400 mb-1">Tempo Total</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-white">
                {result.elapsedSec.toFixed(1)}s
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                Meta 3★: {stage.parTimeSec}s
              </div>
            </div>

            <div className="rounded-xl bg-[#0B101B] border border-slate-800 p-4">
              <div className="text-xs text-slate-400 mb-1">Precisão</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-white">
                {Math.round(result.accuracyPct)}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {result.bumps === 0 ? 'Sem esbarrões' : `${result.bumps} esbarrões`}
              </div>
            </div>

            <div className="rounded-xl bg-[#0B101B] border border-slate-800 p-4">
              <div className="text-xs text-slate-400 mb-1">Desempenho</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-teal-400">
                {stars}/3 Estrelas
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {stage.goalLabel}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onMenu}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                <LayoutGrid className="w-4 h-4" />
                Trilha
              </button>
              <button
                type="button"
                onClick={onReplay}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Jogar Novamente
              </button>
            </div>

            {hasNextStage && (
              <button
                type="button"
                onClick={onNext}
                autoFocus
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors whitespace-nowrap shadow-sm cursor-pointer"
              >
                Próxima Fase
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
