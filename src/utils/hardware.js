import { clamp, GRID_COLS, GRID_ROWS } from './grid';

export const DEFAULT_SERIAL_BAUD_RATE = 9600;
export const DEFAULT_CENTER_ANGLE = 90;
export const DEFAULT_CHANNEL_COUNT = GRID_ROWS * GRID_COLS;

export function flattenCellIndex(row, col) {
  return row * GRID_COLS + col;
}

export function flatIndexToCell(index) {
  return {
    row: Math.floor(index / GRID_COLS),
    col: index % GRID_COLS,
  };
}

export function formatCellLabel(row, col) {
  return `R${row + 1}-C${col + 1}`;
}

export function displacementMmToServoAngle(
  displacementMm,
  {
    maxDisplacementMm,
    servoMaxDegrees = 60,
    calibrationOffsetMm = 0,
    centerAngle = DEFAULT_CENTER_ANGLE,
  },
) {
  const safeMax = Math.max(0.001, maxDisplacementMm);
  const midpoint = safeMax / 2;
  const calibratedDisplacement = clamp(displacementMm + calibrationOffsetMm, 0, safeMax);
  const normalizedOffset = (calibratedDisplacement - midpoint) / Math.max(0.001, midpoint);
  return Math.round(clamp(centerAngle + normalizedOffset * servoMaxDegrees, 0, 180));
}

export function buildGridServoCommands(
  grid,
  {
    offsetGrid,
    maxDisplacementMm,
    servoMaxDegrees,
    cellStartIndex = 0,
    channelStart = 0,
    channelCount = DEFAULT_CHANNEL_COUNT,
  },
) {
  const commands = [];
  const maxCells = GRID_ROWS * GRID_COLS;
  const safeStart = clamp(cellStartIndex, 0, Math.max(0, maxCells - 1));
  const safeCount = Math.max(0, Math.min(channelCount, maxCells - safeStart));

  for (let index = 0; index < safeCount; index += 1) {
    const flatIndex = safeStart + index;
    const { row, col } = flatIndexToCell(flatIndex);
    const displacement = grid[row]?.[col] ?? 0;
    const trim = offsetGrid?.[row]?.[col] ?? 0;

    commands.push({
      channel: channelStart + index,
      angle: displacementMmToServoAngle(displacement, {
        maxDisplacementMm,
        servoMaxDegrees,
        calibrationOffsetMm: trim,
      }),
      row,
      col,
      label: formatCellLabel(row, col),
      displacement,
      trim,
    });
  }

  return commands;
}
