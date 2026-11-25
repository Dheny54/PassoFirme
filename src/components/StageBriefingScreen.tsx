import React from 'react';
import { Play, ArrowLeft, Lightbulb, CheckCircle2, Clock } from 'lucide-react';
import { StageMeta } from '../types/game';
import { InteractiveMechanicPreview } from './InteractiveMechanicPreview';
import { KeyboardMouseHandDiagram } from './KeyboardMouseHandDiagram';

interface StageBriefingScreenProps {
  stage: StageMeta;
  onStartWarmup: () => void;
  onBack: () => void;
}

export const StageBriefingScreen: React.FC<StageBriefingScreenProps> = ({
  stage,
  onStartWarmup,
  onBack,
}) => {
  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#090D16] text-slate-100 flex flex-col">
      <header className="shrink-0 border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar à Trilha
          </button>

          <div className="text-xs font-medium text-slate-400 whitespace-nowrap truncate">
            Etapa 1 de 3 · Exemplo Guiado & Mãos · Fase {String(stage.id).padStart(2, '0')}
          </div>

          <button
            type="button"
            onClick={onStartWarmup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Ir para Aquecimento
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden px-6 py-4 flex items-center justify-center">
        <div className="w-full max-w-6xl h-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-0">
          {/* Left: Scrollable ONLY within this panel if screen height is small */}
          <div className="lg:col-span-6 min-h-0 overflow-y-auto pr-2 space-y-4 flex flex-col justify-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
                <span>Fase {String(stage.id).padStart(2, '0')}</span>
                <span aria-hidden="true">·</span>
                <span>{stage.chapterTitle}</span>
                <span aria-hidden="true">·</span>
                <span className={stage.isChallenge ? 'text-amber-400 font-semibold' : 'text-teal-400 font-semibold'}>
                  {stage.dimensionLabel}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                {stage.title}
              </h1>

              <p className="text-sm leading-relaxed text-slate-300">
                {stage.briefingText}
              </p>
            </div>

            <div
              className={`rounded-xl border p-3.5 ${
                stage.isChallenge
                  ? 'bg-amber-950/30 border-amber-500/40'
                  : 'bg-[#111827] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-xs font-semibold ${stage.isChallenge ? 'text-amber-400' : 'text-teal-400'}`}>
                  Objetivo da Missão
                </span>
                {stage.timeLimitSec && (
                  <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-amber-300">
                    <Clock className="w-3.5 h-3.5" />
                    Limite: {stage.timeLimitSec}s
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-white mb-0.5">{stage.goalLabel}</p>
              <p className="text-xs text-slate-400">{stage.newMechanic}</p>
            </div>

            {/* Visual Keyboard + Hand Finger Placement + Mouse */}
            <KeyboardMouseHandDiagram activeControls={stage.activeControls} compact />

            {stage.masteredSkills.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className="font-medium text-slate-300">Habilidades já dominadas:</span>
                {stage.masteredSkills.map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-1 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: Guided Visual Example + Tip + CTA */}
          <div className="lg:col-span-6 min-h-0 overflow-y-auto bg-[#111827] rounded-2xl border border-slate-800 p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-teal-400 mb-1">
                Exemplo Guiado — Como Funciona
              </div>
              <p className="text-xs text-slate-400 mb-2.5">
                Veja o personagem executando o movimento antes de treinar no aquecimento.
              </p>
              <InteractiveMechanicPreview action={stage.demoAction} mode="demo" />
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-[#0B101B] border border-slate-800 p-3.5">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-200 mb-0.5">Dica para dominar</div>
                <p className="text-xs text-slate-400 leading-relaxed">{stage.coachTip}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartWarmup}
              autoFocus
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors whitespace-nowrap shadow-sm cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Praticar no Aquecimento
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
