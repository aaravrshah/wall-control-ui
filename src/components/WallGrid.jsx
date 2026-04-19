import { clamp } from '../utils/grid';

function cellColor(value, minValue, maxValue) {
  const normalized = clamp((value - minValue) / Math.max(0.001, maxValue - minValue));
  const hue = 220 - normalized * 200;
  const saturation = 72;
  const lightness = 28 + normalized * 42;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export default function WallGrid({
  grid,
  interactive = false,
  onCellPointer,
  onPointerUp,
  selectedCells = new Set(),
  compact = false,
  minValue = 0,
  maxValue = 7,
  formatValue = (value) => value.toFixed(1),
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
              style={{ backgroundColor: cellColor(value, minValue, maxValue) }}
              onPointerDown={(event) => interactive && onCellPointer?.(rowIndex, colIndex, true, event)}
              onPointerEnter={(event) => {
                if (interactive && event.buttons === 1) onCellPointer?.(rowIndex, colIndex, false, event);
              }}
            >
              <span>{formatValue(value)}</span>
            </button>
          );
        }),
      )}
    </div>
  );
}
