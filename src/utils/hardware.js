import { GRID_COLS, GRID_ROWS, clamp } from './grid';
import { applyMotionTracks, getMotionForwardDuration } from './patterns';

export const DEFAULT_SERIAL_BAUD_RATE = 115200;
export const FRAME_MAX_DISPLACEMENT_DEGREES = 28;
export const PROGRAM_UPLOAD_LINE_DELAY_MS = 8;
export const MAX_PROGRAM_FRAMES = 20;
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
  const values = buildGridFrameValues(grid, { maxDisplacementMm });

  return {
    command: `frame:${values.join(',')}\n`,
    valueCount: values.length,
    maxDegrees: FRAME_MAX_DISPLACEMENT_DEGREES,
  };
}

export function buildGridFrameValues(grid, { maxDisplacementMm } = {}) {
  const values = [];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      values.push(formatFrameValue(gridMmToArduinoDegrees(grid[row]?.[col] ?? 0, maxDisplacementMm)));
    }
  }

  return values;
}

function getProgramTimes(experiment) {
  const forwardDuration = getMotionForwardDuration(experiment.motionTracks);
  const timeSet = new Set([0, forwardDuration]);

  (experiment.motionTracks ?? []).forEach((track) => {
    (track.points ?? []).forEach((point) => {
      const timeSec = Number(point.timeSec);
      if (Number.isFinite(timeSec) && timeSec >= 0 && timeSec <= forwardDuration) {
        timeSet.add(timeSec);
      }
    });
  });

  const keyTimes = [...timeSet].sort((a, b) => a - b);
  if (keyTimes.length <= MAX_PROGRAM_FRAMES) {
    return keyTimes;
  }

  return Array.from({ length: MAX_PROGRAM_FRAMES }, (_, index) =>
    (forwardDuration * index) / Math.max(1, MAX_PROGRAM_FRAMES - 1),
  );
}

export function buildArduinoProgramCommands(experiment) {
  const times = getProgramTimes(experiment);
  const maxDisplacementMm = experiment.maxDisplacementMm;
  const commands = [
    'prog clear\n',
    `prog begin ${times.length}\n`,
  ];

  times.forEach((timeSec, index) => {
    const grid = applyMotionTracks(
      experiment.grid,
      experiment.motionTracks ?? [],
      timeSec,
      maxDisplacementMm,
    );
    const values = buildGridFrameValues(grid, { maxDisplacementMm });
    commands.push(`prog frame ${index} ${Math.round(timeSec * 1000)}:${values.join(',')}\n`);
  });

  commands.push('prog play\n');
  return commands;
}

export function normalizePatternCommand(pattern) {
  const normalized = String(pattern ?? '').trim().toLowerCase();
  return SUPPORTED_PATTERN_COMMANDS.includes(normalized) ? normalized : 'flat';
}
