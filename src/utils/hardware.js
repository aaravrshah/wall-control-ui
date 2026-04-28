import { GRID_COLS, GRID_ROWS, clamp } from './grid';

export const DEFAULT_SERIAL_BAUD_RATE = 9600;
export const FRAME_MAX_DISPLACEMENT_DEGREES = 28;
export const DEFAULT_FRAME_INTERVAL_MS = 700;
export const SUPPORTED_PATTERN_COMMANDS = ['flat', 'sine', 'diag', 'uiuc'];

function formatFrameValue(value) {
  return String(Math.round(value));
}

export function gridMmToArduinoDegrees(displacementMm, maxDisplacementMm) {
  const safeMax = Math.max(0.001, Number(maxDisplacementMm) || 0.001);
  const normalized = clamp(Number(displacementMm) || 0, 0, safeMax) / safeMax;
  return clamp(normalized * FRAME_MAX_DISPLACEMENT_DEGREES, 0, FRAME_MAX_DISPLACEMENT_DEGREES);
}

export function buildGridFrameCommand(grid, { maxDisplacementMm } = {}) {
  const values = [];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      values.push(formatFrameValue(gridMmToArduinoDegrees(grid[row]?.[col] ?? 0, maxDisplacementMm)));
    }
  }

  return {
    command: `frame:${values.join(',')}\n`,
    valueCount: values.length,
    maxDegrees: FRAME_MAX_DISPLACEMENT_DEGREES,
  };
}

export function normalizePatternCommand(pattern) {
  const normalized = String(pattern ?? '').trim().toLowerCase();
  return SUPPORTED_PATTERN_COMMANDS.includes(normalized) ? normalized : 'flat';
}
