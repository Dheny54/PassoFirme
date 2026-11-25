import React from 'react';
import { KeyControlId, LiveInputState } from '../types/game';

interface KeyboardMouseHandDiagramProps {
  activeControls: KeyControlId[];
  focusControl?: KeyControlId;
  liveInput?: LiveInputState;
  compact?: boolean;
}

const FINGER_COLORS = {
  pinky: '#38BDF8',   // Sky - Shift / Ctrl
  ring: '#2DD4BF',    // Teal - A
  middle: '#34D399',  // Emerald - W / S
  index: '#FBBF24',   // Amber - D / C / F
  thumb: '#A78BFA',   // Violet - Space
};

export const KeyboardMouseHandDiagram: React.FC<KeyboardMouseHandDiagramProps> = ({
  activeControls,
  focusControl,
  liveInput,
  compact = false,
}) => {
  const has = (id: KeyControlId) => activeControls.includes(id);
  const needsMouse = has('MOUSE_AIM') || has('MOUSE_CLICK') || has('F');

  const isPressed = (key: 'W' | 'A' | 'S' | 'D' | 'SHIFT' | 'CTRL' | 'SPACE' | 'F' | 'MOUSE_CLICK' | 'MOUSE_RIGHT') => {
    if (!liveInput) return false;
    switch (key) {
      case 'W': return liveInput.w;
      case 'A': return liveInput.a;
      case 'S': return liveInput.s;
      case 'D': return liveInput.d;
      case 'SHIFT': return liveInput.shift;
      case 'CTRL': return liveInput.ctrl;
      case 'SPACE': return liveInput.space;
      case 'F': return Boolean(liveInput.f);
      case 'MOUSE_CLICK': return liveInput.mouseDown;
      case 'MOUSE_RIGHT': return Boolean(liveInput.rightMouseDown);
    }
  };

  const keyStyle = (id: KeyControlId, pressed: boolean) => {
    const isFocused = focusControl === id;
    const isEnabled = has(id);

    if (pressed) {
      return id === 'F'
        ? 'bg-violet-400 text-slate-950 border-violet-200 translate-y-[1px] shadow-[0_0_12px_rgba(167,139,250,0.55)]'
        : 'bg-teal-400 text-slate-950 border-teal-200 translate-y-[1px] shadow-[0_0_12px_rgba(45,212,191,0.55)]';
    }
    if (isFocused) {
      return 'bg-amber-400/20 text-amber-200 border-amber-400 ring-2 ring-amber-400/40';
    }
    if (isEnabled) {
      return id === 'F'
        ? 'bg-slate-800/95 text-violet-200 border-violet-400/70'
        : 'bg-slate-800/95 text-white border-teal-400/70';
    }
    return 'bg-slate-900/50 text-slate-600 border-slate-800/70 opacity-50';
  };

  const actionTag = (id: KeyControlId, text: string) => {
    if (!has(id) && focusControl !== id) return null;
    return (
      <span className="block text-[9px] leading-none font-sans font-semibold tracking-tight opacity-90 mt-0.5 truncate">
        {text}
      </span>
    );
  };

  const fingerTipGlow = (active: boolean, pressed: boolean, color: string) => {
    if (pressed) return { fill: color, opacity: 0.95, r: 7.5 };
    if (active) return { fill: color, opacity: 0.78, r: 6.5 };
    return { fill: '#475569', opacity: 0.35, r: 4.5 };
  };

  const pinkyTip = fingerTipGlow(has('SHIFT') || has('CTRL') || focusControl === 'SHIFT' || focusControl === 'CTRL', isPressed('SHIFT') || isPressed('CTRL'), FINGER_COLORS.pinky);
  const ringTip = fingerTipGlow(has('A') || focusControl === 'A', isPressed('A'), FINGER_COLORS.ring);
  const middleTip = fingerTipGlow(has('W') || has('S') || focusControl === 'W' || focusControl === 'S', isPressed('W') || isPressed('S'), FINGER_COLORS.middle);
  const indexTip = fingerTipGlow(has('D') || has('CTRL') || has('F') || focusControl === 'D' || focusControl === 'CTRL' || focusControl === 'F', isPressed('D') || isPressed('F'), FINGER_COLORS.index);
  const thumbTip = fingerTipGlow(has('SPACE') || focusControl === 'SPACE', isPressed('SPACE'), FINGER_COLORS.thumb);

  return (
    <div className={`rounded-xl bg-[#0B101B] border border-slate-800 ${compact ? 'p-3' : 'p-4'} select-none`}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* LEFT HAND + QWERTY CLUSTER */}
        <div className="relative flex flex-col items-start">
          <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-2">
            <span>Mão Esquerda no Teclado</span>
            {has('CTRL') && (
              <span className="text-[10px] text-amber-300 font-normal">
                (Dica: use <strong className="font-mono">C</strong> para agachar/deslizar sem atalhos!)
              </span>
            )}
          </div>

          <div className="relative p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90">
            {/* Row 1: Q W E R */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-11 h-10 rounded-md border border-slate-800/60 bg-slate-900/40 text-slate-600 text-[10px] font-mono flex items-center justify-center">
                Tab
              </div>
              <div className="w-10 h-10 rounded-md border border-slate-800/60 bg-slate-900/40 text-slate-600 text-xs font-mono flex items-center justify-center">
                Q
              </div>
              <div className={`w-12 h-10 rounded-md border font-mono text-xs font-bold flex flex-col items-center justify-center transition-all ${keyStyle('W', isPressed('W'))}`}>
                <span>W</span>
                {actionTag('W', 'Frente')}
              </div>
              <div className="w-10 h-10 rounded-md border border-slate-800/60 bg-slate-900/40 text-slate-600 text-xs font-mono flex items-center justify-center">
                E
              </div>
              <div className="w-10 h-10 rounded-md border border-slate-800/60 bg-slate-900/40 text-slate-600 text-xs font-mono flex items-center justify-center">
                R
              </div>
            </div>

            {/* Row 2: Caps A S D F */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-13 h-10 rounded-md border border-slate-800/60 bg-slate-900/40 text-slate-600 text-[10px] font-mono flex items-center justify-center">
                Caps
              </div>
              <div className={`w-12 h-10 rounded-md border font-mono text-xs font-bold flex flex-col items-center justify-center transition-all ${keyStyle('A', isPressed('A'))}`}>
                <span>A</span>
                {actionTag('A', 'Esq.')}
              </div>
              <div className={`w-12 h-10 rounded-md border font-mono text-xs font-bold flex flex-col items-center justify-center transition-all ${keyStyle('S', isPressed('S'))}`}>
                <span>S</span>
                {actionTag('S', 'Trás')}
              </div>
              <div className={`w-12 h-10 rounded-md border font-mono text-xs font-bold flex flex-col items-center justify-center transition-all ${keyStyle('D', isPressed('D'))}`}>
                <span>D</span>
                {actionTag('D', 'Dir.')}
              </div>
              <div className={`w-11 h-10 rounded-md border font-mono text-xs font-bold flex flex-col items-center justify-center transition-all ${keyStyle('F', isPressed('F'))}`}>
                <span>F</span>
                {actionTag('F', 'Golpe')}
              </div>
            </div>

            {/* Row 3: Shift Z X C */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className={`w-16 h-10 rounded-md border font-mono text-[11px] font-bold flex flex-col items-center justify-center transition-all ${keyStyle('SHIFT', isPressed('SHIFT'))}`}>
                <span>Shift</span>
                {actionTag('SHIFT', 'Correr')}
              </div>
              <div className="w-10 h-10 rounded-md border border-slate-800/60 bg-slate-900/40 text-slate-600 text-xs font-mono flex items-center justify-center">
                Z
              </div>
              <div className="w-10 h-10 rounded-md border border-slate-800/60 bg-slate-900/40 text-slate-600 text-xs font-mono flex items-center justify-center">
                X
              </div>
              <div className={`w-12 h-10 rounded-md border font-mono text-xs font-bold flex flex-col items-center justify-center transition-all ${keyStyle('CTRL', isPressed('CTRL'))}`}>
                <span>C</span>
                {actionTag('CTRL', has('SHIFT') ? 'Agac/Sl' : 'Agachar')}
              </div>
            </div>

            {/* Row 4: Ctrl + Space */}
            <div className="flex items-center gap-1.5">
              <div className={`w-14 h-9 rounded-md border font-mono text-[10px] font-bold flex flex-col items-center justify-center transition-all ${keyStyle('CTRL', isPressed('CTRL'))}`}>
                <span>Ctrl</span>
                {actionTag('CTRL', 'Agachar')}
              </div>
              <div className="w-9 h-9 rounded-md border border-slate-800/60 bg-slate-900/40 text-slate-600 text-[10px] font-mono flex items-center justify-center">
                Alt
              </div>
              <div className={`flex-1 h-9 rounded-md border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${keyStyle('SPACE', isPressed('SPACE'))}`}>
                <span>Espaço</span>
                {(has('SPACE') || focusControl === 'SPACE') && (
                  <span className="text-[10px] font-sans font-semibold opacity-90">· Pular</span>
                )}
              </div>
            </div>

            {/* Translucent Left Hand Finger Placement SVG Overlay */}
            <svg
              viewBox="0 0 265 182"
              className="pointer-events-none absolute inset-0 w-full h-full"
              aria-hidden="true"
            >
              <path
                d="M 78 164 C 66 142, 72 114, 96 106 L 160 104 C 186 108, 198 134, 186 164 Z"
                fill="rgba(148, 163, 184, 0.10)"
                stroke="rgba(148, 163, 184, 0.25)"
                strokeWidth="1.4"
              />
              <line x1="84" y1="130" x2="36" y2="112" stroke={FINGER_COLORS.pinky} strokeWidth="3.5" strokeLinecap="round" strokeOpacity={pinkyTip.opacity} />
              <line x1="102" y1="112" x2="88" y2="74" stroke={FINGER_COLORS.ring} strokeWidth="3.5" strokeLinecap="round" strokeOpacity={ringTip.opacity} />
              <line x1="126" y1="106" x2="128" y2="34" stroke={FINGER_COLORS.middle} strokeWidth="3.5" strokeLinecap="round" strokeOpacity={middleTip.opacity} />
              <line x1="152" y1="108" x2="178" y2="74" stroke={FINGER_COLORS.index} strokeWidth="3.5" strokeLinecap="round" strokeOpacity={indexTip.opacity} />
              <line x1="184" y1="138" x2="212" y2="156" stroke={FINGER_COLORS.thumb} strokeWidth="4" strokeLinecap="round" strokeOpacity={thumbTip.opacity} />

              <circle cx="36" cy="112" r={pinkyTip.r} fill={pinkyTip.fill} fillOpacity={pinkyTip.opacity} />
              <circle cx="88" cy="74" r={ringTip.r} fill={ringTip.fill} fillOpacity={ringTip.opacity} />
              <circle cx="128" cy="34" r={middleTip.r} fill={middleTip.fill} fillOpacity={middleTip.opacity} />
              <circle cx="178" cy="74" r={indexTip.r} fill={indexTip.fill} fillOpacity={indexTip.opacity} />
              <circle cx="212" cy="156" r={thumbTip.r} fill={thumbTip.fill} fillOpacity={thumbTip.opacity} />
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-300">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FINGER_COLORS.pinky }} />
              Mindinho: Shift/Ctrl
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FINGER_COLORS.ring }} />
              Anelar: A
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FINGER_COLORS.middle }} />
              Médio: W/S
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FINGER_COLORS.index }} />
              Indicador: D/C/F
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FINGER_COLORS.thumb }} />
              Polegar: Espaço
            </span>
          </div>
        </div>

        {/* RIGHT HAND + GAMING MOUSE */}
        <div
          className={`flex flex-col items-center justify-center rounded-xl border p-3 min-w-[162px] transition-opacity ${
            needsMouse
              ? 'bg-slate-950/90 border-slate-800/90 opacity-100'
              : 'bg-slate-950/40 border-slate-800/50 opacity-45'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-400 mb-2">
            Mão Direita no Mouse
          </div>

          <svg viewBox="0 0 120 138" className="w-28 h-32" aria-hidden="true">
            <rect
              x="24"
              y="10"
              width="72"
              height="106"
              rx="34"
              fill="#0F172A"
              stroke={needsMouse ? '#38BDF8' : '#334155'}
              strokeWidth="2.5"
            />
            {/* Left Click Button */}
            <path
              d="M 25 46 L 25 42 C 25 22, 40 11, 59 11 L 59 54 L 25 54 Z"
              fill={
                isPressed('MOUSE_CLICK')
                  ? '#FBBF24'
                  : has('MOUSE_CLICK') || focusControl === 'MOUSE_CLICK'
                    ? 'rgba(251, 191, 36, 0.28)'
                    : 'rgba(30, 41, 59, 0.5)'
              }
              stroke="#334155"
              strokeWidth="1.5"
            />
            {/* Right Click Button */}
            <path
              d="M 61 11 C 80 11, 95 22, 95 42 L 95 54 L 61 54 Z"
              fill={
                isPressed('MOUSE_RIGHT')
                  ? '#A78BFA'
                  : has('F') || focusControl === 'F'
                    ? 'rgba(167, 139, 250, 0.28)'
                    : 'rgba(30, 41, 59, 0.4)'
              }
              stroke="#334155"
              strokeWidth="1.5"
            />
            <rect x="55" y="23" width="10" height="20" rx="5" fill="#38BDF8" fillOpacity={needsMouse ? 0.85 : 0.3} />

            {/* Right Hand Finger Dots */}
            <circle
              cx="42"
              cy="34"
              r={has('MOUSE_CLICK') || focusControl === 'MOUSE_CLICK' ? 6.5 : 4.5}
              fill={has('MOUSE_CLICK') || focusControl === 'MOUSE_CLICK' ? '#FBBF24' : '#64748B'}
              fillOpacity={0.9}
            />
            <circle
              cx="78"
              cy="34"
              r={has('F') || focusControl === 'F' ? 6.5 : 4.5}
              fill={has('F') || focusControl === 'F' ? '#A78BFA' : '#64748B'}
              fillOpacity={has('F') || focusControl === 'F' ? 0.92 : 0.45}
            />

            {(has('MOUSE_AIM') || focusControl === 'MOUSE_AIM') && (
              <>
                <path d="M 10 68 L 18 63 L 18 73 Z" fill="#2DD4BF" />
                <path d="M 110 68 L 102 63 L 102 73 Z" fill="#2DD4BF" />
              </>
            )}
          </svg>

          <div className="text-center space-y-0.5 text-[10px] mt-1">
            {needsMouse ? (
              <>
                {has('MOUSE_AIM') && (
                  <div className="text-teal-300 font-semibold">Mover: Mirar / Câmera</div>
                )}
                {has('MOUSE_CLICK') && (
                  <div className="text-amber-300 font-semibold">Esq.: Disparar Energia</div>
                )}
                {has('F') && (
                  <div className="text-violet-300 font-semibold">Dir. (ou F): Golpe Lâmina</div>
                )}
              </>
            ) : (
              <div className="text-slate-500">Mouse não usado nesta fase</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
