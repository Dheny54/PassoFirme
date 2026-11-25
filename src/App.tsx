import { useCallback, useEffect, useState } from 'react';
import { getStageById, STAGES } from './data/curriculum';
import { SaveData, StageCompletionPayload, StageMeta, UserSettings } from './types/game';
import { clearSave, loadSave, mergeStageResult, writeSave } from './utils/storage';
import { soundEngine } from './utils/audio';
import { CurriculumHub } from './components/CurriculumHub';
import { GameView } from './components/GameView';
import { ScreenTransition } from './components/ScreenTransition';

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [activeStageId, setActiveStageId] = useState<number | null>(null);

  useEffect(() => {
    soundEngine.setEnabled(save.settings.soundEnabled);
  }, [save.settings.soundEnabled]);

  const handleUpdateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSave((prev) =>
      writeSave({
        ...prev,
        settings: {
          ...prev.settings,
          ...patch,
        },
      })
    );
  }, []);

  const handleToggleSandbox = useCallback(() => {
    setSave((prev) =>
      writeSave({
        ...prev,
        unlockAllSandbox: !prev.unlockAllSandbox,
      })
    );
  }, []);

  const handleUpdatePlayerName = useCallback((name: string) => {
    setSave((prev) =>
      writeSave({
        ...prev,
        playerName: name,
      })
    );
  }, []);

  const handleStageComplete = useCallback((payload: StageCompletionPayload) => {
    const meta = getStageById(payload.stageId);
    setSave((prev) =>
      mergeStageResult(prev, payload.stageId, payload.elapsedSec, meta.parTimeSec, payload.accuracyPct)
    );
  }, []);

  const handleSelectStage = useCallback((stage: StageMeta) => {
    setActiveStageId(stage.id);
  }, []);

  const handleNextStage = useCallback(() => {
    setActiveStageId((curr) => {
      if (curr === null) return null;
      const next = STAGES.find((s) => s.id === curr + 1);
      return next ? next.id : null;
    });
  }, []);

  const handleResetSave = useCallback(() => {
    setSave(clearSave());
  }, []);

  if (activeStageId !== null) {
    const stage = getStageById(activeStageId);
    const hasNextStage = STAGES.some((s) => s.id === stage.id + 1);
    return (
      <GameView
        stage={stage}
        hasNextStage={hasNextStage}
        settings={save.settings}
        onUpdateSettings={handleUpdateSettings}
        onStageComplete={handleStageComplete}
        onNextStage={handleNextStage}
        onExitToHub={() => setActiveStageId(null)}
      />
    );
  }

  return (
    <ScreenTransition screenKey="app-hub">
      <CurriculumHub
        save={save}
        onSelectStage={handleSelectStage}
        onUpdateSettings={handleUpdateSettings}
        onToggleSandbox={handleToggleSandbox}
        onUpdatePlayerName={handleUpdatePlayerName}
        onReplaceSave={setSave}
        onResetSave={handleResetSave}
      />
    </ScreenTransition>
  );
}
