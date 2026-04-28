import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ExperimentManagerModal from '../components/ExperimentManagerModal';
import ExperimentPreview from '../components/ExperimentPreview';
import { useExperiment } from '../context/ExperimentContext';
import { DEFAULT_FRAME_INTERVAL_MS } from '../utils/hardware';
import { applyMotionTracks } from '../utils/patterns';

export default function Home() {
  const {
    currentExperiment,
    savedExperiments,
    runState,
    updateExperiment,
    updateRunState,
    loadSavedExperiment,
    deleteSavedExperiment,
    hardwareState,
    sendGridToHardware,
    sendPatternCommand,
  } = useExperiment();
  const [frameTime, setFrameTime] = useState(0);
  const [showExperimentManager, setShowExperimentManager] = useState(false);
  const latestPreviewGridRef = useRef(null);
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    if (runState.status !== 'running') {
      return undefined;
    }

    const start = performance.now() - runState.elapsedTime * 1000;
    let raf;

    const tick = (now) => {
      const elapsed = (now - start) / 1000;
      updateRunState({ elapsedTime: elapsed });
      setFrameTime(elapsed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runState.status, runState.elapsedTime, updateRunState]);

  const cycleDuration = Math.max(
    1,
    ...currentExperiment.motionTracks.map((track) =>
      Math.max(0, ...(track.points ?? []).map((point) => point.timeSec)),
    ),
  );
  const cycleElapsed = cycleDuration > 0 ? runState.elapsedTime % cycleDuration : 0;
  const progress = cycleDuration > 0 ? cycleElapsed / cycleDuration : 0;
  const playbackTime =
    runState.status === 'running' || runState.status === 'paused'
      ? cycleElapsed
      : frameTime;
  const previewGrid = useMemo(
    () => applyMotionTracks(
      currentExperiment.grid,
      runState.status === 'running' || runState.status === 'paused' ? currentExperiment.motionTracks : [],
      playbackTime,
      currentExperiment.maxDisplacementMm,
    ),
    [currentExperiment, playbackTime, runState.status],
  );
  latestPreviewGridRef.current = previewGrid;

  useEffect(() => {
    if (runState.status !== 'running' || hardwareState.status !== 'connected') {
      return undefined;
    }

    let cancelled = false;

    const streamFrame = async () => {
      if (cancelled) {
        return;
      }

      if (!sendInFlightRef.current) {
        sendInFlightRef.current = true;
        try {
          await sendGridToHardware(latestPreviewGridRef.current);
        } finally {
          sendInFlightRef.current = false;
        }
      }

      if (!cancelled) {
        window.setTimeout(streamFrame, DEFAULT_FRAME_INTERVAL_MS);
      }
    };

    streamFrame();
    return () => {
      cancelled = true;
      sendInFlightRef.current = false;
    };
  }, [hardwareState.status, runState.status, sendGridToHardware]);

  const stopRun = async () => {
    updateRunState({ status: 'stopped', elapsedTime: 0 });
    if (hardwareState.status === 'connected') {
      await sendPatternCommand('flat');
    }
  };

  return (
    <div className="page-stack main-control-page">
      <section className="panel sticky-runbar">
        <div className="runbar-main">
          <div className="current-experiment-card">
            <p className="eyebrow">Experiment</p>
            <h2>{currentExperiment.name}</h2>
            <p className="muted-copy">
              {currentExperiment.id.startsWith('saved-') ? 'Saved experiment loaded' : 'Unsaved working experiment'}
            </p>
            <div className="saved-actions">
              <button className="secondary" onClick={() => setShowExperimentManager(true)}>Choose Experiment</button>
              <Link to="/actuators" className="secondary-link">Edit</Link>
            </div>
          </div>
          <div className="run-controls">
            <button onClick={() => updateRunState({ status: 'running' })}>Run</button>
            <button className="secondary" onClick={() => updateRunState({ status: 'paused' })}>Pause</button>
            <button className="danger" onClick={stopRun}>Stop</button>
            <Link to="/actuators" className="primary-link">Actuator Editor</Link>
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-track">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="progress-meta">
            <strong>{runState.status}</strong>
            <span>{cycleElapsed.toFixed(1)} s / {cycleDuration.toFixed(1)} s</span>
          </div>
        </div>
      </section>

      <div className="main-grid">
        <section className="panel preview-panel">
          <ExperimentPreview
            title="Heatmap Preview"
            grid={previewGrid}
            maxValue={currentExperiment.maxDisplacementMm}
            footer={
              <div className="panel-footer stack-gap">
                <p>Static wall shape comes from the actuator editor.</p>
                <p>Saved motion tracks animate only the actuators they were assigned to.</p>
              </div>
            }
          />
        </section>

        <section className="panel compact-status">
          <h3>Run Status</h3>
          <p><strong>Current:</strong> {currentExperiment.name}</p>
          <p><strong>Motion Tracks:</strong> {currentExperiment.motionTracks.length}</p>
          <p><strong>Playback:</strong> {runState.status}</p>
          <p><strong>Hardware Safety:</strong> firmware calibration and clamps active</p>
        </section>
      </div>

      <ExperimentManagerModal
        open={showExperimentManager}
        currentExperiment={currentExperiment}
        savedExperiments={savedExperiments}
        onClose={() => setShowExperimentManager(false)}
        onLoadSaved={(id) => {
          loadSavedExperiment(id);
          setShowExperimentManager(false);
        }}
        onDeleteSaved={deleteSavedExperiment}
        onCreateNew={(experiment) => {
          updateExperiment(experiment);
          setShowExperimentManager(false);
        }}
      />
    </div>
  );
}
