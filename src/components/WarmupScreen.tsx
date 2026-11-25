import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, FastForward, Play } from 'lucide-react';
import { LiveInputState, StageMeta } from '../types/game';
import { InteractiveMechanicPreview } from './InteractiveMechanicPreview';
import { KeyboardMouseHandDiagram } from './KeyboardMouseHandDiagram';

interface WarmupScreenProps {
  stage: StageMeta;
  onComplete: () => void;
  onBackToBriefing: () => void;
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

export const WarmupScreen: React.FC<WarmupScreenProps> = ({
  stage,
  onComplete,
  onBackToBriefing,
}) => {
  const prompts = stage.warmupPrompts;
  const [stepIdx, setStepIdx] = useState(0);
  const [stepConfirmed, setStepConfirmed] = useState(false);
  const [liveInput, setLiveInput] = useState<LiveInputState>(EMPTY_INPUT);

  const current = prompts[stepIdx];

  useEffect(() => {
    setStepIdx(0);
    setStepConfirmed(false);
    setLiveInput(EMPTY_INPUT);
  }, [stage.id]);

  const handleStepSuccess = useCallback(() => {
    setStepConfirmed(true);
    window.setTimeout(() => {
      if (stepIdx + 1 < prompts.length) {
        setStepConfirmed(false);
        setStepIdx((i) => i + 1);
      } else {
        onComplete();
      }
    }, 650);
  }, [stepIdx, prompts.length, onComplete]);

  if (!current) {
    return null;
  }

  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#090D16] text-slate-100 flex flex-col">
      <header className="shrink-0 border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={onBackToBriefing}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Exemplo
          </button>

          <div className="text-xs font-medium text-slate-400 whitespace-nowrap truncate">
            Etapa 2 de 3 · Aquecimento Prático · Passo {stepIdx + 1} de {prompts.length}
          </div>

          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5" />
            Ir direto à Fase
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden px-6 py-4 flex items-center justify-center">
        <div className="w-full max-w-5xl max-h-full rounded-2xl bg-[#111827] border border-slate-800 p-5 sm:p-6 flex flex-col gap-4 overflow-hidden">
          {/* Progress Bars */}
          <div className="shrink-0 flex items-center gap-2">
            {prompts.map((p, idx) => (
              <div
                key={`${p.control}-${idx}`}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  idx < stepIdx
                    ? 'bg-teal-400'
                    : idx === stepIdx
                      ? 'bg-amber-400'
                      : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div className="lg:col-span-6 min-h-0 max-h-full overflow-y-auto pr-1 space-y-3">
              <div className="text-xs font-semibold text-teal-400">
                Experimente agora — veja seus dedos e a tecla em destaque
              </div>

              <h2 className="font-display text-2xl font-bold text-white">
                {current.actionTitle}
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed">
                {current.worldExplanation}
              </p>

              <KeyboardMouseHandDiagram
                activeControls={stage.activeControls}
                focusControl={current.control}
                liveInput={liveInput}
                compact
              />

              {stepConfirmed ? (
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-teal-400">
                  <Check className="w-4 h-4" />
                  Movimento executado! Avançando...
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Pressione <strong className="text-amber-300">{current.keyLabel}</strong> ({current.fingerLabel}) e veja o personagem agir ao lado.
                </p>
              )}
            </div>

            <div className="lg:col-span-6 space-y-2.5">
              <InteractiveMechanicPreview
                action={current.previewAction}
                mode="interactive"
                targetControl={current.control}
                onInteractiveSuccess={handleStepSuccess}
                onLiveInputChange={setLiveInput}
              />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Mini-arena de familiaridade ao vivo</span>
                <button
                  type="button"
                  onClick={onComplete}
                  className="inline-flex items-center gap-1 font-semibold text-teal-400 hover:text-teal-300 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Já sei, começar fase
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
