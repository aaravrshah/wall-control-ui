import { GRID_COLS, GRID_ROWS, clamp, createEmptyGrid } from './grid';

export const DEFAULT_SKETCH_PARAMS = {
  frequencyHz: 1,
  amplitudeDegrees: 28,
  columnPhaseDegrees: 45,
  rowPhaseDegrees: 90,
  globalPhaseDegrees: 0,
  refreshDelayMs: 20,
};

const CENTER_OFFSET_DEGREES = [
  10, 10, 0, 0, 0, -3, 5, 15, 10, 5, -85, -6, 13, 0, 12, 10,
  0, 5, -25, -5, 10, -15, 0, 0, -8, 8, -30, 0, 8, 0, -3, 6,
  -5, -12, -5, -2, -2, -15, -5, -5, -5, 12, -5, 10, 21, -3, -2, -15,
  15, 10, 5, 3, 5, -10, 7, -2, 5, 10, 3, 20, 5, 5, 15, 20,
];

function formatNumber(value, digits = 3) {
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

function toRadians(degrees) {
  return (Number(degrees) || 0) * (Math.PI / 180);
}

function positiveWave(radians) {
  return 0.5 * (Math.sin(radians) + 1);
}

function numberOrDefault(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeParams(params = {}) {
  return {
    frequencyHz: clamp(numberOrDefault(params.frequencyHz, DEFAULT_SKETCH_PARAMS.frequencyHz), 0.01, 5),
    amplitudeDegrees: clamp(numberOrDefault(params.amplitudeDegrees, DEFAULT_SKETCH_PARAMS.amplitudeDegrees), 0, 28),
    columnPhaseDegrees: clamp(numberOrDefault(params.columnPhaseDegrees, DEFAULT_SKETCH_PARAMS.columnPhaseDegrees), -360, 360),
    rowPhaseDegrees: clamp(numberOrDefault(params.rowPhaseDegrees, DEFAULT_SKETCH_PARAMS.rowPhaseDegrees), -360, 360),
    globalPhaseDegrees: clamp(numberOrDefault(params.globalPhaseDegrees, DEFAULT_SKETCH_PARAMS.globalPhaseDegrees), -360, 360),
    refreshDelayMs: clamp(numberOrDefault(params.refreshDelayMs, DEFAULT_SKETCH_PARAMS.refreshDelayMs), 5, 100),
  };
}

function getAmplitudeMask(grid, maxDisplacementMm) {
  const safeMax = Math.max(0.001, Number(maxDisplacementMm) || 0.001);
  return Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLS }, (_, col) => clamp((Number(grid[row]?.[col]) || 0) / safeMax, 0, 1)),
  );
}

function formatMaskRows(mask) {
  return mask
    .map((row) => `  {${row.map((value) => formatNumber(value, 3)).join(', ')}}`)
    .join(',\n');
}

function formatOffsets() {
  const rows = [];
  for (let index = 0; index < CENTER_OFFSET_DEGREES.length; index += 16) {
    rows.push(`  ${CENTER_OFFSET_DEGREES.slice(index, index + 16).join(', ')}`);
  }
  return rows.join(',\n');
}

export function sampleGeneratedSketchGrid(grid, maxDisplacementMm, params, timeSec) {
  const safeParams = normalizeParams(params);
  const mask = getAmplitudeMask(grid, maxDisplacementMm);
  const preview = createEmptyGrid(0);
  const columnPhaseRadians = toRadians(safeParams.columnPhaseDegrees);
  const rowPhaseRadians = toRadians(safeParams.rowPhaseDegrees);
  const globalPhaseRadians = toRadians(safeParams.globalPhaseDegrees);

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const phase =
        (2 * Math.PI * safeParams.frequencyHz * timeSec) +
        (col * columnPhaseRadians) +
        (row * rowPhaseRadians) +
        globalPhaseRadians;
      preview[row][col] = Number((maxDisplacementMm * mask[row][col] * positiveWave(phase)).toFixed(2));
    }
  }

  return preview;
}

