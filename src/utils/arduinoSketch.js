import { GRID_COLS, GRID_ROWS, clamp } from './grid';
import {
  applyMotionTracks,
  getTrackMode,
  normalizeWaveSettings,
} from './patterns';

const CENTER_OFFSET_DEGREES = [
  10, 10, 0, 0, 0, -3, 5, 15, 10, 5, -85, -6, 13, 0, 12, 10,
  0, 5, -25, -5, 10, -15, 0, 0, -8, 8, -30, 0, 8, 0, -3, 6,
  -5, -12, -5, -2, -2, -15, -5, -5, -5, 12, -5, 10, 21, -3, -2, -15,
  15, 10, 5, 3, 5, -10, 7, -2, 5, 10, 3, 20, 5, 5, 15, 20,
];

const TEMPLATE_AMPLITUDE_DEGREES = 20;
const TEMPLATE_TRAVEL_MM = 5;
const DEFAULT_WAVE_FREQ_HZ = 1;
const DEFAULT_PHASE_INCREMENT_RADIANS = Math.PI / 4;
const DEGREES_PER_MM = TEMPLATE_AMPLITUDE_DEGREES / TEMPLATE_TRAVEL_MM;

function formatNumber(value, digits = 3) {
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

function numberOrDefault(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function commentValue(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function formatSketchMetadata(experiment, tracks) {
  return [
    '// WALL_CONTROL_UI_EXPORT_VERSION: 1',
    `// WALL_CONTROL_UI_EXPERIMENT_NAME: ${commentValue(experiment.name || 'Imported Experiment')}`,
    ...tracks.map((track, index) => `// WALL_CONTROL_UI_TRACK_${index}_NAME: ${commentValue(track.name || `Track ${index + 1}`)}`),
  ].join('\n');
}

function metadataValue(sketch, key) {
  const match = sketch.match(new RegExp(`^\\s*//\\s*${key}:\\s*(.*)$`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function parseNumbers(value) {
  return [...String(value).matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function extractBalancedBlock(text, braceStart, label) {
  let depth = 0;
  for (let index = braceStart; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(braceStart + 1, index);
      }
    }
  }
  throw new Error(`Could not read ${label}.`);
}

function extractInitializer(sketch, declarationPattern, label) {
  const match = declarationPattern.exec(sketch);
  if (!match) {
    throw new Error(`Could not find ${label}.`);
  }

  const braceStart = sketch.indexOf('{', match.index);
  if (braceStart < 0) {
    throw new Error(`Could not read ${label}.`);
  }

  return extractBalancedBlock(sketch, braceStart, label);
}

function extractFunctionBody(sketch, functionName) {
  const match = new RegExp(`\\b(?:bool|float)\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{`).exec(sketch);
  if (!match) {
    return null;
  }

  const braceStart = sketch.indexOf('{', match.index);
  return extractBalancedBlock(sketch, braceStart, functionName);
}

function readRequiredNumber(sketch, pattern, label) {
  const match = pattern.exec(sketch);
  if (!match) {
    throw new Error(`Could not find ${label}.`);
  }

  return numberOrDefault(match[1], 0);
}

function readOptionalNumber(sketch, pattern, fallback = 0) {
  const match = pattern.exec(sketch);
  return match ? numberOrDefault(match[1], fallback) : fallback;
}

function parseBaseGrid(sketch) {
  const body = extractInitializer(
    sketch,
    /const\s+float\s+BASE_GRID_MM\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=/,
    'base grid',
  );
  const rows = [...body.matchAll(/\{([^{}]+)\}/g)].map((match) => parseNumbers(match[1]));

  if (rows.length !== GRID_ROWS || rows.some((row) => row.length !== GRID_COLS)) {
    throw new Error(`Expected a ${GRID_ROWS} x ${GRID_COLS} base grid.`);
  }

  return rows;
}

function parseMatrix(sketch, declarationPattern, label) {
  const body = extractInitializer(sketch, declarationPattern, label);
  const rows = [...body.matchAll(/\{([^{}]+)\}/g)].map((match) => parseNumbers(match[1]));

  if (rows.length !== GRID_ROWS || rows.some((row) => row.length !== GRID_COLS)) {
    throw new Error(`Expected a ${GRID_ROWS} x ${GRID_COLS} ${label}.`);
  }

  return rows;
}

function radiansToDegrees(radians) {
  const degrees = numberOrDefault(radians, 0) * 180 / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

function parsePerActuatorSineSketch(source) {
  const templateAmplitudeDegrees = readOptionalNumber(
    source,
    /const\s+float\s+WAVE_AMPLITUDE_DEGREES\s*=\s*(-?\d+(?:\.\d+)?)/,
    TEMPLATE_AMPLITUDE_DEGREES,
  );
  const templateTravelMm = readOptionalNumber(
    source,
    /const\s+float\s+TEMPLATE_TRAVEL_MM\s*=\s*(-?\d+(?:\.\d+)?)/,
    TEMPLATE_TRAVEL_MM,
  );
  const degreesPerMm = templateTravelMm > 0 ? templateAmplitudeDegrees / templateTravelMm : DEGREES_PER_MM;
  const amplitudeDegrees = parseMatrix(
    source,
    /const\s+float\s+AMPLITUDE_DEGREES_BY_CELL\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=/,
    'amplitude table',
  );
  const frequencyHz = parseMatrix(
    source,
    /const\s+float\s+FREQUENCY_HZ_BY_CELL\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=/,
    'frequency table',
  );
  const phaseRadians = parseMatrix(
    source,
    /const\s+float\s+PHASE_RADIANS_BY_CELL\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=/,
    'phase table',
  );
  const grid = amplitudeDegrees.map((row) =>
    row.map((value) => Number((Math.max(0, value) / degreesPerMm).toFixed(2))),
  );
  const maxGridDisplacement = Math.max(0, ...grid.flat());
  const maxDisplacementMm = Math.max(
    maxGridDisplacement,
    readOptionalNumber(
      source,
      /const\s+float\s+MAX_DISPLACEMENT_MM\s*=\s*(-?\d+(?:\.\d+)?)/,
      Math.max(7, maxGridDisplacement),
    ),
  );
  const groups = new Map();

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const amplitudeMm = grid[row][col];
      if (amplitudeMm <= 0.01) continue;
      const frequency = numberOrDefault(frequencyHz[row][col], DEFAULT_WAVE_FREQ_HZ);
      const phaseDegrees = radiansToDegrees(phaseRadians[row][col]);
      const key = [
        amplitudeMm.toFixed(2),
        frequency.toFixed(3),
        phaseDegrees.toFixed(3),
      ].join('|');
      const group = groups.get(key) ?? {
        amplitudeMm,
        frequencyHz: frequency,
        phaseLagDegrees: phaseDegrees,
        targetCellKeys: [],
      };
      group.targetCellKeys.push(`${row}-${col}`);
      groups.set(key, group);
    }
  }

  return {
    id: 'current-experiment',
    name: metadataValue(source, 'WALL_CONTROL_UI_EXPERIMENT_NAME') || 'Imported Arduino Sketch',
    grid,
    motionTracks: [...groups.values()].map((group, index) => ({
      id: `imported-sine-${index}`,
      name: `Imported Sine ${index + 1}`,
      mode: 'wave',
      targetCellKeys: group.targetCellKeys,
      points: [],
      wave: normalizeWaveSettings({
        baselineMm: 0,
        amplitudeMm: group.amplitudeMm,
        frequencyHz: group.frequencyHz,
        phaseLagDegrees: group.phaseLagDegrees,
        cycles: 0,
      }, maxDisplacementMm),
    })),
    notes: 'Imported from per-actuator sine Arduino sketch.',
    maxDisplacementMm,
    servoMaxDegrees: templateAmplitudeDegrees,
  };
}

function parseTrackTargets(sketch, index) {
  const body = extractFunctionBody(sketch, `isTrack${index}Target`);
  if (!body) {
    return [];
  }

  return [...body.matchAll(/row\s*==\s*(\d+)\s*&&\s*col\s*==\s*(\d+)/g)]
    .map((match) => `${Number(match[1])}-${Number(match[2])}`);
}

function parseTrackArray(sketch, index, name, label) {
  const body = extractInitializer(
    sketch,
    new RegExp(`const\\s+(?:float|int)\\s+TRACK_${index}_${name}\\s*(?:\\[[^\\]]*\\])*\\s*=`),
    label,
  );
  return parseNumbers(body);
}

function parseWaveTrack(sketch, index, targets, baseTrackName, maxDisplacementMm) {
  const wave = {
    baselineMm: readRequiredNumber(sketch, new RegExp(`const\\s+float\\s+TRACK_${index}_BASELINE_MM\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`), `track ${index + 1} baseline`),
    amplitudeMm: readRequiredNumber(sketch, new RegExp(`const\\s+float\\s+TRACK_${index}_AMPLITUDE_MM\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`), `track ${index + 1} amplitude`),
    frequencyHz: readRequiredNumber(sketch, new RegExp(`const\\s+float\\s+TRACK_${index}_FREQUENCY_HZ\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`), `track ${index + 1} frequency`),
    phaseLagDegrees: readOptionalNumber(sketch, new RegExp(`const\\s+float\\s+TRACK_${index}_PHASE_LAG_DEGREES\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`), 0),
    cycles: readOptionalNumber(sketch, new RegExp(`const\\s+float\\s+TRACK_${index}_CYCLES\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`), 0),
  };

  return [{
    id: `imported-wave-${index}`,
    name: baseTrackName,
    mode: 'wave',
    targetCellKeys: targets,
    points: [],
    wave: normalizeWaveSettings(wave, maxDisplacementMm),
  }];
}

function parsePointTrack(sketch, index, targets, baseTrackName, maxDisplacementMm) {
  const pointCount = readRequiredNumber(sketch, new RegExp(`const\\s+int\\s+TRACK_${index}_POINT_COUNT\\s*=\\s*(\\d+)`), `track ${index + 1} point count`);
  const times = parseTrackArray(sketch, index, 'TIMES', `track ${index + 1} times`);
  const displacements = parseTrackArray(sketch, index, 'DISPLACEMENTS_MM', `track ${index + 1} displacements`);
  const interpolation = parseTrackArray(sketch, index, 'INTERPOLATION', `track ${index + 1} interpolation`);

  return {
    id: `imported-points-${index}`,
    name: baseTrackName,
    mode: 'points',
    targetCellKeys: targets,
    points: Array.from({ length: pointCount }, (_, pointIndex) => ({
      id: `imported-${index}-point-${pointIndex}`,
      timeSec: Math.max(0, numberOrDefault(times[pointIndex], 0)),
      displacement: clamp(numberOrDefault(displacements[pointIndex], 0), 0, maxDisplacementMm),
      interpolationToNext: interpolation[pointIndex] === 1 ? 'sine' : 'linear',
    })),
  };
}

export function parseArduinoSketch(sketch) {
  const source = String(sketch ?? '');
  if (/AMPLITUDE_DEGREES_BY_CELL/.test(source)) {
    return parsePerActuatorSineSketch(source);
  }

  const maxDisplacementMm = Math.max(0.1, readRequiredNumber(
    source,
    /const\s+float\s+MAX_DISPLACEMENT_MM\s*=\s*(-?\d+(?:\.\d+)?)/,
    'maximum displacement',
  ));
  const servoMaxDegrees = clamp(readRequiredNumber(
    source,
    /const\s+float\s+SERVO_MAX_DEGREES\s*=\s*(-?\d+(?:\.\d+)?)/,
    'servo range',
  ), 1, 45);
  const grid = parseBaseGrid(source);
  const trackIndices = [...new Set([...source.matchAll(/TRACK_(\d+)_/g)].map((match) => Number(match[1])))]
    .sort((left, right) => left - right);

  const motionTracks = trackIndices.flatMap((index) => {
    const targets = parseTrackTargets(source, index);
    const baseTrackName = metadataValue(source, `WALL_CONTROL_UI_TRACK_${index}_NAME`) || `Track ${index + 1}`;
    const isWave = new RegExp(`TRACK_${index}_BASELINE_MM`).test(source);
    const isPoint = new RegExp(`TRACK_${index}_POINT_COUNT`).test(source);

    if (isWave) {
      return parseWaveTrack(source, index, targets, baseTrackName, maxDisplacementMm);
    }

    if (isPoint) {
      return [parsePointTrack(source, index, targets, baseTrackName, maxDisplacementMm)];
    }

    return [];
  });

  return {
    id: 'current-experiment',
    name: metadataValue(source, 'WALL_CONTROL_UI_EXPERIMENT_NAME') || 'Imported Arduino Sketch',
    grid,
    motionTracks,
    notes: 'Imported from Arduino sketch.',
    maxDisplacementMm,
    servoMaxDegrees,
  };
}

function formatOffsets() {
  const rows = [];
  for (let index = 0; index < CENTER_OFFSET_DEGREES.length; index += 16) {
    rows.push(`  ${CENTER_OFFSET_DEGREES.slice(index, index + 16).join(', ')}`);
  }
  return rows.join(',\n');
}

function formatGridRows(grid) {
  return Array.from({ length: GRID_ROWS }, (_, row) => {
    const values = Array.from({ length: GRID_COLS }, (_, col) => formatNumber(numberOrDefault(grid[row]?.[col], 0), 3));
    return `  {${values.join(', ')}}`;
  }).join(',\n');
}

function formatMatrixRows(grid, digits = 3) {
  return Array.from({ length: GRID_ROWS }, (_, row) => {
    const values = Array.from({ length: GRID_COLS }, (_, col) => formatNumber(numberOrDefault(grid[row]?.[col], 0), digits));
    return `  {${values.join(', ')}}`;
  }).join(',\n');
}

function createNumberGrid(fillValue = 0) {
  return Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => fillValue));
}

function getKeyPosition(key) {
  const [row, col] = String(key).split('-').map(Number);
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS
    ? { row, col }
    : null;
}

function pointTrackFrequencyHz(track) {
  const durationSec = Math.max(0, ...(track.points ?? []).map((point) => numberOrDefault(point.timeSec, 0)));
  return durationSec > 0 ? 1 / durationSec : DEFAULT_WAVE_FREQ_HZ;
}

function pointTrackAmplitudeMm(track, maxDisplacementMm) {
  return clamp(
    Math.max(0, ...(track.points ?? []).map((point) => numberOrDefault(point.displacement, 0))),
    0,
    maxDisplacementMm,
  );
}

function buildPerActuatorWaveTables(experiment, maxDisplacementMm) {
  const amplitudeMm = createNumberGrid(0);
  const frequencyHz = createNumberGrid(0);
  const phaseRadians = createNumberGrid(0);

  (experiment.grid ?? []).forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const displacementMm = clamp(numberOrDefault(value, 0), 0, maxDisplacementMm);
      amplitudeMm[rowIndex][colIndex] = displacementMm;
      frequencyHz[rowIndex][colIndex] = displacementMm > 0 ? DEFAULT_WAVE_FREQ_HZ : 0;
      phaseRadians[rowIndex][colIndex] = colIndex * DEFAULT_PHASE_INCREMENT_RADIANS;
    });
  });

  (experiment.motionTracks ?? []).forEach((track) => {
    if (getTrackMode(track) === 'wave') {
      const wave = normalizeWaveSettings(track.wave, maxDisplacementMm);
      (track.targetCellKeys ?? []).forEach((key) => {
        const position = getKeyPosition(key);
        if (!position) return;
        amplitudeMm[position.row][position.col] = wave.amplitudeMm;
        frequencyHz[position.row][position.col] = wave.frequencyHz;
        phaseRadians[position.row][position.col] = wave.phaseLagDegrees * Math.PI / 180;
      });
      return;
    }

    const amplitude = pointTrackAmplitudeMm(track, maxDisplacementMm);
    const frequency = pointTrackFrequencyHz(track);
    (track.targetCellKeys ?? []).forEach((key) => {
      const position = getKeyPosition(key);
      if (!position) return;
      amplitudeMm[position.row][position.col] = amplitude;
      frequencyHz[position.row][position.col] = frequency;
      phaseRadians[position.row][position.col] = 0;
    });
  });

  return {
    amplitudeMm,
    amplitudeDegrees: amplitudeMm.map((row) => row.map((value) => value * DEGREES_PER_MM)),
    frequencyHz,
    phaseRadians,
  };
}

