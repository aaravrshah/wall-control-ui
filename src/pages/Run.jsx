import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import WallGrid from '../components/WallGrid';
import { useExperiment } from '../context/ExperimentContext';
import { countActiveCellsInRegion } from '../utils/grid';
import { generatePatternGrid } from '../utils/patterns';

function formatStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function Run() {
  const { currentExperiment, runState, updateRunState, hardwareState } = useExperiment();
  const [frameTime, setFrameTime] = useState(0);

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

  const totalDuration = currentExperiment.duration * currentExperiment.repeatCount;
  const progress = Math.min(1, runState.elapsedTime / totalDuration);
  const activeActuators = countActiveCellsInRegion(currentExperiment.activeRegion);
  const animatedGrid = useMemo(
    () => generatePatternGrid(currentExperiment.selectedPreset, currentExperiment, frameTime),
    [currentExperiment, frameTime],
  );
  const estimatedCurrent = (0.18 + currentExperiment.amplitude * 0.35) * activeActuators;
  const boardLoad = Math.ceil(activeActuators / 16);

  return (
    <div className="page-grid two-col">
      <section className="page-stack">
        <SectionHeader
          title="Run & Health"
          subtitle="Operate the prototype as an instrument: watch experiment progress, command coverage, and electronics health in one place."
        />

        <section className="panel run-console">
          <div className="run-controls">
            <button onClick={() => updateRunState({ status: 'running' })}>Start Run</button>
            <button className="secondary" onClick={() => updateRunState({ status: 'paused' })}>Pause</button>
            <button className="danger" onClick={() => updateRunState({ status: 'stopped', elapsedTime: 0 })}>Stop</button>
            <button className="secondary" onClick={() => updateRunState({ status: 'idle', elapsedTime: 0 })}>Reset</button>
          </div>

          <div className="progress-wrap">
            <div className="progress-track">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="progress-meta">
              <strong>{formatStatus(runState.status)}</strong>
              <span>{runState.elapsedTime.toFixed(1)} s of {totalDuration.toFixed(1)} s</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <SectionHeader
            title="Live Wall Command"
            subtitle="Preview of normalized command levels being sent across the 4 x 16 actuator field."
          />
          <WallGrid grid={animatedGrid} />
          <div className="heat-legend">
            <span>Neutral hold</span>
            <span>Higher commanded displacement</span>
          </div>
        </section>

        <section className="panel metrics-grid">
          <article className="metric-card">
            <p>Preset</p>
            <h3>{currentExperiment.selectedPreset}</h3>
          </article>
          <article className="metric-card">
            <p>Active Actuators</p>
            <h3>{activeActuators}</h3>
          </article>
          <article className="metric-card">
            <p>Estimated Servo Load</p>
            <h3>{estimatedCurrent.toFixed(1)} A</h3>
          </article>
          <article className="metric-card">
            <p>PWM Boards in Use</p>
            <h3>{boardLoad} / 4</h3>
          </article>
        </section>
      </section>

      <aside className="side-stack">
        <section className="panel surface-card">
          <SectionHeader
            title="Command Chain"
            subtitle="What the operator should mentally track during a run."
          />
          <ul className="bullet-list">
            <li>PC issues run command over USB to the Arduino Mega.</li>
            <li>Arduino distributes PWM setpoints to PCA9685 boards over I2C.</li>
            <li>Driver outputs command the MG90S servos beneath the membrane.</li>
            <li>Custom PCB distributes regulated 5 V power and protection to the actuator banks.</li>
          </ul>
        </section>

        <section className="panel surface-card">
          <SectionHeader title="Power & Protection" subtitle="Mirrors the architecture you shared for the custom PCB and supply chain." />
          <dl className="detail-list compact">
            <div>
              <dt>Supply</dt>
              <dd>{hardwareState.power.supplyName}</dd>
            </div>
            <div>
              <dt>Rail Voltage</dt>
              <dd>{hardwareState.power.railVoltage.toFixed(2)} V</dd>
            </div>
            <div>
              <dt>Fuse Banks</dt>
              <dd>{hardwareState.power.fuseBanksHealthy} / {hardwareState.power.fuseBanksTotal} healthy</dd>
            </div>
            <div>
              <dt>Protection</dt>
              <dd>{hardwareState.power.transientProtection}</dd>
            </div>
          </dl>
          <div className="callout subtle">
            The current estimate is only a planning aid. Final safety limits should come from measured stall,
            surge, and simultaneous-actuation behavior on the real hardware.
          </div>
        </section>

        <section className="panel">
          <SectionHeader title="Driver Boards" subtitle="Channel groups corresponding to your PCA9685 banks." />
          <div className="architecture-grid board-grid">
            {hardwareState.pwmBoards.map((board, index) => (
              <article key={board.id} className="arch-card">
                <p>Board {board.id}</p>
                <h3>{board.channels} channels</h3>
                <span>{index < boardLoad ? 'Receiving commands' : 'Idle for this region'}</span>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
