import { createContext, useCallback, useContext, useMemo } from 'react';
import {
  cloneCalibration,
  cloneExperiment,
  defaultCalibration,
  defaultExperiment,
  seedSavedExperiments,
} from '../data/presets';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { loadState, saveState } from '../utils/storage';
import { cloneGrid } from '../utils/grid';

const ExperimentContext = createContext(null);

function getDefaults() {
  return {
    currentExperiment: cloneExperiment(defaultExperiment),
    savedExperiments: seedSavedExperiments.map(cloneExperiment),
    calibration: cloneCalibration(defaultCalibration),
    history: {
      past: [],
      future: [],
    },
    runState: {
      status: 'idle',
      elapsedTime: 0,
    },
  };
}

const UIUC_WAVE_NOTES = 'Sine-wave track over active nodes spelling UIUC.';
const LEGACY_DEMO_NOTES = 'Browser-only heatmap preview pattern for recording UI demos.';

function refreshStoredSeedExperiment(experiment) {
  const cloned = cloneExperiment(experiment);

  if (
    cloned.name === 'UIUC Wave' &&
    cloned.notes === UIUC_WAVE_NOTES &&
    (cloned.id === 'current-experiment' || cloned.id === 'saved-uiuc-wave')
  ) {
    const seed = cloned.id === 'saved-uiuc-wave'
      ? seedSavedExperiments.find((item) => item.id === 'saved-uiuc-wave') ?? defaultExperiment
      : defaultExperiment;

    return cloneExperiment({
      ...seed,
      id: cloned.id,
      savedAt: cloned.savedAt ?? seed.savedAt,
    });
  }

  if (cloned.id === 'current-experiment' && cloned.name === 'Device-Free Heatmap Demo' && cloned.notes === LEGACY_DEMO_NOTES) {
    return cloneExperiment(defaultExperiment);
  }

  return cloned;
}

function mergeSeedSavedExperiments(storedSavedExperiments = []) {
  const refreshedStoredExperiments = storedSavedExperiments.map(refreshStoredSeedExperiment);
  const storedById = new Set(refreshedStoredExperiments.map((experiment) => experiment.id));
  return [
    ...seedSavedExperiments
      .filter((experiment) => !storedById.has(experiment.id))
      .map(cloneExperiment),
    ...refreshedStoredExperiments,
  ].slice(0, 16);
}

function isLegacyBlankExperiment(experiment) {
  return (
    experiment?.name === 'Baseline Flat' &&
    (experiment.motionTracks ?? []).length === 0 &&
    (experiment.grid ?? []).flat().every((value) => Number(value) === 0)
  );
}

function getInitialState() {
  const defaults = getDefaults();
  const stored = loadState();

  if (!stored) {
    return defaults;
  }

  return {
    ...defaults,
    ...stored,
    currentExperiment: cloneExperiment(
      isLegacyBlankExperiment(stored.currentExperiment)
        ? defaults.currentExperiment
        : refreshStoredSeedExperiment(stored.currentExperiment ?? defaults.currentExperiment),
    ),
    savedExperiments: stored.savedExperiments
      ? mergeSeedSavedExperiments(stored.savedExperiments)
      : defaults.savedExperiments,
    calibration: cloneCalibration(stored.calibration ?? defaults.calibration),
    history: {
      past: (stored.history?.past ?? []).map(cloneExperiment),
      future: (stored.history?.future ?? []).map(cloneExperiment),
    },
    runState: {
      ...defaults.runState,
      ...stored.runState,
    },
  };
}

