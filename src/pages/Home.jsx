import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CalibrationModal from '../components/CalibrationModal';
import ExperimentManagerModal from '../components/ExperimentManagerModal';
import ExperimentPreview from '../components/ExperimentPreview';
import { useExperiment } from '../context/ExperimentContext';
import { applyMotionTracks } from '../utils/patterns';
import { buildGridServoCommands, displacementMmToServoAngle, flatIndexToCell, formatCellLabel } from '../utils/hardware';

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
    updateHardwareConfig,
    connectHardware,
    disconnectHardware,
    sendServoCommand,
    sendGridToHardware,
  } = useExperiment();
  const [frameTime, setFrameTime] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showExperimentManager, setShowExperimentManager] = useState(false);
  const [jogChannel, setJogChannel] = useState(0);
  const [jogAngle, setJogAngle] = useState(90);
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
  const previewGrid = useMemo(
    () => applyMotionTracks(
      currentExperiment.grid,
      runState.status === 'running' || runState.status === 'paused' ? currentExperiment.motionTracks : [],
      frameTime,
      currentExperiment.maxDisplacementMm,
    ),
    [currentExperiment, frameTime, runState.status],
  );
  latestPreviewGridRef.current = previewGrid;

  useEffect(() => {
    if (runState.status !== 'running' || hardwareState.status !== 'connected') {
      return undefined;
    }

    const timer = window.setInterval(() => {
      sendGridToHardware(latestPreviewGridRef.current);
    }, 120);

    return () => window.clearInterval(timer);
  }, [hardwareState.status, runState.status, sendGridToHardware]);

  const mappedCommands = useMemo(
    () =>
      buildGridServoCommands(previewGrid, {
        offsetGrid: calibration.offsetGrid,
        maxDisplacementMm: currentExperiment.maxDisplacementMm,
        servoMaxDegrees: currentExperiment.servoMaxDegrees,
        cellStartIndex: hardwareState.config.cellStartIndex,
        channelStart: hardwareState.config.channelStart,
        channelCount: hardwareState.config.channelCount,
      }),
    [
      calibration.offsetGrid,
      currentExperiment.maxDisplacementMm,
      currentExperiment.servoMaxDegrees,
      hardwareState.config.cellStartIndex,
      hardwareState.config.channelCount,
      hardwareState.config.channelStart,
      previewGrid,
    ],
  );
  const firstMappedCell = mappedCommands[0];
  const lastMappedCell = mappedCommands.at(-1);
  const selectedPreviewCell = flatIndexToCell(hardwareState.config.cellStartIndex);
  const selectedPreviewAngle = displacementMmToServoAngle(
    previewGrid[selectedPreviewCell.row]?.[selectedPreviewCell.col] ?? 0,
    {
      maxDisplacementMm: currentExperiment.maxDisplacementMm,
      servoMaxDegrees: currentExperiment.servoMaxDegrees,
      calibrationOffsetMm: calibration.offsetGrid[selectedPreviewCell.row]?.[selectedPreviewCell.col] ?? 0,
    },
  );

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
          <div className="top-gap hardware-panel">
            <h3>Arduino Link</h3>
            <p><strong>Status:</strong> {hardwareState.status}</p>
            <p><strong>Last Write:</strong> {hardwareState.lastCommandSummary}</p>
            {!hardwareState.supported ? (
              <p className="warning">Web Serial requires Chrome, Edge, or another Chromium browser on `localhost` or HTTPS.</p>
            ) : null}
            {hardwareState.error ? (
              <p className="warning">{hardwareState.error}</p>
            ) : null}

            <div className="saved-actions">
              <button onClick={connectHardware} disabled={hardwareState.status === 'connecting' || hardwareState.status === 'connected'}>
                {hardwareState.status === 'connecting' ? 'Connecting...' : 'Connect Arduino'}
              </button>
              <button className="secondary" onClick={disconnectHardware} disabled={hardwareState.status !== 'connected'}>
                Disconnect
              </button>
              <button className="secondary" onClick={() => sendGridToHardware(previewGrid)} disabled={hardwareState.status !== 'connected'}>
                Send Current Wall
              </button>
            </div>

            <div className="three-input-grid">
              <label>
                Baud Rate
                <input
                  type="number"
                  min={300}
                  step={300}
                  value={hardwareState.config.baudRate}
                  onChange={(event) => updateHardwareConfig({ baudRate: Number(event.target.value) || 9600 })}
                  disabled={hardwareState.status === 'connected'}
                />
              </label>
              <label>
                First UI Cell
                <input
                  type="number"
                  min={0}
                  max={63}
                  step={1}
                  value={hardwareState.config.cellStartIndex}
                  onChange={(event) => updateHardwareConfig({ cellStartIndex: Math.max(0, Math.min(63, Number(event.target.value) || 0)) })}
                />
              </label>
              <label>
                Channel Count
                <input
                  type="number"
                  min={1}
                  max={64}
                  step={1}
                  value={hardwareState.config.channelCount}
                  onChange={(event) => updateHardwareConfig({ channelCount: Math.max(1, Math.min(64, Number(event.target.value) || 1)) })}
                />
              </label>
            </div>

            <div className="three-input-grid">
              <label>
                First Arduino Channel
                <input
                  type="number"
                  min={0}
                  max={63}
                  step={1}
                  value={hardwareState.config.channelStart}
                  onChange={(event) => updateHardwareConfig({ channelStart: Math.max(0, Math.min(63, Number(event.target.value) || 0)) })}
                />
              </label>
              <label>
                Jog Channel
                <input
                  type="number"
                  min={0}
                  max={63}
                  step={1}
                  value={jogChannel}
                  onChange={(event) => setJogChannel(Math.max(0, Math.min(63, Number(event.target.value) || 0)))}
                />
              </label>
              <label>
                Jog Angle
                <input
                  type="number"
                  min={0}
                  max={180}
                  step={1}
                  value={jogAngle}
                  onChange={(event) => setJogAngle(Math.max(0, Math.min(180, Number(event.target.value) || 0)))}
                />
              </label>
            </div>

            <div className="saved-actions">
              <button className="secondary" onClick={() => sendServoCommand(jogChannel, jogAngle)} disabled={hardwareState.status !== 'connected'}>
                Jog Servo
              </button>
            </div>

            <div className="callout subtle">
              The provided Arduino sketch accepts `channel:angle` lines and, as written, drives one PCA9685 board.
              With the default settings this UI sends the full 4 x 16 wall, {formatCellLabel(selectedPreviewCell.row, selectedPreviewCell.col)} through {lastMappedCell?.label ?? formatCellLabel(selectedPreviewCell.row, selectedPreviewCell.col)}, onto Arduino channels {hardwareState.config.channelStart} through {(hardwareState.config.channelStart + hardwareState.config.channelCount) - 1}.
            </div>

            {firstMappedCell ? (
              <div className="callout subtle">
                Preview: {firstMappedCell.label} currently maps to channel {firstMappedCell.channel} at {firstMappedCell.angle} degrees.
                The first selected cell from the wall preview is {formatCellLabel(selectedPreviewCell.row, selectedPreviewCell.col)} at {selectedPreviewAngle} degrees after calibration.
              </div>
            ) : null}
          </div>
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