export function generateArduinoSketch(experiment, params) {
  const safeParams = normalizeParams(params);
  const mask = getAmplitudeMask(experiment.grid, experiment.maxDisplacementMm);
  const columnPhaseRadians = toRadians(safeParams.columnPhaseDegrees);
  const rowPhaseRadians = toRadians(safeParams.rowPhaseDegrees);
  const globalPhaseRadians = toRadians(safeParams.globalPhaseDegrees);

  return `#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

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

const long SERIAL_BAUD_RATE = 9600;

const float FREQUENCY_HZ = ${formatNumber(safeParams.frequencyHz, 3)};
const float AMPLITUDE_DEGREES = ${formatNumber(safeParams.amplitudeDegrees, 3)};
const float COLUMN_PHASE_RADIANS = ${formatNumber(columnPhaseRadians, 6)};
const float ROW_PHASE_RADIANS = ${formatNumber(rowPhaseRadians, 6)};
const float GLOBAL_PHASE_RADIANS = ${formatNumber(globalPhaseRadians, 6)};
const int REFRESH_DELAY_MS = ${Math.round(safeParams.refreshDelayMs)};

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

// Generated from the UI grid. 0.0 = actuator disabled, 1.0 = full AMPLITUDE_DEGREES.
const float AMPLITUDE_MASK[GRID_ROWS][GRID_COLS] = {
${formatMaskRows(mask)}
};

float centers[TOTAL_SERVOS];
bool running = true;

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

float getDisplacementDegrees(int row, int col, float timeSec) {
  if (!running) {
    return 0.0;
  }

  float phase =
    (2.0 * PI * FREQUENCY_HZ * timeSec) +
    (col * COLUMN_PHASE_RADIANS) +
    (row * ROW_PHASE_RADIANS) +
    GLOBAL_PHASE_RADIANS;

  return AMPLITUDE_DEGREES * AMPLITUDE_MASK[row][col] * positiveWave(phase);
}

void driveServoDisplacement(int servoIndex, float displacementDegrees) {
  int boardIdx = servoIndexToBoard(servoIndex);
  float safeDisplacement = constrain(displacementDegrees, 0.0, AMPLITUDE_DEGREES);
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

void handleSerialCommands() {
  if (!Serial.available()) {
    return;
  }

  String line = Serial.readStringUntil('\\n');
  line.trim();
  line.toLowerCase();

  if (line == "run") {
    running = true;
    Serial.println("Running generated pattern.");
    return;
  }

  if (line == "flat" || line == "stop") {
    running = false;
    Serial.println("Holding flat.");
    return;
  }

  if (line == "help") {
    Serial.println("Commands: run, flat, stop, help");
  }
}

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  Wire.begin();

  for (int boardIdx = 0; boardIdx < BOARD_COUNT; boardIdx += 1) {
    pwmBoards[boardIdx].begin();
    pwmBoards[boardIdx].setOscillatorFrequency(27000000);
    pwmBoards[boardIdx].setPWMFreq(SERVO_FREQ);
  }

  initializeCenters();
  Serial.println("Generated wall pattern ready.");
  Serial.println("Commands: run, flat, stop, help");
}

void loop() {
  handleSerialCommands();

  static unsigned long startTime = millis();
  float timeSec = (millis() - startTime) / 1000.0;

  for (int servoIndex = 0; servoIndex < TOTAL_SERVOS; servoIndex += 1) {
    int boardIdx = servoIndexToBoard(servoIndex);
    int channel = servoIndexToChannel(servoIndex);
    int row = PHYSICAL_ROW_BY_BOARD[boardIdx];
    int col = getPhysicalColumn(boardIdx, channel);

    float displacementDegrees = getDisplacementDegrees(row, col, timeSec);
    driveServoDisplacement(servoIndex, displacementDegrees);
  }

  delay(REFRESH_DELAY_MS);
}
`;
}
