import { createContext, useCallback, useContext, useMemo } from 'react';
import { defaultExperiment, seedSavedExperiments } from '../data/presets';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { loadState, saveState } from '../utils/storage';
import { cloneGrid } from '../utils/grid';

const ExperimentContext = createContext(null);

function getInitialState() {
  return (
    loadState() ?? {
      currentExperiment: defaultExperiment,
      savedExperiments: seedSavedExperiments,
      runState: {
        status: 'idle',
        elapsedTime: 0,
      },
    }
  );
}

export function ExperimentProvider({ children }) {
  const [state, setState] = useLocalStorageState(getInitialState, saveState);

  const updateExperiment = useCallback((patch) => {
    setState((previous) => ({
      ...previous,
      currentExperiment: {
        ...previous.currentExperiment,
        ...patch,
      },
    }));
  }, [setState]);

  const setGrid = useCallback((grid) => {
    updateExperiment({ grid: cloneGrid(grid) });
  }, [updateExperiment]);

  const setMode = useCallback((mode) => {
    updateExperiment({ mode });
  }, [updateExperiment]);

  const saveCurrentExperiment = useCallback((name) => {
    setState((previous) => {
      const experiment = previous.currentExperiment;
      const newEntry = {
        ...experiment,
        id: `saved-${Date.now()}`,
        name: name || `${experiment.name} Copy`,
        savedAt: new Date().toISOString(),
      };
      return {
        ...previous,
        savedExperiments: [newEntry, ...previous.savedExperiments].slice(0, 12),
      };
    });
  }, [setState]);

  const loadSavedExperiment = useCallback((experimentId) => {
    setState((previous) => {
      const selected = previous.savedExperiments.find((item) => item.id === experimentId);
      if (!selected) return previous;
      return {
        ...previous,
        currentExperiment: {
          ...previous.currentExperiment,
          ...selected,
          grid: cloneGrid(selected.grid),
        },
      };
    });
  }, [setState]);

  const deleteSavedExperiment = useCallback((experimentId) => {
    setState((previous) => ({
      ...previous,
      savedExperiments: previous.savedExperiments.filter((item) => item.id !== experimentId),
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

  const value = useMemo(() => ({
    state,
    currentExperiment: state.currentExperiment,
    savedExperiments: state.savedExperiments,
    runState: state.runState,
    updateExperiment,
    setGrid,
    setMode,
    saveCurrentExperiment,
    loadSavedExperiment,
    deleteSavedExperiment,
    updateRunState,
  }), [state, updateExperiment, setGrid, setMode, saveCurrentExperiment, loadSavedExperiment, deleteSavedExperiment, updateRunState]);

  return <ExperimentContext.Provider value={value}>{children}</ExperimentContext.Provider>;
}

export function useExperiment() {
  const context = useContext(ExperimentContext);
  if (!context) {
    throw new Error('useExperiment must be used inside ExperimentProvider');
  }
  return context;
}
