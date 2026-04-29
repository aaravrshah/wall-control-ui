import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ExperimentManagerModal from '../components/ExperimentManagerModal';
import ExperimentPreview from '../components/ExperimentPreview';
import { useExperiment } from '../context/ExperimentContext';
import {
  DEFAULT_SKETCH_PARAMS,
  generateArduinoSketch,
  sampleGeneratedSketchGrid,
} from '../utils/arduinoSketch';

export default function Home() {
  const {
    currentExperiment,
    savedExperiments,
    runState,
    updateExperiment,
    updateRunState,
    loadSavedExperiment,
    deleteSavedExperiment,
  } = useExperiment();
  const [frameTime, setFrameTime] = useState(0);
  const [showExperimentManager, setShowExperimentManager] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [sketchParams, setSketchParams] = useState(DEFAULT_SKETCH_PARAMS);

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

  const previewTime = runState.status === 'running' || runState.status === 'paused'
    ? runState.elapsedTime
    : frameTime;

  const previewGrid = useMemo(
    () => sampleGeneratedSketchGrid(
      currentExperiment.grid,
      currentExperiment.maxDisplacementMm,
      sketchParams,
      previewTime,
    ),
    [currentExperiment.grid, currentExperiment.maxDisplacementMm, previewTime, sketchParams],
  );

  const generatedSketch = useMemo(
    () => generateArduinoSketch(currentExperiment, sketchParams),
    [currentExperiment, sketchParams],
  );
  const activeActuatorCount = useMemo(
    () => currentExperiment.grid.flat().filter((value) => Number(value) > 0.01).length,
    [currentExperiment.grid],
  );

  const updateSketchParam = (key, value) => {
    setSketchParams((previous) => ({
      ...previous,
      [key]: Number(value),
    }));
    setCopyStatus('');
  };

  const startPreview = () => {
    updateRunState({ status: 'running', elapsedTime: runState.status === 'paused' ? runState.elapsedTime : 0 });
    if (runState.status !== 'paused') {
      setFrameTime(0);
    }
  };

  const pausePreview = () => {
    updateRunState({ status: 'paused' });
  };

  const resetPreview = () => {
    updateRunState({ status: 'stopped', elapsedTime: 0 });
    setFrameTime(0);
  };

  const copySketch = async () => {
    try {
      await navigator.clipboard.writeText(generatedSketch);
      setCopyStatus('Copied Arduino sketch.');
    } catch (error) {
      setCopyStatus('Copy failed. Select the code text manually.');
    }
  };

  return (
    <div className="page-stack main-control-page">
      <section className="panel sticky-runbar">
        <div className="runbar-main">
          <div className="current-experiment-card">
            <p className="eyebrow">Sketch Generator</p>
            <h2>{currentExperiment.name}</h2>
            <p className="muted-copy">
              Grid values become per-actuator amplitude multipliers in the generated Arduino sketch.
            </p>
            <div className="saved-actions">
              <button className="secondary" onClick={() => setShowExperimentManager(true)}>Choose Experiment</button>
              <Link to="/actuators" className="secondary-link">Edit Grid</Link>
            </div>
          </div>
          <div className="run-controls">
            <button onClick={copySketch}>Copy Arduino Code</button>
            <button className="secondary" onClick={startPreview}>Preview</button>
            <button className="secondary" onClick={pausePreview}>Pause</button>
            <button className="danger" onClick={resetPreview}>Reset</button>
          </div>
        </div>
        {copyStatus ? <p className="muted-copy top-gap">{copyStatus}</p> : null}
      </section>

      <div className="main-grid">
        <section className="panel preview-panel">
          <ExperimentPreview
            title="Generated Pattern Preview"
            grid={previewGrid}
            maxValue={currentExperiment.maxDisplacementMm}
            footer={
              <div className="panel-footer stack-gap">
                <p>0 grid value disables an actuator. Max grid value uses the full generated amplitude.</p>
                <p>The Arduino sketch runs this wave locally, so motion timing does not depend on browser serial updates.</p>
              </div>
            }
          />
        </section>

        <section className="panel control-grid">
          <h3>Arduino Parameters</h3>
          <div className="two-input-grid">
            <label>
              Frequency (Hz)
              <input
                type="number"
                min={0.01}
                max={5}
                step={0.01}
                value={sketchParams.frequencyHz}
                onChange={(event) => updateSketchParam('frequencyHz', event.target.value)}
              />
            </label>
            <label>
              Amplitude (servo degrees)
              <input
                type="number"
                min={0}
                max={28}
                step={0.5}
                value={sketchParams.amplitudeDegrees}
                onChange={(event) => updateSketchParam('amplitudeDegrees', event.target.value)}
              />
            </label>
          </div>
          <div className="two-input-grid">
            <label>
              Column Phase (deg)
              <input
                type="number"
                min={-360}
                max={360}
                step={1}
                value={sketchParams.columnPhaseDegrees}
                onChange={(event) => updateSketchParam('columnPhaseDegrees', event.target.value)}
              />
            </label>
            <label>
              Row Phase (deg)
              <input
                type="number"
                min={-360}
                max={360}
                step={1}
                value={sketchParams.rowPhaseDegrees}
                onChange={(event) => updateSketchParam('rowPhaseDegrees', event.target.value)}
              />
            </label>
          </div>
          <div className="two-input-grid">
            <label>
              Global Phase (deg)
              <input
                type="number"
                min={-360}
                max={360}
                step={1}
                value={sketchParams.globalPhaseDegrees}
                onChange={(event) => updateSketchParam('globalPhaseDegrees', event.target.value)}
              />
            </label>
            <label>
              Refresh Delay (ms)
              <input
                type="number"
                min={5}
                max={100}
                step={1}
                value={sketchParams.refreshDelayMs}
                onChange={(event) => updateSketchParam('refreshDelayMs', event.target.value)}
              />
            </label>
          </div>
          <div className="compact-status">
            <p><strong>Preview:</strong> {runState.status}</p>
            <p><strong>Active Actuators:</strong> {activeActuatorCount} / 64</p>
            <p><strong>Amplitude Source:</strong> actuator grid</p>
            <p><strong>Generated Safety:</strong> calibrated centers and PWM clamps</p>
          </div>
          {activeActuatorCount === 0 ? (
            <div className="warning">This grid is flat, so the generated sketch will hold every actuator at zero displacement.</div>
          ) : null}
        </section>
      </div>

      <section className="panel generated-code-panel">
        <div className="section-header">
          <div>
            <h2>Arduino Sketch</h2>
            <p>Paste this into Arduino IDE and upload it manually.</p>
          </div>
          <button onClick={copySketch}>Copy Code</button>
        </div>
        <textarea
          className="code-output"
          value={generatedSketch}
          readOnly
          spellCheck={false}
        />
      </section>

      <ExperimentManagerModal
        open={showExperimentManager}
        currentExperiment={currentExperiment}
        savedExperiments={savedExperiments}
        onClose={() => setShowExperimentManager(false)}
        onLoadSaved={(id) => {
          loadSavedExperiment(id);
          setShowExperimentManager(false);
          setCopyStatus('');
        }}
        onDeleteSaved={deleteSavedExperiment}
        onCreateNew={(experiment) => {
          updateExperiment(experiment);
          setShowExperimentManager(false);
          setCopyStatus('');
        }}
      />
    </div>
  );
}
