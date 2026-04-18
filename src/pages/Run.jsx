import { useEffect, useMemo, useState } from 'react';
import ExperimentPreview from '../components/ExperimentPreview';
import SectionHeader from '../components/SectionHeader';
import WallGrid from '../components/WallGrid';
import { useExperiment } from '../context/ExperimentContext';
import { generatePatternGrid } from '../utils/patterns';

export default function Run() {
  const { currentExperiment, runState, updateRunState } = useExperiment();
  const [frameTime, setFrameTime] = useState(0);

  useEffect(() => {
    if (runState.status !== 'running') return undefined;
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
  }, [runState.status]);

  const totalDuration = currentExperiment.duration * currentExperiment.repeatCount;
  const progress = Math.min(1, runState.elapsedTime / totalDuration);

  const animatedGrid = useMemo(
    () => generatePatternGrid(currentExperiment.selectedPreset, currentExperiment, frameTime),
    [currentExperiment, frameTime],
  );

  const sideProfile = animatedGrid[2];

  return (
    <div className="page-grid two-col">
      <section>
        <SectionHeader title="Run Experiment" subtitle="Start, pause, and monitor a mock experiment cycle. No hardware connection is used in this prototype." />
        <section className="panel run-controls">
          <button onClick={() => updateRunState({ status: 'running' })}>Start</button>
          <button className="secondary" onClick={() => updateRunState({ status: 'paused' })}>Pause</button>
          <button className="danger" onClick={() => updateRunState({ status: 'stopped', elapsedTime: 0 })}>Stop</button>
          <button className="secondary" onClick={() => updateRunState({ status: 'idle', elapsedTime: 0 })}>Reset</button>
        </section>

        <section className="panel">
          <WallGrid grid={animatedGrid} />
          <div className="progress-wrap">
            <div className="progress-track"><span style={{ width: `${progress * 100}%` }} /></div>
            <p>{runState.elapsedTime.toFixed(1)} s / {totalDuration.toFixed(1)} s</p>
          </div>
        </section>
      </section>

      <aside className="side-stack">
        <ExperimentPreview
          title="Status Readouts"
          grid={animatedGrid}
          footer={
            <ul className="readouts">
              <li>Mode: {currentExperiment.mode}</li>
              <li>Preset: {currentExperiment.selectedPreset}</li>
              <li>Amplitude: {currentExperiment.amplitude.toFixed(2)}</li>
              <li>Frequency: {currentExperiment.frequency.toFixed(2)} Hz</li>
              <li>Duration: {currentExperiment.duration.toFixed(0)} s</li>
              <li>Repeat Count: {currentExperiment.repeatCount}</li>
              <li>Status: {runState.status}</li>
            </ul>
          }
        />
        <section className="panel">
          <h3>Side Profile (Row 3)</h3>
          <div className="profile-chart">
            {sideProfile.map((point, index) => (
              <div key={index} className="bar" style={{ height: `${Math.max(5, point * 100)}%` }} />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