function formatCellPredicate(track, functionName) {
  const targets = track.targetCellKeys ?? [];
  if (targets.length === 0) {
    return `bool ${functionName}(int row, int col) {
  return false;
}`;
  }

  const conditions = targets.map((key) => {
    const [row, col] = key.split('-').map(Number);
    return `    (row == ${row} && col == ${col})`;
  });

  return `bool ${functionName}(int row, int col) {
  return
${conditions.join(' ||\n')};
}`;
}

function formatPointTrack(track, index, maxDisplacementMm) {
  const points = [...(track.points ?? [])].sort((a, b) => a.timeSec - b.timeSec);
  const safePoints = points.length > 0
    ? points
    : [{ timeSec: 0, displacement: 0, interpolationToNext: 'linear' }];
  const times = safePoints.map((point) => formatNumber(Math.max(0, numberOrDefault(point.timeSec, 0)), 3)).join(', ');
  const displacements = safePoints
    .map((point) => formatNumber(clamp(numberOrDefault(point.displacement, 0), 0, maxDisplacementMm), 3))
    .join(', ');
  const modes = safePoints.slice(0, -1)
    .map((point) => (point.interpolationToNext === 'sine' ? 1 : 0))
    .join(', ') || '0';

  return `${formatCellPredicate(track, `isTrack${index}Target`)}

const int TRACK_${index}_POINT_COUNT = ${safePoints.length};
const float TRACK_${index}_TIMES[TRACK_${index}_POINT_COUNT] = {${times}};
const float TRACK_${index}_DISPLACEMENTS_MM[TRACK_${index}_POINT_COUNT] = {${displacements}};
const int TRACK_${index}_INTERPOLATION[${Math.max(1, safePoints.length - 1)}] = {${modes}};

float track${index}DisplacementMm(int row, int col, float timeSec) {
  if (TRACK_${index}_POINT_COUNT <= 0) return BASE_GRID_MM[row][col];
  if (timeSec <= TRACK_${index}_TIMES[0]) return TRACK_${index}_DISPLACEMENTS_MM[0];

  for (int pointIndex = 0; pointIndex < TRACK_${index}_POINT_COUNT - 1; pointIndex += 1) {
    float startTime = TRACK_${index}_TIMES[pointIndex];
    float endTime = TRACK_${index}_TIMES[pointIndex + 1];

    if (timeSec <= endTime) {
      float span = max(0.001, endTime - startTime);
      float t = constrain((timeSec - startTime) / span, 0.0, 1.0);
      if (TRACK_${index}_INTERPOLATION[pointIndex] == 1) {
        t = 0.5 - (0.5 * cos(PI * t));
      }
      return constrain(
        TRACK_${index}_DISPLACEMENTS_MM[pointIndex] + ((TRACK_${index}_DISPLACEMENTS_MM[pointIndex + 1] - TRACK_${index}_DISPLACEMENTS_MM[pointIndex]) * t),
        0.0,
        MAX_DISPLACEMENT_MM
      );
    }
  }

  return constrain(TRACK_${index}_DISPLACEMENTS_MM[TRACK_${index}_POINT_COUNT - 1], 0.0, MAX_DISPLACEMENT_MM);
}`;
}

