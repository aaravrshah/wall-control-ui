import { GRID_COLS, GRID_ROWS, clamp, createEmptyGrid } from './grid';

export const PRESET_KEYS = {
  FLAT: 'flat-wall',
  GLOBAL_SINE: 'global-sine',
  TRAVEL_DOWN: 'traveling-wave-downstream',
  TRAVEL_UP: 'traveling-wave-upstream',
  STANDING: 'standing-wave',
  PULSE: 'single-pulse-bump',
  BANDS: 'alternating-bands',
  ROUGHNESS: 'random-roughness-snapshot',
  CUSTOM: 'saved-custom-pattern',
};

export function generatePatternGrid(preset, params = {}, timeSec = 0) {
  const amplitude = Number(params.amplitude ?? 0.5);
  const frequency = Number(params.frequency ?? 0.5);
  const base = createEmptyGrid();

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const x = col / (GRID_COLS - 1);
      let value = 0;

      switch (preset) {
        case PRESET_KEYS.FLAT:
          value = 0.5;
          break;
        case PRESET_KEYS.GLOBAL_SINE:
          value = 0.5 + amplitude * 0.5 * Math.sin(2 * Math.PI * frequency * timeSec);
          break;
        case PRESET_KEYS.TRAVEL_DOWN:
          value = 0.5 + amplitude * 0.5 * Math.sin(2 * Math.PI * (frequency * timeSec - x));
          break;
        case PRESET_KEYS.TRAVEL_UP:
          value = 0.5 + amplitude * 0.5 * Math.sin(2 * Math.PI * (frequency * timeSec + x));
          break;
        case PRESET_KEYS.STANDING:
          value = 0.5 + amplitude * 0.5 * Math.sin(2 * Math.PI * x) * Math.sin(2 * Math.PI * frequency * timeSec);
          break;
        case PRESET_KEYS.PULSE: {
          const center = ((timeSec * frequency) % 1) * (GRID_COLS - 1);
          const spread = 2;
          const distance = Math.abs(col - center);
          value = 0.2 + amplitude * Math.exp(-distance ** 2 / (2 * spread ** 2));
          break;
        }
        case PRESET_KEYS.BANDS:
          value = (Math.floor(col / 2) + row) % 2 === 0 ? 0.2 : 0.8;
          break;
        case PRESET_KEYS.ROUGHNESS:
          value = 0.35 + 0.3 * Math.sin(13 * x + row * 0.7) + 0.15 * Math.cos(7 * x + timeSec * frequency);
          break;
        default:
          value = base[row][col] ?? 0.5;
      }

      base[row][col] = clamp(value);
    }
  }

  return base;
}

export function interpolateGrids(startGrid, endGrid, t) {
  return startGrid.map((row, rowIndex) =>
    row.map((value, colIndex) => clamp(value + (endGrid[rowIndex][colIndex] - value) * t)),
  );
}
