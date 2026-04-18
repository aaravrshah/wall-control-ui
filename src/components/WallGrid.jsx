import { clamp } from '../utils/grid';

function cellColor(value) {
  const safe = clamp(value);
  const hue = 210 - safe * 180;
  const lightness = 22 + safe * 45;
  return `hsl(${hue}, 80%, ${lightness}%)`;
}

export default function WallGrid({
  grid,
  interactive = false,
  onCellPointer,
  onPointerUp,
  selectedCells = new Set(),
  compact = false,
}) {
  return (
    <div className={`wall-grid ${compact ? 'compact' : ''}`} onPointerUp={onPointerUp}>
      {grid.map((row, rowIndex) =>
        row.map((value, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const selected = selectedCells.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`cell ${selected ? 'selected' : ''}`}
              style={{ backgroundColor: cellColor(value) }}
              onPointerDown={() => interactive && onCellPointer?.(rowIndex, colIndex, true)}
              onPointerEnter={(event) => {
                if (interactive && event.buttons === 1) onCellPointer?.(rowIndex, colIndex, false);
              }}
            >
              <span>{value.toFixed(2)}</span>
            </button>
          );
        }),
      )}
    </div>
  );
}
