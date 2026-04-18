import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import KeyframeList from '../components/KeyframeList';
import SectionHeader from '../components/SectionHeader';
import WallGrid from '../components/WallGrid';
import { useExperiment } from '../context/ExperimentContext';
import { cloneGrid } from '../utils/grid';
import { interpolateGrids } from '../utils/patterns';

export default function Sequencer() {
  const { currentExperiment, updateExperiment } = useExperiment();
  const [selectedId, setSelectedId] = useState(currentExperiment.sequence[0]?.id ?? null);
  const [previewT, setPreviewT] = useState(0.5);

  if (currentExperiment.mode !== 'advanced') return <Navigate to="/setup" replace />;

  const sequence = currentExperiment.sequence;
  const selected = sequence.find((item) => item.id === selectedId) ?? sequence[0];
  const selectedIndex = sequence.findIndex((item) => item.id === selected?.id);
  const nextFrame = sequence[selectedIndex + 1] ?? selected;

  const previewGrid = useMemo(
    () => interpolateGrids(selected?.grid ?? currentExperiment.grid, nextFrame?.grid ?? currentExperiment.grid, previewT),
    [selected, nextFrame, previewT, currentExperiment.grid],
  );

  const patchSequence = (next) => updateExperiment({ sequence: next });

  const addKeyframe = () => {
    const newFrame = {
      id: `kf-${Date.now()}`,
      label: `Keyframe ${sequence.length + 1}`,
      duration: 2,
      grid: cloneGrid(currentExperiment.grid),
    };
    patchSequence([...sequence, newFrame]);
    setSelectedId(newFrame.id);
  };

  return (
    <div className="page-grid two-col">
      <section>
        <SectionHeader title="Sequencer" subtitle="Advanced tool: define keyframe-based wall sequences with interpolation preview." action={<button onClick={addKeyframe}>Add Keyframe</button>} />
        <KeyframeList
          keyframes={sequence}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDurationChange={(id, duration) => patchSequence(sequence.map((frame) => (frame.id === id ? { ...frame, duration } : frame)))}
          onDelete={(id) => patchSequence(sequence.filter((frame) => frame.id !== id))}
          onDuplicate={(id) => {
            const frame = sequence.find((item) => item.id === id);
            if (!frame) return;
            patchSequence([...sequence, { ...frame, id: `kf-${Date.now()}`, label: `${frame.label} Copy` }]);
          }}
        />
      </section>
      <aside className="side-stack">
        <section className="panel">
          <h3>Sequence Preview</h3>
          <WallGrid grid={previewGrid} compact />
          <label>
            Interpolation Position
            <input type="range" min={0} max={1} step={0.01} value={previewT} onChange={(event) => setPreviewT(Number(event.target.value))} />
          </label>
        </section>
        <section className="panel control-grid">
          <label>
            Loop Sequence
            <input
              type="checkbox"
              checked={currentExperiment.loopSequence}
              onChange={(event) => updateExperiment({ loopSequence: event.target.checked })}
            />
          </label>
          <label>
            Sequence Repeats
            <input
              type="number"
              min={1}
              max={20}
              value={currentExperiment.sequenceRepeats}
              onChange={(event) => updateExperiment({ sequenceRepeats: Number(event.target.value) })}
            />
          </label>
        </section>
      </aside>
    </div>
  );
}
