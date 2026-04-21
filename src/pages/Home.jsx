import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CalibrationModal from '../components/CalibrationModal';
import ExperimentManagerModal from '../components/ExperimentManagerModal';
import ExperimentPreview from '../components/ExperimentPreview';
import { useExperiment } from '../context/ExperimentContext';
import { applyMotionTracks } from '../utils/patterns';

export default function Home() {
  const {
    currentExperiment,
    savedExperiments,
    calibration,
    runState,
    updateExperiment,
    updateCalibration,
    updateRunState,
    loadSavedExperiment,
    deleteSavedExperiment,
    hardwareState,
    sendGridToHardware,
  } = useExperiment();
  const [frameTime, setFrameTime] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showExperimentManager, setShowExperimentManager] = useState(false);
  const latestPreviewGridRef = useRef(null);

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

    // Stream the current frame to hardware while a run is active.
    const timer = window.setInterval(() => {
      sendGridToHardware(latestPreviewGridRef.current);
    }, 100);

    return () => window.clearInterval(timer);
  }, [hardwareState.status, runState.status, sendGridToHardware]);

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
            <button className="danger" onClick={() => updateRunState({ status: 'stopped', elapsedTime: 0 })}>Stop</button>
            <button className="secondary" onClick={() => setShowCalibration(true)}>Calibration</button>
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
          <p><strong>Calibration Offsets:</strong> active on {calibration.offsetGrid.flat().filter((value) => Math.abs(value) > 0.01).length} actuators</p>
        </section>
      </div>

      <CalibrationModal
        open={showCalibration}
        offsetGrid={calibration.offsetGrid}
        maxTrim={2}
        midpoint={currentExperiment.maxDisplacementMm / 2}
        onClose={() => setShowCalibration(false)}
        onSave={(offsetGrid) => {
          updateCalibration({ offsetGrid });
          setShowCalibration(false);
        }}
      />

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
