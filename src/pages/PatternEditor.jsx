import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import SectionHeader from '../components/SectionHeader';
import WallGrid from '../components/WallGrid';
import { useExperiment } from '../context/ExperimentContext';
import { applyRegionToGrid, cloneGrid, mirrorGridHorizontal, smoothGrid } from '../utils/grid';

function buildRectSelection(start, end) {
  const startRow = Math.min(start.row, end.row);
  const endRow = Math.max(start.row, end.row);
  const startCol = Math.min(start.col, end.col);
  const endCol = Math.max(start.col, end.col);
  const keys = new Set();
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      keys.add(`${row}-${col}`);
    }
  }
  return { keys, rect: { type: 'rect', startRow, endRow, startCol, endCol } };
}

export default function PatternEditor() {
  const { currentExperiment, setGrid, updateExperiment, saveCurrentExperiment } = useExperiment();
  const [paintValue, setPaintValue] = useState(0.8);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [selectedRegion, setSelectedRegion] = useState('full');

  if (currentExperiment.mode !== 'advanced') {
    return <Navigate to="/setup" replace />;
  }

  const grid = useMemo(() => cloneGrid(currentExperiment.grid), [currentExperiment.grid]);

  const paintCell = (row, col, isStart) => {
    if (isStart) setSelectionStart({ row, col });
    const next = cloneGrid(grid);
    next[row][col] = paintValue;
    setGrid(next);
    if (selectionStart && !isStart) {
      const { keys, rect } = buildRectSelection(selectionStart, { row, col });
      setSelectedCells(keys);
      setSelectedRegion(rect);
    }
  };

  return (
    <div className="page-stack">
      <SectionHeader title="Pattern Editor" subtitle="Advanced tool: direct 4 × 16 node editing with paint, selection, and helper operations." />
      <section className="page-grid two-col">
        <section className="panel">
          <WallGrid
            grid={grid}
            interactive
            selectedCells={selectedCells}
            onCellPointer={paintCell}
            onPointerUp={() => setSelectionStart(null)}
          />
          <div className="heat-legend">
            <span>Low (blue)</span>
            <span>Mid (green)</span>
            <span>High (orange)</span>
          </div>
        </section>

        <section className="panel control-grid">
          <label>
            Paint Value
            <input type="range" min={0} max={1} step={0.01} value={paintValue} onChange={(event) => setPaintValue(Number(event.target.value))} />
          </label>
          <label>
            Selection Region
            <select value={typeof selectedRegion === 'string' ? selectedRegion : 'rect'} onChange={(event) => setSelectedRegion(event.target.value)}>
              <option value="full">Full Wall</option>
              <option value="rect">Rectangular Selection</option>
            </select>
          </label>
          <div className="saved-actions">
            <button className="secondary" onClick={() => setGrid(applyRegionToGrid(grid, selectedRegion, () => paintValue))}>Fill Selection</button>
            <button className="secondary" onClick={() => setGrid(applyRegionToGrid(grid, selectedRegion, () => 0))}>Clear Selection</button>
            <button className="secondary" onClick={() => setGrid(mirrorGridHorizontal(grid))}>Mirror Pattern</button>
            <button className="secondary" onClick={() => setGrid(smoothGrid(grid))}>Smooth / Interpolate</button>
          </div>
          <div className="saved-actions">
            <button onClick={() => updateExperiment({ grid: cloneGrid(grid) })}>Apply to Current Experiment</button>
            <button className="secondary" onClick={() => saveCurrentExperiment('Custom Pattern Snapshot')}>Save as Custom Pattern</button>
          </div>
          <div className="saved-actions">
            <button className="secondary" onClick={() => {
              const rowKeys = new Set(Array.from({ length: 16 }, (_, col) => `1-${col}`));
              setSelectedCells(rowKeys);
              setSelectedRegion({ type: 'row', index: 1 });
            }}>Select Row 2</button>
            <button className="secondary" onClick={() => {
              const colKeys = new Set(Array.from({ length: 4 }, (_, row) => `${row}-7`));
              setSelectedCells(colKeys);
              setSelectedRegion({ type: 'column', index: 7 });
            }}>Select Column 8</button>
          </div>
        </section>
      </section>
    </div>
  );
}