export function ExperimentProvider({ children }) {
  const [state, setState] = useLocalStorageState(getInitialState, saveState);

  const withExperimentHistory = useCallback((previous, nextExperiment) => ({
    ...previous,
    currentExperiment: cloneExperiment(nextExperiment),
    history: {
      past: [...previous.history.past, cloneExperiment(previous.currentExperiment)].slice(-100),
      future: [],
    },
  }), []);

  const updateExperiment = useCallback((patch) => {
    setState((previous) =>
      withExperimentHistory(previous, {
        ...previous.currentExperiment,
        ...patch,
        grid: patch.grid ?? previous.currentExperiment.grid,
        motionTracks: patch.motionTracks ?? previous.currentExperiment.motionTracks,
      }),
    );
  }, [setState, withExperimentHistory]);

  const replaceExperiment = useCallback((patch) => {
    setState((previous) => ({
      ...previous,
      currentExperiment: cloneExperiment({
        ...previous.currentExperiment,
        ...patch,
        grid: patch.grid ?? previous.currentExperiment.grid,
        motionTracks: patch.motionTracks ?? previous.currentExperiment.motionTracks,
      }),
    }));
  }, [setState]);

  const setGrid = useCallback((grid) => {
    updateExperiment({ grid: cloneGrid(grid) });
  }, [updateExperiment]);

  const saveCurrentExperiment = useCallback((name) => {
    setState((previous) => {
      const experiment = cloneExperiment(previous.currentExperiment);
      const existingIndex = previous.savedExperiments.findIndex((item) => item.id === experiment.id);
      const baseName = name?.trim() || experiment.name || 'Saved Experiment';

      if (existingIndex >= 0) {
        const updatedEntry = {
          ...experiment,
          name: baseName,
          savedAt: new Date().toISOString(),
        };

        const nextSaved = [...previous.savedExperiments];
        nextSaved[existingIndex] = updatedEntry;

        return {
          ...previous,
          currentExperiment: cloneExperiment(updatedEntry),
          savedExperiments: nextSaved,
        };
      }

      const newEntry = {
        ...experiment,
        id: `saved-${Date.now()}`,
        name: baseName,
        savedAt: new Date().toISOString(),
      };
      return {
        ...previous,
        currentExperiment: cloneExperiment(newEntry),
        savedExperiments: [newEntry, ...previous.savedExperiments].slice(0, 16),
      };
    });
  }, [setState]);

  const loadSavedExperiment = useCallback((experimentId) => {
    setState((previous) => {
      const selected = previous.savedExperiments.find((item) => item.id === experimentId);
      if (!selected) return previous;
      return withExperimentHistory(previous, selected);
    });
  }, [setState, withExperimentHistory]);

  const deleteSavedExperiment = useCallback((experimentId) => {
    setState((previous) => ({
      ...previous,
      savedExperiments: previous.savedExperiments.filter((item) => item.id !== experimentId),
    }));
  }, [setState]);

  const updateCalibration = useCallback((patch) => {
    setState((previous) => ({
      ...previous,
      calibration: cloneCalibration({
        ...previous.calibration,
        ...patch,
        offsetGrid: patch.offsetGrid ?? previous.calibration.offsetGrid,
      }),
    }));
  }, [setState]);

  const updateRunState = useCallback((patch) => {
    setState((previous) => ({
      ...previous,
      runState: {
        ...previous.runState,
        ...patch,
      },
    }));
  }, [setState]);

  const undoExperiment = useCallback(() => {
    setState((previous) => {
      const last = previous.history.past.at(-1);
      if (!last) return previous;
      return {
        ...previous,
        currentExperiment: cloneExperiment(last),
        history: {
          past: previous.history.past.slice(0, -1),
          future: [cloneExperiment(previous.currentExperiment), ...previous.history.future].slice(0, 100),
        },
      };
    });
  }, [setState]);

  const redoExperiment = useCallback(() => {
    setState((previous) => {
      const next = previous.history.future[0];
      if (!next) return previous;
      return {
        ...previous,
        currentExperiment: cloneExperiment(next),
        history: {
          past: [...previous.history.past, cloneExperiment(previous.currentExperiment)].slice(-100),
          future: previous.history.future.slice(1),
        },
      };
    });
  }, [setState]);

  const recordHistorySnapshot = useCallback((experimentSnapshot) => {
    setState((previous) => ({
      ...previous,
      history: {
        past: [...previous.history.past, cloneExperiment(experimentSnapshot)].slice(-100),
        future: [],
      },
    }));
  }, [setState]);

  const value = useMemo(() => ({
    currentExperiment: state.currentExperiment,
    savedExperiments: state.savedExperiments,
    calibration: state.calibration,
    runState: state.runState,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    updateExperiment,
    replaceExperiment,
    setGrid,
    saveCurrentExperiment,
    loadSavedExperiment,
    deleteSavedExperiment,
    updateCalibration,
    updateRunState,
    undoExperiment,
    redoExperiment,
    recordHistorySnapshot,
  }), [
    state,
    updateExperiment,
    replaceExperiment,
    setGrid,
    saveCurrentExperiment,
    loadSavedExperiment,
    deleteSavedExperiment,
    updateCalibration,
    updateRunState,
    undoExperiment,
    redoExperiment,
    recordHistorySnapshot,
  ]);

  return <ExperimentContext.Provider value={value}>{children}</ExperimentContext.Provider>;
}

export function useExperiment() {
  const context = useContext(ExperimentContext);
  if (!context) {
    throw new Error('useExperiment must be used inside ExperimentProvider');
  }
  return context;
}
