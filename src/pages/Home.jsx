import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ExperimentManagerModal from '../components/ExperimentManagerModal';
import ExperimentPreview from '../components/ExperimentPreview';
import { useExperiment } from '../context/ExperimentContext';
import { generateArduinoSketch, parseArduinoSketch, sampleGeneratedSketchGrid } from '../utils/arduinoSketch';
import { getTrackMode } from '../utils/patterns';

function sketchFileName(name) {
  const slug = String(name || 'wall-control-sketch')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'wall-control-sketch'}.ino`;
}

export default function Home() {
  const {
    currentExperiment,
    runState,
    updateExperiment,
    updateRunState,
  } = useExperiment();
  const [frameTime, setFrameTime] = useState(runState.elapsedTime ?? 0);
  const frameTimeRef = useRef(frameTime);
  const [showExperimentManager, setShowExperimentManager] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    frameTimeRef.current = frameTime;
  }, [frameTime]);

  useEffect(() => {
    if (runState.status !== 'running') {
      return undefined;
    }

    const start = performance.now() - frameTimeRef.current * 1000;
    let raf;

    const tick = (now) => {
      const elapsed = (now - start) / 1000;
      frameTimeRef.current = elapsed;
      setFrameTime(elapsed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      updateRunState({ elapsedTime: frameTimeRef.current });
    };
  }, [runState.status, updateRunState]);

  const previewTime = frameTime;

  const previewGrid = useMemo(
    () => sampleGeneratedSketchGrid(currentExperiment, previewTime),
    [currentExperiment, previewTime],
  );

  const generatedSketch = useMemo(
    () => generateArduinoSketch(currentExperiment),
    [currentExperiment],
  );
  const activeActuatorCount = useMemo(
    () => {
      const activeKeys = new Set();
      currentExperiment.grid.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
          if (Number(value) > 0.01) activeKeys.add(`${rowIndex}-${colIndex}`);
        });
      });
      currentExperiment.motionTracks.forEach((track) => {
        track.targetCellKeys.forEach((key) => activeKeys.add(key));
      });
      return activeKeys.size;
    },
    [currentExperiment.grid, currentExperiment.motionTracks],
  );
  const motionSummary = useMemo(() => {
    const waveTracks = currentExperiment.motionTracks.filter((track) => getTrackMode(track) === 'wave').length;
    const pointTracks = currentExperiment.motionTracks.length - waveTracks;
    return { waveTracks, pointTracks };
  }, [currentExperiment.motionTracks]);

  const startPreview = () => {
    const nextElapsed = runState.status === 'paused' ? frameTimeRef.current : 0;
    frameTimeRef.current = nextElapsed;
    setFrameTime(nextElapsed);
    updateRunState({ status: 'running', elapsedTime: nextElapsed });
    setCopyStatus('Running a browser-only preview. Arduino is not required.');
  };

  const pausePreview = () => {
    const elapsedTime = frameTimeRef.current;
    setFrameTime(elapsedTime);
    updateRunState({ status: 'paused', elapsedTime });
    setCopyStatus('');
  };

  const resetPreview = () => {
    frameTimeRef.current = 0;
    updateRunState({ status: 'stopped', elapsedTime: 0 });
    setFrameTime(0);
    setCopyStatus('');
  };

  const copySketch = async () => {
    try {
      await navigator.clipboard.writeText(generatedSketch);
      setCopyStatus('Copied Arduino sketch.');
    } catch (error) {
      setCopyStatus('Copy failed. Select the code text manually.');
    }
  };

  const downloadSketch = () => {
    const blob = new Blob([generatedSketch], { type: 'text/x-arduino' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sketchFileName(currentExperiment.name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setCopyStatus('Downloaded Arduino sketch.');
  };

  const importSketch = () => {
    try {
      const importedExperiment = parseArduinoSketch(importText);
      frameTimeRef.current = 0;
      updateExperiment(importedExperiment);
      updateRunState({ status: 'stopped', elapsedTime: 0 });
      setFrameTime(0);
      setShowImportModal(false);
      setImportText('');
      setImportError('');
      setCopyStatus('Imported Arduino sketch.');
    } catch (error) {
      setImportError(error.message || 'Could not import this Arduino sketch.');
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
              The generated sketch uses the actuator grid plus any point or wave tracks from the editor.
            </p>
            <div className="saved-actions">
              <button className="secondary" onClick={() => setShowExperimentManager(true)}>New / Template</button>
              <Link to="/actuators" className="secondary-link">Edit Grid</Link>
            </div>
          </div>
          <div className="run-controls">
            <button onClick={copySketch}>Copy Arduino Code</button>
            <button className="secondary" onClick={downloadSketch}>Download .ino</button>
            <button className="secondary" onClick={() => setShowImportModal(true)}>Import .ino</button>
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
              <div className="stack-gap">
                <div className="preview-meta-row">
                  <span className={`preview-state ${runState.status}`}>{runState.status}</span>
                  <span>{previewTime.toFixed(1)} s</span>
                  <span>Browser simulation</span>
                </div>
                <p>This preview samples the same designed grid and motion tracks used by the generated Arduino sketch.</p>
                <p>No Arduino connection is needed for browser preview or screen recording.</p>
              </div>
            }
          />
        </section>

        <section className="panel control-grid">
          <h3>Design Summary</h3>
          <div className="compact-status">
            <p><strong>Preview:</strong> {runState.status}</p>
            <p><strong>Active Actuators:</strong> {activeActuatorCount} / 64</p>
            <p><strong>Wave Tracks:</strong> {motionSummary.waveTracks}</p>
            <p><strong>Point Tracks:</strong> {motionSummary.pointTracks}</p>
            <p><strong>Generated Safety:</strong> calibrated centers, mm-to-servo scaling, and PWM clamps</p>
          </div>
          {activeActuatorCount === 0 ? (
            <div className="warning">
              <span>This grid is flat, so there is no heatmap motion to record yet.</span>
            </div>
          ) : null}
          <div className="saved-actions">
            <Link to="/actuators" className="secondary-link">Edit Actuator Design</Link>
          </div>
        </section>
      </div>

      <section className="panel generated-code-panel">
        <div className="section-header">
          <div>
            <h2>Arduino Sketch</h2>
            <p>Generated from the actuator grid and selection motion tracks.</p>
          </div>
          <div className="saved-actions">
            <button className="secondary" onClick={() => setShowImportModal(true)}>Import .ino</button>
            <button className="secondary" onClick={downloadSketch}>Download .ino</button>
            <button onClick={copySketch}>Copy Code</button>
          </div>
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
        onClose={() => setShowExperimentManager(false)}
        onCreateNew={(experiment) => {
          updateExperiment(experiment);
          setShowExperimentManager(false);
          setCopyStatus('');
        }}
      />
      {showImportModal ? (
        <div className="modal-backdrop" onClick={() => setShowImportModal(false)}>
          <div className="modal-card wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header-row">
              <div>
                <h3>Import Arduino Sketch</h3>
                <p>Paste a sketch generated by this UI.</p>
              </div>
              <button className="secondary" onClick={() => setShowImportModal(false)}>Close</button>
            </div>
            <textarea
              className="import-code-input"
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportError('');
              }}
              spellCheck={false}
            />
            {importError ? <div className="warning">{importError}</div> : null}
            <div className="saved-actions">
              <button onClick={importSketch} disabled={!importText.trim()}>Import Sketch</button>
              <button className="secondary" onClick={() => setImportText('')}>Clear</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
