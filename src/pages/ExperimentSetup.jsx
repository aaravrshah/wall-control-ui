import { useMemo } from 'react';
import ExperimentPreview from '../components/ExperimentPreview';
import NumericControl from '../components/NumericControl';
import PatternCard from '../components/PatternCard';
import SaveLoadPanel from '../components/SaveLoadPanel';
import SectionHeader from '../components/SectionHeader';
import { useExperiment } from '../context/ExperimentContext';
import { presetPatterns } from '../data/presets';
import { generatePatternGrid } from '../utils/patterns';

export default function ExperimentSetup() {
  const { currentExperiment, updateExperiment } = useExperiment();

  const previewGrid = useMemo(() =>
    generatePatternGrid(currentExperiment.selectedPreset, currentExperiment, 0),
    [currentExperiment],
  );

  return (
    <div className="page-grid two-col">
      <section>
        <SectionHeader title="Experiment Setup" subtitle="Choose a pattern, adjust high-level parameters, and save reusable experiment definitions." />
        <div className="pattern-grid">
          {presetPatterns.map((pattern) => (
            <PatternCard
              key={pattern.key}
              pattern={pattern}
              active={currentExperiment.selectedPreset === pattern.key}
              onSelect={(key) => updateExperiment({ selectedPreset: key, name: pattern.name })}
            />
          ))}
        </div>

        <section className="panel control-grid">
          <NumericControl label="Amplitude" value={currentExperiment.amplitude} min={0} max={1} step={0.05} onChange={(amplitude) => updateExperiment({ amplitude })} />
          <NumericControl label="Frequency (Hz)" value={currentExperiment.frequency} min={0.1} max={2.5} step={0.1} onChange={(frequency) => updateExperiment({ frequency })} />
          <NumericControl label="Duration (s)" value={currentExperiment.duration} min={5} max={120} step={1} onChange={(duration) => updateExperiment({ duration })} />
          <NumericControl label="Repeat Count" value={currentExperiment.repeatCount} min={1} max={10} step={1} onChange={(repeatCount) => updateExperiment({ repeatCount })} />
          <label>
            Direction
            <select value={currentExperiment.direction} onChange={(event) => updateExperiment({ direction: event.target.value })}>
              <option value="downstream">Downstream</option>
              <option value="upstream">Upstream</option>
              <option value="none">None</option>
            </select>
          </label>
          <label>
            Active Region
            <select value={currentExperiment.activeRegion} onChange={(event) => updateExperiment({ activeRegion: event.target.value })}>
              <option value="full">Full Wall</option>
              <option value="upstream-half">Upstream Half</option>
              <option value="downstream-half">Downstream Half</option>
              <option value="center-strip">Center Strip</option>
            </select>
          </label>
        </section>
      </section>

      <aside className="side-stack">
        <ExperimentPreview title="Live Preset Preview" grid={previewGrid} footer={<p>4 × 16 actuator wall color map preview.</p>} />
        <SaveLoadPanel />
      </aside>
    </div>
  );
}
