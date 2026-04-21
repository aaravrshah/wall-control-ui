import { clamp, GRID_COLS, GRID_ROWS } from './grid';

export const DEFAULT_SERIAL_BAUD_RATE = 9600;
export const DEFAULT_CENTER_ANGLE = 90;
export const DEFAULT_CHANNEL_COUNT = GRID_ROWS * GRID_COLS;
export const PHYSICAL_SERVO_INDEX_BY_CELL = [
  [31, 23, 30, 22, 29, 26, 28, 20, 27, 21, 19, 18, 25, 17, 24, 16],
  [15, 7, 14, 6, 13, 5, 12, 4, 11, 3, 10, 2, 9, 1, 8, 0],
  [55, 63, 54, 62, 53, 61, 52, 60, 51, 59, 50, 58, 49, 57, 48, 56],
  [39, 47, 38, 46, 37, 45, 36, 44, 35, 43, 34, 42, 33, 41, 32, 40],
];

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

export function getPhysicalServoIndex(row, col) {
  return PHYSICAL_SERVO_INDEX_BY_CELL[row]?.[col] ?? flattenCellIndex(row, col);
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
    const physicalServoIndex = getPhysicalServoIndex(row, col);

    commands.push({
      channel: channelStart + physicalServoIndex,
      angle: displacementMmToServoAngle(displacement, {
        maxDisplacementMm,
        servoMaxDegrees,
        calibrationOffsetMm: trim,
      }),
      row,
      col,
      label: formatCellLabel(row, col),
      servoNumber: physicalServoIndex + 1,
      displacement,
      trim,
    });
  }

  return commands;
}