function formatWaveTrack(track, index, maxDisplacementMm) {
  const wave = normalizeWaveSettings(track.wave, maxDisplacementMm);
  return `${formatCellPredicate(track, `isTrack${index}Target`)}

const float TRACK_${index}_BASELINE_MM = ${formatNumber(wave.baselineMm, 3)};
const float TRACK_${index}_AMPLITUDE_MM = ${formatNumber(wave.amplitudeMm, 3)};
const float TRACK_${index}_FREQUENCY_HZ = ${formatNumber(wave.frequencyHz, 3)};
const float TRACK_${index}_PHASE_LAG_DEGREES = ${formatNumber(wave.phaseLagDegrees, 3)};
const float TRACK_${index}_CYCLES = ${formatNumber(wave.cycles, 3)};

float track${index}DisplacementMm(int row, int col, float timeSec) {
  float durationSec = TRACK_${index}_CYCLES > 0.0 ? TRACK_${index}_CYCLES / TRACK_${index}_FREQUENCY_HZ : -1.0;
  if (durationSec > 0.0 && timeSec > durationSec) {
    return TRACK_${index}_BASELINE_MM;
  }

  float phaseRadians = (2.0 * PI * TRACK_${index}_FREQUENCY_HZ * timeSec) + (TRACK_${index}_PHASE_LAG_DEGREES * PI / 180.0);
  return constrain(TRACK_${index}_BASELINE_MM + (TRACK_${index}_AMPLITUDE_MM * positiveWave(phaseRadians)), 0.0, MAX_DISPLACEMENT_MM);
}`;
}

