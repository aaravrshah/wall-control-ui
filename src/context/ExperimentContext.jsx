import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  buildGridServoCommands,
  DEFAULT_CHANNEL_COUNT,
  DEFAULT_SERIAL_BAUD_RATE,
} from '../utils/hardware';

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

function getInitialState() {
  const defaults = getDefaults();
  const stored = loadState();

  if (!stored) {
    return defaults;
  }

  return {
    ...defaults,
    ...stored,
    currentExperiment: cloneExperiment(stored.currentExperiment ?? defaults.currentExperiment),
    savedExperiments: (stored.savedExperiments ?? defaults.savedExperiments).map(cloneExperiment),
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
  const [hardwareState, setHardwareState] = useState({
    supported: typeof navigator !== 'undefined' && 'serial' in navigator,
    status: 'disconnected',
    error: '',
    lastCommandAt: null,
    lastCommandSummary: 'No commands sent yet.',
    config: {
      baudRate: DEFAULT_SERIAL_BAUD_RATE,
      cellStartIndex: 0,
      channelStart: 0,
      channelCount: DEFAULT_CHANNEL_COUNT,
    },
  });
  const portRef = useRef(null);
  const writerRef = useRef(null);

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

  const disconnectHardware = useCallback(async () => {
    const writer = writerRef.current;
    const port = portRef.current;

    try {
      if (writer) {
        await writer.close();
        writer.releaseLock();
      }
    } catch (error) {
      console.warn('Unable to close serial writer cleanly.', error);
    }

    try {
      if (port) {
        await port.close();
      }
    } catch (error) {
      console.warn('Unable to close serial port cleanly.', error);
    }

    writerRef.current = null;
    portRef.current = null;
    setHardwareState((previous) => ({
      ...previous,
      status: 'disconnected',
      error: '',
    }));
  }, []);

  const connectHardware = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      setHardwareState((previous) => ({
        ...previous,
        supported: false,
        status: 'error',
        error: 'Web Serial is not available in this browser. Use a Chromium-based browser on localhost or HTTPS.',
      }));
      return false;
    }

    setHardwareState((previous) => ({
      ...previous,
      supported: true,
      status: 'connecting',
      error: '',
    }));

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: hardwareState.config.baudRate });
      const writer = port.writable.getWriter();
      await new Promise((resolve) => window.setTimeout(resolve, 2000));

      portRef.current = port;
      writerRef.current = writer;

      setHardwareState((previous) => ({
        ...previous,
        status: 'connected',
        error: '',
        lastCommandSummary: `Connected at ${previous.config.baudRate} baud.`,
      }));
      return true;
    } catch (error) {
      writerRef.current = null;
      portRef.current = null;
      setHardwareState((previous) => ({
        ...previous,
        status: 'error',
        error: error?.message || 'Unable to connect to the serial device.',
      }));
      return false;
    }
  }, [hardwareState.config.baudRate]);

  const updateHardwareConfig = useCallback((patch) => {
    setHardwareState((previous) => ({
      ...previous,
      config: {
        ...previous.config,
        ...patch,
      },
    }));
  }, []);

  const sendRawCommand = useCallback(async (command, summary) => {
    const writer = writerRef.current;
    if (!writer) {
      setHardwareState((previous) => ({
        ...previous,
        status: previous.supported ? 'disconnected' : previous.status,
        error: 'No serial connection is active.',
      }));
      return false;
    }

    try {
      await writer.write(new TextEncoder().encode(command));
      setHardwareState((previous) => ({
        ...previous,
        status: 'connected',
        error: '',
        lastCommandAt: new Date().toISOString(),
        lastCommandSummary: summary,
      }));
      return true;
    } catch (error) {
      setHardwareState((previous) => ({
        ...previous,
        status: 'error',
        error: error?.message || 'Unable to write to the serial device.',
      }));
      return false;
    }
  }, []);

  const sendServoCommand = useCallback(async (channel, angle) => {
    const safeChannel = Math.max(0, Number(channel) || 0);
    const safeAngle = Math.max(0, Math.min(180, Math.round(Number(angle) || 0)));
    return sendRawCommand(
      `${safeChannel}:${safeAngle}\n`,
      `Sent channel ${safeChannel} to ${safeAngle} degrees.`,
    );
  }, [sendRawCommand]);

  const sendGridToHardware = useCallback(async (grid, options = {}) => {
    const commands = buildGridServoCommands(grid, {
      offsetGrid: options.offsetGrid ?? state.calibration.offsetGrid,
      maxDisplacementMm: options.maxDisplacementMm ?? state.currentExperiment.maxDisplacementMm,
      cellStartIndex: options.cellStartIndex ?? hardwareState.config.cellStartIndex,
      channelStart: options.channelStart ?? hardwareState.config.channelStart,
      channelCount: options.channelCount ?? hardwareState.config.channelCount,
    });

    if (commands.length === 0) {
      return false;
    }

    for (const command of commands) {
      const sent = await sendServoCommand(command.channel, command.angle);
      if (!sent) {
        return false;
      }
    }

    setHardwareState((previous) => ({
      ...previous,
      lastCommandSummary: `Sent ${commands.length} actuator commands (${commands[0].label} to ${commands.at(-1).label}).`,
    }));

    return true;
  }, [hardwareState.config.cellStartIndex, hardwareState.config.channelCount, hardwareState.config.channelStart, sendServoCommand, state.calibration.offsetGrid, state.currentExperiment.maxDisplacementMm]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      return undefined;
    }

    const handleDisconnect = (event) => {
      if (event.target !== portRef.current) {
        return;
      }

      writerRef.current = null;
      portRef.current = null;
      setHardwareState((previous) => ({
        ...previous,
        status: 'disconnected',
        error: 'The serial device was disconnected.',
      }));
    };

    navigator.serial.addEventListener('disconnect', handleDisconnect);
    return () => navigator.serial.removeEventListener('disconnect', handleDisconnect);
  }, []);

  useEffect(() => () => {
    if (writerRef.current || portRef.current) {
      disconnectHardware();
    }
  }, [disconnectHardware]);

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
    hardwareState,
    updateHardwareConfig,
    connectHardware,
    disconnectHardware,
    sendServoCommand,
    sendGridToHardware,
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
    hardwareState,
    updateHardwareConfig,
    connectHardware,
    disconnectHardware,
    sendServoCommand,
    sendGridToHardware,
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
