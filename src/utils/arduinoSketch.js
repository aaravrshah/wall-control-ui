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
  const servoMaxDegrees = clamp(numberOrDefault(experiment.servoMaxDegrees, 20), 1, 45);
  const tracks = experiment.motionTracks ?? [];

  return `#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

${formatSketchMetadata(experiment, tracks)}

Adafruit_PWMServoDriver pwmBoards[] = {
  Adafruit_PWMServoDriver(0x40),  // Physical row 2
  Adafruit_PWMServoDriver(0x41),  // Physical row 1
  Adafruit_PWMServoDriver(0x42),  // Physical row 4
  Adafruit_PWMServoDriver(0x43),  // Physical row 3
};

const int BOARD_COUNT = 4;
const int CHANNELS_PER_BOARD = 16;
const int TOTAL_SERVOS = 64;
const int GRID_ROWS = 4;
const int GRID_COLS = 16;

#define SERVOMIN   102
#define SERVOMAX   512
#define SERVO_FREQ 50

const float MAX_DISPLACEMENT_MM = ${formatNumber(maxDisplacementMm, 3)};
const float SERVO_MAX_DEGREES = ${formatNumber(servoMaxDegrees, 3)};
const int REFRESH_DELAY_MS = 20;

const float baseCenter = (SERVOMIN + SERVOMAX) / 2.0;
const float ticksPerDegree = (SERVOMAX - SERVOMIN) / 180.0;

// Boards 0x40/0x41 = CW positive displacement, boards 0x42/0x43 = CCW positive displacement.
const int DISPLACEMENT_SIGN_BY_BOARD[BOARD_COUNT] = {-1, -1, 1, 1};

const int PHYSICAL_ROW_BY_BOARD[BOARD_COUNT] = {
  1,  // 0x40 -> row 2
  0,  // 0x41 -> row 1
  3,  // 0x42 -> row 4
  2,  // 0x43 -> row 3
};

const float centerOffsetDegrees[TOTAL_SERVOS] = {
${formatOffsets()}
};

const float BASE_GRID_MM[GRID_ROWS][GRID_COLS] = {
${formatGridRows(experiment.grid)}
};

float centers[TOTAL_SERVOS];

int servoIndexToBoard(int servoIndex) {
  return servoIndex / CHANNELS_PER_BOARD;
}

int servoIndexToChannel(int servoIndex) {
  return servoIndex % CHANNELS_PER_BOARD;
}

int getPhysicalColumn(int boardIdx, int channel) {
  if (boardIdx == 0 || boardIdx == 1) {
    if (channel >= 8) return 2 * (15 - channel);
    return 15 - (2 * channel);
  }

  if (channel <= 7) return 2 * (7 - channel);
  return 1 + 2 * (15 - channel);
}

float positiveWave(float radians) {
  return 0.5 * (sinf(radians) + 1.0);
}

float mmToServoDegrees(float displacementMm) {
  return constrain(displacementMm, 0.0, MAX_DISPLACEMENT_MM) / MAX_DISPLACEMENT_MM * SERVO_MAX_DEGREES;
}

${formatTrackCode(tracks, maxDisplacementMm)}

float getDesignedDisplacementMm(int row, int col, float timeSec) {
  float displacementMm = BASE_GRID_MM[row][col];
${formatTrackApplication(tracks)}
  return constrain(displacementMm, 0.0, MAX_DISPLACEMENT_MM);
}

void driveServoDisplacement(int servoIndex, float displacementDegrees) {
  int boardIdx = servoIndexToBoard(servoIndex);
  float safeDisplacement = constrain(displacementDegrees, 0.0, SERVO_MAX_DEGREES);
  float signedDegrees = safeDisplacement * DISPLACEMENT_SIGN_BY_BOARD[boardIdx];
  float pwmValue = centers[servoIndex] + (signedDegrees * ticksPerDegree);

  pwmValue = constrain(pwmValue, SERVOMIN, SERVOMAX);
  pwmBoards[boardIdx].setPWM(servoIndexToChannel(servoIndex), 0, (int)pwmValue);
}

void initializeCenters() {
  for (int servoIndex = 0; servoIndex < TOTAL_SERVOS; servoIndex += 1) {
    centers[servoIndex] = baseCenter + (centerOffsetDegrees[servoIndex] * ticksPerDegree);
    centers[servoIndex] = constrain(centers[servoIndex], SERVOMIN, SERVOMAX);
  }
}

void setup() {
  Wire.begin();

  for (int boardIdx = 0; boardIdx < BOARD_COUNT; boardIdx += 1) {
    pwmBoards[boardIdx].begin();
    pwmBoards[boardIdx].setOscillatorFrequency(27000000);
    pwmBoards[boardIdx].setPWMFreq(SERVO_FREQ);
  }

  initializeCenters();
}

void loop() {
  static unsigned long startTime = millis();
  float timeSec = (millis() - startTime) / 1000.0;

  for (int servoIndex = 0; servoIndex < TOTAL_SERVOS; servoIndex += 1) {
    int boardIdx = servoIndexToBoard(servoIndex);
    int channel = servoIndexToChannel(servoIndex);
    int row = PHYSICAL_ROW_BY_BOARD[boardIdx];
    int col = getPhysicalColumn(boardIdx, channel);

    float displacementMm = getDesignedDisplacementMm(row, col, timeSec);
    driveServoDisplacement(servoIndex, mmToServoDegrees(displacementMm));
  }

  delay(REFRESH_DELAY_MS);
}
`;
}
