import React from 'react';
import { KeyControlId, LiveInputState } from '../types/game';

interface InputHUDProps {
  input: LiveInputState;
  activeControls: KeyControlId[];
  visible: boolean;
}

export const InputHUD: React.FC<InputHUDProps> = ({ input, activeControls, visible }) => {
  if (!visible) return null;

  const isEnabled = (id: KeyControlId) => activeControls.includes(id);

  const keyClass = (pressed: boolean, enabled: boolean, accent: 'teal' | 'violet' = 'teal') => {
    if (!enabled) {
      return 'bg-slate-900/45 text-slate-600 border-slate-800/60';
    }
    if (pressed) {
      return accent === 'violet'
        ? 'bg-violet-400 text-slate-950 border-violet-200 translate-y-[1px] font-bold'
        : 'bg-teal-400 text-slate-950 border-teal-200 translate-y-[1px] font-bold';
    }
    return 'bg-slate-900/90 text-slate-100 border-slate-600/80';
  };

  return (
    <div
      className="pointer-events-none select-none flex items-end gap-2.5 p-2.5 rounded-xl bg-slate-950/88 border border-slate-700/70 text-[11px] font-mono shadow-lg"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-3 gap-1 ml-11">
          <div />
          <div
            className={`w-8 h-8 rounded-md border flex items-center justify-center transition-transform duration-75 ${keyClass(
              input.w,
              isEnabled('W')
            )}`}
          >
            W
          </div>
          <div />
        </div>

        <div className="flex items-center gap-1">
          <div
            className={`w-10 h-8 rounded-md border flex items-center justify-center text-[10px] transition-transform duration-75 ${keyClass(
              input.shift,
              isEnabled('SHIFT')
            )}`}
          >
            Shift
          </div>
          <div
            className={`w-8 h-8 rounded-md border flex items-center justify-center transition-transform duration-75 ${keyClass(
              input.a,
              isEnabled('A')
            )}`}
          >
            A
          </div>
          <div
            className={`w-8 h-8 rounded-md border flex items-center justify-center transition-transform duration-75 ${keyClass(
              input.s,
              isEnabled('S')
            )}`}
          >
            S
          </div>
          <div
            className={`w-8 h-8 rounded-md border flex items-center justify-center transition-transform duration-75 ${keyClass(
              input.d,
              isEnabled('D')
            )}`}
          >
            D
          </div>
          {isEnabled('F') && (
            <div
              className={`w-8 h-8 rounded-md border flex flex-col items-center justify-center leading-none transition-transform duration-75 ${keyClass(
                Boolean(input.f),
                true,
                'violet'
              )}`}
            >
              <span>F</span>
              <span className="text-[7px] font-sans opacity-85">Golpe</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <div
            className={`w-12 h-6 rounded-md border flex items-center justify-center text-[9px] transition-transform duration-75 ${keyClass(
              input.ctrl,
              isEnabled('CTRL')
            )}`}
          >
            C/Ctrl
          </div>
          <div
            className={`w-[96px] h-6 rounded-md border flex items-center justify-center text-[10px] transition-transform duration-75 ${keyClass(
              input.space,
              isEnabled('SPACE')
            )}`}
          >
            Espaço
          </div>
        </div>
      </div>

      {(isEnabled('MOUSE_AIM') || isEnabled('MOUSE_CLICK') || isEnabled('F')) && (
        <div className="flex flex-col items-center gap-1 pl-2 border-l border-slate-700/70">
          <div className="w-9 h-12 rounded-t-xl rounded-b-lg border border-slate-600/80 bg-slate-900/90 flex overflow-hidden">
            <div
              className={`w-1/2 h-6 border-b border-r border-slate-700/80 transition-colors duration-75 ${
                input.mouseDown && isEnabled('MOUSE_CLICK')
                  ? 'bg-amber-400'
                  : isEnabled('MOUSE_CLICK')
                    ? 'bg-slate-800'
                    : 'bg-slate-900'
              }`}
            />
            <div
              className={`w-1/2 h-6 border-b border-slate-700/80 transition-colors duration-75 ${
                input.rightMouseDown && isEnabled('F')
                  ? 'bg-violet-400'
                  : isEnabled('F')
                    ? 'bg-slate-800'
                    : 'bg-slate-900'
              }`}
            />
          </div>
          <span className="text-[9px] text-slate-300 whitespace-nowrap">
            {isEnabled('MOUSE_CLICK') && isEnabled('F')
              ? 'Tiro | Golpe'
              : isEnabled('F')
                ? 'Dir.: Golpe'
                : isEnabled('MOUSE_CLICK')
                  ? 'Esq.: Atirar'
                  : 'Mirar'}
          </span>
        </div>
      )}
    </div>
  );
};
