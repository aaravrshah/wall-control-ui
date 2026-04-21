import { useEffect, useState } from 'react';
import WallGrid from './WallGrid';
import { cloneGrid } from '../utils/grid';

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
  return keys;
}

export default function CalibrationModal({
  open,
  onClose,
  onSave,
  offsetGrid,
  maxTrim = 2,
  midpoint = 0,
}) {
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectedCells, setSelectedCells] = useState(new Set(['0-0']));
  const [draftGrid, setDraftGrid] = useState(() => cloneGrid(offsetGrid));

  useEffect(() => {
    if (open) {
      setDraftGrid(cloneGrid(offsetGrid));
    }
  }, [open, offsetGrid]);

  if (!open) {
    return null;
  }

  const averageTrim = selectedCells.size === 0
    ? 0
    : Number(
        (
          [...selectedCells].reduce((sum, key) => {
            const [row, col] = key.split('-').map(Number);
            return sum + draftGrid[row][col];
          }, 0) / selectedCells.size
        ).toFixed(2),
      );

  const updateSelectionTrim = (nextValue) => {
    setDraftGrid((previous) => {
      const next = cloneGrid(previous);
      selectedCells.forEach((key) => {
        const [row, col] = key.split('-').map(Number);
        next[row][col] = Math.max(-maxTrim, Math.min(maxTrim, Number(nextValue)));
      });
      return next;
    });
  };

  const handleCellPointer = (row, col, isStart, event) => {
    const key = `${row}-${col}`;
    const additive = event?.ctrlKey || event?.metaKey;

    if (isStart) {
      setSelectionStart(additive ? null : { row, col });
      setSelectedCells((previous) => {
        if (additive) {
          const next = new Set(previous);
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
          return next;
        }
        return new Set([key]);
      });
      return;
    }

    if (selectionStart) {
      setSelectedCells(buildRectSelection(selectionStart, { row, col }));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={(event) => event.stopPropagation()}>
        <h3>Calibration Trim</h3>
        <p>
          Use small offsets to flatten the assembled wall. These trims become the new zero reference, so a
          commanded 0 mm will still produce a physically flat membrane.
        </p>
        <div className="editor-toolbar">
          <div>
            <strong>{selectedCells.size}</strong> actuator{selectedCells.size === 1 ? '' : 's'} selected
          </div>
          <div className="saved-actions">
            <button className="secondary" onClick={() => setSelectedCells(new Set())}>Clear Selection</button>
            <button className="secondary" onClick={() => setDraftGrid(cloneGrid(offsetGrid))}>Reset Changes</button>
          </div>
        </div>
        <WallGrid
          grid={draftGrid}
          interactive
          selectedCells={selectedCells}
          onCellPointer={handleCellPointer}
          onPointerUp={() => setSelectionStart(null)}
          minValue={-maxTrim}
          maxValue={maxTrim}
          formatValue={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`}
        />
        <div className="heat-legend">
          <span>{-maxTrim.toFixed(1)} mm trim</span>
          <span>{maxTrim.toFixed(1)} mm trim</span>
        </div>
        <label>
          Selected Trim Offset (mm)
          <input
            type="range"
            min={-maxTrim}
            max={maxTrim}
            step={0.05}
            value={averageTrim}
            onChange={(event) => updateSelectionTrim(Number(event.target.value))}
          />
          <input
            type="number"
            min={-maxTrim}
            max={maxTrim}
            step={0.05}
            value={averageTrim}
            onChange={(event) => updateSelectionTrim(Number(event.target.value))}
          />
        </label>
        <div className="callout subtle">
          Zero flat reference is currently {midpoint.toFixed(1)} mm. Trim values are added behind the
          scenes when converting logical displacement to physical servo commands.
        </div>
        <div className="saved-actions">
          <button onClick={() => onSave(draftGrid)}>Save as New Zero</button>
          <button className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