function formatTrackCode(tracks, maxDisplacementMm) {
  if (tracks.length === 0) {
    return '// No motion tracks defined. The sketch holds BASE_GRID_MM.';
  }

  return tracks.map((track, index) =>
    getTrackMode(track) === 'wave'
      ? formatWaveTrack(track, index, maxDisplacementMm)
      : formatPointTrack(track, index, maxDisplacementMm),
  ).join('\n\n');
}

function formatTrackApplication(tracks) {
  if (tracks.length === 0) {
    return '';
  }

  return tracks.map((_, index) => `  if (isTrack${index}Target(row, col)) {
    displacementMm = track${index}DisplacementMm(row, col, timeSec);
  }`).join('\n');
}

export function sampleGeneratedSketchGrid(experiment, timeSec) {
  return applyMotionTracks(
    experiment.grid,
    experiment.motionTracks ?? [],
    timeSec,
    experiment.maxDisplacementMm,
  ).map((row) => row.map((value) => Number(value.toFixed(2))));
}

export function generateArduinoSketch(experiment) {
  const maxDisplacementMm = Math.max(0.1, numberOrDefault(experiment.maxDisplacementMm, 7));
  const tracks = experiment.motionTracks ?? [];
  const waveTables = buildPerActuatorWaveTables(experiment, maxDisplacementMm);

  return `#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

${formatSketchMetadata(experiment, tracks)}

// --- Hardware Setup ---
Adafruit_PWMServoDriver pwmBoards[] = {
  Adafruit_PWMServoDriver(0x40),  // Row 2
  Adafruit_PWMServoDriver(0x41),  // Row 1
  Adafruit_PWMServoDriver(0x42),  // Row 4
  Adafruit_PWMServoDriver(0x43),  // Row 3
};

const int BOARD_COUNT = 4;
const int CHANNELS_PER_BOARD = 16;
const int TOTAL_SERVOS = 64;
const int GRID_ROWS = 4;
const int GRID_COLS = 16;

#define SERVOMIN   102
#define SERVOMAX   512
#define SERVO_FREQ 50

// --- Wave Parameters ---
const float MAX_DISPLACEMENT_MM = ${formatNumber(maxDisplacementMm, 3)};
const float WAVE_AMPLITUDE_DEGREES = ${formatNumber(TEMPLATE_AMPLITUDE_DEGREES, 3)};
const float TEMPLATE_TRAVEL_MM = ${formatNumber(TEMPLATE_TRAVEL_MM, 3)};
const float DEGREES_PER_MM = WAVE_AMPLITUDE_DEGREES / TEMPLATE_TRAVEL_MM;

// Boards 0x40/0x41 = CW (-1), boards 0x42/0x43 = CCW (+1).
const int DISPLACEMENT_SIGN_BY_BOARD[BOARD_COUNT] = {-1, -1, 1, 1};

// --- Static Calibration Offsets ---
const float centerOffsetDegrees[TOTAL_SERVOS] = {
${formatOffsets()}
};

// Per-actuator wave tables. Amplitude is generated from mm using 20 degrees / 5 mm.
const float AMPLITUDE_DEGREES_BY_CELL[GRID_ROWS][GRID_COLS] = {
${formatMatrixRows(waveTables.amplitudeDegrees)}
};

const float FREQUENCY_HZ_BY_CELL[GRID_ROWS][GRID_COLS] = {
${formatMatrixRows(waveTables.frequencyHz)}
};

const float PHASE_RADIANS_BY_CELL[GRID_ROWS][GRID_COLS] = {
${formatMatrixRows(waveTables.phaseRadians, 6)}
};

float centers[TOTAL_SERVOS];
const float baseCenter = (SERVOMIN + SERVOMAX) / 2.0;
const float ticksPerDegree = (SERVOMAX - SERVOMIN) / 180.0;

int getPhysicalColumn(int boardIdx, int channel) {
  if (boardIdx == 0 || boardIdx == 1) {
    if (channel >= 8) return 2 * (15 - channel);
    return 15 - (2 * channel);
  }

  if (channel <= 7) return 2 * (7 - channel);
  return 1 + 2 * (15 - channel);
}

int getPhysicalRow(int boardIdx) {
  if (boardIdx == 0) return 1;
  if (boardIdx == 1) return 0;
  if (boardIdx == 2) return 3;
  return 2;
}

void setup() {
  Serial.begin(9600);
  Wire.begin();

  for (int boardIdx = 0; boardIdx < BOARD_COUNT; boardIdx += 1) {
    pwmBoards[boardIdx].begin();
    pwmBoards[boardIdx].setOscillatorFrequency(27000000);
    pwmBoards[boardIdx].setPWMFreq(SERVO_FREQ);
  }

  for (int i = 0; i < TOTAL_SERVOS; i += 1) {
    centers[i] = baseCenter + (centerOffsetDegrees[i] * ticksPerDegree);
    centers[i] = constrain(centers[i], SERVOMIN, SERVOMAX);
  }

  Serial.println("System Ready: Wave starting...");
}

void loop() {
  static unsigned long startTime = millis();
  float t = (millis() - startTime) / 1000.0;

  for (int i = 0; i < TOTAL_SERVOS; i += 1) {
    int boardIdx = i / CHANNELS_PER_BOARD;
    int channel = i % CHANNELS_PER_BOARD;
    int row = getPhysicalRow(boardIdx);
    int col = getPhysicalColumn(boardIdx, channel);

    float WAVE_FREQ = FREQUENCY_HZ_BY_CELL[row][col];
    float WAVE_AMPLITUDE_DEGREES = AMPLITUDE_DEGREES_BY_CELL[row][col];
    float phase = PHASE_RADIANS_BY_CELL[row][col];

    float angle = WAVE_AMPLITUDE_DEGREES * sin(2.0 * PI * WAVE_FREQ * t + phase);
    float pwmVal = centers[i] + (angle * ticksPerDegree * DISPLACEMENT_SIGN_BY_BOARD[boardIdx]);
    pwmBoards[boardIdx].setPWM(channel, 0, (int)constrain(pwmVal, SERVOMIN, SERVOMAX));
  }

  delay(20);
}
`;
}
