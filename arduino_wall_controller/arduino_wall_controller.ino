#include <Wire.h>
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
const int SERIAL_LINE_MAX = 260;
const int MAX_PROGRAM_FRAMES = 20;

#define SERVOMIN   102
#define SERVOMAX   512
#define SERVO_FREQ 50

const long SERIAL_BAUD_RATE = 115200;

const float WAVE_FREQ_HZ = 1.0;
const float WAVE_AMPLITUDE_DEGREES = 28.0;
const float PHASE_INCREMENT = PI / 4.0;
const float ROW_PHASE_INCREMENT = PI / 2.0;
const float DIAGONAL_ROW_SPACING = 4.0;
const float DIAGONAL_PHASE_STEP = 1.35;

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
  10, 10, 0, 0, 0, -3, 5, 15, 10, 5, -85, -6, 13, 0, 12, 10,
  0, 5, -25, -5, 10, -15, 0, 0, -8, 8, -30, 0, 8, 0, -3, 6,
  -5, -12, -5, -2, -2, -15, -5, -5, -5, 12, -5, 10, 21, -3, -2, -15,
  15, 10, 5, 3, 5, -10, 7, -2, 5, 10, 3, 20, 5, 5, 15, 20
};

// 4 x 16 bitmap for the UIUC pattern. A 1 means "pulse this actuator up".
const byte UIUC_BITMAP[GRID_ROWS][GRID_COLS] = {
  {1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0},
  {1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0},
  {1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0},
  {1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0}
};

enum PatternMode {
  PATTERN_SINE = 0,
  PATTERN_DIAGONAL = 1,
  PATTERN_UIUC = 2,
  PATTERN_FLAT = 3,
  PATTERN_UI_FRAME = 4,
  PATTERN_PROGRAM = 5,
};

PatternMode currentPattern = PATTERN_FLAT;
float centers[TOTAL_SERVOS];
float uiFrameDisplacementDegrees[GRID_ROWS][GRID_COLS];
byte programFrames[MAX_PROGRAM_FRAMES][TOTAL_SERVOS];
unsigned long programFrameTimesMs[MAX_PROGRAM_FRAMES];
bool programFrameReceived[MAX_PROGRAM_FRAMES];
int expectedProgramFrameCount = 0;
int programFrameCount = 0;
bool programReady = false;
bool programPlaying = false;
unsigned long programStartMillis = 0;
unsigned long programPausedElapsedMs = 0;
unsigned long goodFrameCount = 0;
unsigned long badFrameCount = 0;
unsigned long goodProgramFrameCount = 0;
unsigned long badProgramCommandCount = 0;
char serialLineBuffer[SERIAL_LINE_MAX];
int serialLineLength = 0;

void handleSerialCommands();

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

float getProgramPlaybackTimeMs() {
  if (!programReady || programFrameCount == 0) {
    return 0.0;
  }

  unsigned long endTimeMs = programFrameTimesMs[programFrameCount - 1];
  if (endTimeMs == 0) {
    return 0.0;
  }

  unsigned long elapsedMs = programPlaying
    ? millis() - programStartMillis
    : programPausedElapsedMs;
  unsigned long fullLoopMs = endTimeMs * 2;
  unsigned long loopElapsedMs = elapsedMs % fullLoopMs;

  if (loopElapsedMs <= endTimeMs) {
    return (float)loopElapsedMs;
  }

  return (float)(fullLoopMs - loopElapsedMs);
}

float getProgramDisplacementDegrees(int row, int col) {
  if (!programReady || programFrameCount == 0) {
    return 0.0;
  }

  int cellIndex = row * GRID_COLS + col;
  if (programFrameCount == 1) {
    return (float)programFrames[0][cellIndex];
  }

  float playbackTimeMs = getProgramPlaybackTimeMs();

  if (playbackTimeMs <= programFrameTimesMs[0]) {
    return (float)programFrames[0][cellIndex];
  }

  for (int index = 0; index < programFrameCount - 1; index += 1) {
    unsigned long startMs = programFrameTimesMs[index];
    unsigned long endMs = programFrameTimesMs[index + 1];

    if (playbackTimeMs <= endMs) {
      float spanMs = (float)(endMs - startMs);
      if (spanMs < 1.0) {
        spanMs = 1.0;
      }
      float t = (playbackTimeMs - startMs) / spanMs;
      float startValue = (float)programFrames[index][cellIndex];
      float endValue = (float)programFrames[index + 1][cellIndex];
      return startValue + ((endValue - startValue) * t);
    }
  }

  return (float)programFrames[programFrameCount - 1][cellIndex];
}

float getPatternDisplacementDegrees(PatternMode pattern, int row, int col, float timeSec) {
  if (pattern == PATTERN_FLAT) {
    return 0.0;
  }

  if (pattern == PATTERN_PROGRAM) {
    return getProgramDisplacementDegrees(row, col);
  }

  if (pattern == PATTERN_UI_FRAME) {
    return uiFrameDisplacementDegrees[row][col];
  }

  if (pattern == PATTERN_SINE) {
    float phase = (2.0 * PI * WAVE_FREQ_HZ * timeSec) + (col * PHASE_INCREMENT) + (row * ROW_PHASE_INCREMENT);
    return WAVE_AMPLITUDE_DEGREES * positiveWave(phase);
  }

  if (pattern == PATTERN_DIAGONAL) {
    // Use a sharper traveling crest so the diagonal reads clearly on the wall.
    float diagonalCoordinate = col + (row * DIAGONAL_ROW_SPACING);
    float phase = (2.0 * PI * WAVE_FREQ_HZ * timeSec) - (diagonalCoordinate * DIAGONAL_PHASE_STEP) + (row * ROW_PHASE_INCREMENT);
    float crest = positiveWave(phase);
    return WAVE_AMPLITUDE_DEGREES * crest * crest * crest * crest;
  }

  if (UIUC_BITMAP[row][col] == 0) {
    return 0.0;
  }

  float phase = (2.0 * PI * WAVE_FREQ_HZ * timeSec) + (row * ROW_PHASE_INCREMENT);
  return WAVE_AMPLITUDE_DEGREES * positiveWave(phase);
}

void driveServoDisplacement(int servoIndex, float displacementDegrees) {
  int boardIdx = servoIndexToBoard(servoIndex);
  float safeDisplacement = constrain(displacementDegrees, 0.0, WAVE_AMPLITUDE_DEGREES);
  float signedDegrees = safeDisplacement * DISPLACEMENT_SIGN_BY_BOARD[boardIdx];
  float pwmValue = centers[servoIndex] + (signedDegrees * ticksPerDegree);

  pwmValue = constrain(pwmValue, SERVOMIN, SERVOMAX);
  pwmBoards[boardIdx].setPWM(servoIndexToChannel(servoIndex), 0, (int)pwmValue);
}

void driveCurrentPattern(float timeSec) {
  for (int servoIndex = 0; servoIndex < TOTAL_SERVOS; servoIndex += 1) {
    if (servoIndex % 4 == 0) {
      handleSerialCommands();
    }

    int boardIdx = servoIndexToBoard(servoIndex);
    int channel = servoIndexToChannel(servoIndex);
    int row = PHYSICAL_ROW_BY_BOARD[boardIdx];
    int col = getPhysicalColumn(boardIdx, channel);

    float displacementDegrees = getPatternDisplacementDegrees(currentPattern, row, col, timeSec);
    driveServoDisplacement(servoIndex, displacementDegrees);
  }
}

void clearUiFrame() {
  for (int row = 0; row < GRID_ROWS; row += 1) {
    for (int col = 0; col < GRID_COLS; col += 1) {
      uiFrameDisplacementDegrees[row][col] = 0.0;
    }
  }
}

void resetProgram() {
  expectedProgramFrameCount = 0;
  programFrameCount = 0;
  programReady = false;
  programPlaying = false;
  programStartMillis = 0;
  programPausedElapsedMs = 0;

  for (int index = 0; index < MAX_PROGRAM_FRAMES; index += 1) {
    programFrameReceived[index] = false;
    programFrameTimesMs[index] = 0;
  }
}

void updateProgramReady() {
  if (expectedProgramFrameCount <= 0 || expectedProgramFrameCount > MAX_PROGRAM_FRAMES) {
    programReady = false;
    return;
  }

  for (int index = 0; index < expectedProgramFrameCount; index += 1) {
    if (!programFrameReceived[index]) {
      programReady = false;
      return;
    }

    if (index > 0 && programFrameTimesMs[index] < programFrameTimesMs[index - 1]) {
      programReady = false;
      badProgramCommandCount += 1;
      return;
    }
  }

  programFrameCount = expectedProgramFrameCount;
  programReady = true;
}

bool isUnsignedNumber(String token) {
  token.trim();
  if (token.length() == 0) {
    return false;
  }

  bool hasDigit = false;
  bool hasDecimal = false;

  for (int index = 0; index < token.length(); index += 1) {
    char value = token.charAt(index);

    if (value >= '0' && value <= '9') {
      hasDigit = true;
      continue;
    }

    if (value == '.' && !hasDecimal) {
      hasDecimal = true;
      continue;
    }

    if (value == '+' && index == 0) {
      continue;
    }

    return false;
  }

  return hasDigit;
}

bool parseFramePayload(String payload, float nextFrame[GRID_ROWS][GRID_COLS]) {
  int tokenStart = 0;

  for (int cellIndex = 0; cellIndex < TOTAL_SERVOS; cellIndex += 1) {
    int commaIndex = payload.indexOf(',', tokenStart);
    bool isLastCell = cellIndex == TOTAL_SERVOS - 1;

    if (isLastCell && commaIndex != -1) {
      return false;
    }

    if (!isLastCell && commaIndex == -1) {
      return false;
    }

    String token = isLastCell
      ? payload.substring(tokenStart)
      : payload.substring(tokenStart, commaIndex);

    token.trim();
    if (!isUnsignedNumber(token)) {
      return false;
    }

    int row = cellIndex / GRID_COLS;
    int col = cellIndex % GRID_COLS;
    nextFrame[row][col] = constrain(token.toFloat(), 0.0, WAVE_AMPLITUDE_DEGREES);
    tokenStart = commaIndex + 1;
  }

  return true;
}

bool handleFrameCommand(String line) {
  String lowerLine = line;
  lowerLine.toLowerCase();

  int separatorIndex = lowerLine.indexOf(':');
  if (separatorIndex == -1) {
    return false;
  }

  String command = lowerLine.substring(0, separatorIndex);
  if (command != "frame" && command != "f") {
    return false;
  }

  float nextFrame[GRID_ROWS][GRID_COLS];
  if (!parseFramePayload(line.substring(separatorIndex + 1), nextFrame)) {
    badFrameCount += 1;
    return true;
  }

  for (int row = 0; row < GRID_ROWS; row += 1) {
    for (int col = 0; col < GRID_COLS; col += 1) {
      uiFrameDisplacementDegrees[row][col] = nextFrame[row][col];
    }
  }

  currentPattern = PATTERN_UI_FRAME;
  goodFrameCount += 1;
  return true;
}

bool handleProgramCommand(String line) {
  String lowerLine = line;
  lowerLine.toLowerCase();

  if (!lowerLine.startsWith("prog ")) {
    return false;
  }

  if (lowerLine == "prog clear") {
    resetProgram();
    return true;
  }

  if (lowerLine.startsWith("prog begin ")) {
    int requestedFrameCount = lowerLine.substring(11).toInt();
    resetProgram();

    if (requestedFrameCount < 1 || requestedFrameCount > MAX_PROGRAM_FRAMES) {
      badProgramCommandCount += 1;
      return true;
    }

    expectedProgramFrameCount = requestedFrameCount;
    return true;
  }

  if (lowerLine.startsWith("prog frame ")) {
    String payload = line.substring(11);
    int spaceIndex = payload.indexOf(' ');

    if (spaceIndex == -1) {
      badProgramCommandCount += 1;
      return true;
    }

    int frameIndex = payload.substring(0, spaceIndex).toInt();
    String timeAndValues = payload.substring(spaceIndex + 1);
    int separatorIndex = timeAndValues.indexOf(':');

    if (
      separatorIndex == -1 ||
      frameIndex < 0 ||
      frameIndex >= MAX_PROGRAM_FRAMES ||
      expectedProgramFrameCount < 1 ||
      frameIndex >= expectedProgramFrameCount
    ) {
      badProgramCommandCount += 1;
      return true;
    }

    unsigned long timeMs = (unsigned long)timeAndValues.substring(0, separatorIndex).toInt();
    float nextFrame[GRID_ROWS][GRID_COLS];

    if (!parseFramePayload(timeAndValues.substring(separatorIndex + 1), nextFrame)) {
      badProgramCommandCount += 1;
      return true;
    }

    programFrameTimesMs[frameIndex] = timeMs;
    for (int row = 0; row < GRID_ROWS; row += 1) {
      for (int col = 0; col < GRID_COLS; col += 1) {
        int cellIndex = row * GRID_COLS + col;
        programFrames[frameIndex][cellIndex] = (byte)constrain((int)round(nextFrame[row][col]), 0, (int)WAVE_AMPLITUDE_DEGREES);
      }
    }

    programFrameReceived[frameIndex] = true;
    goodProgramFrameCount += 1;
    updateProgramReady();
    return true;
  }

  if (lowerLine == "prog play") {
    if (programReady) {
      programPausedElapsedMs = 0;
      programStartMillis = millis();
      programPlaying = true;
      currentPattern = PATTERN_PROGRAM;
    } else {
      badProgramCommandCount += 1;
    }
    return true;
  }

  if (lowerLine == "prog pause") {
    if (currentPattern == PATTERN_PROGRAM && programPlaying) {
      programPausedElapsedMs = millis() - programStartMillis;
      programPlaying = false;
    }
    return true;
  }

  if (lowerLine == "prog resume") {
    if (programReady && currentPattern == PATTERN_PROGRAM) {
      programStartMillis = millis() - programPausedElapsedMs;
      programPlaying = true;
    }
    return true;
  }

  if (lowerLine == "prog stop") {
    programPlaying = false;
    programPausedElapsedMs = 0;
    clearUiFrame();
    currentPattern = PATTERN_FLAT;
    return true;
  }

  badProgramCommandCount += 1;
  return true;
}

void printStatus() {
  Serial.println("---- Wall Controller Status ----");
  Serial.print("Pattern: ");
  Serial.println((int)currentPattern);
  Serial.print("PWM clamp: ");
  Serial.print(SERVOMIN);
  Serial.print(" to ");
  Serial.println(SERVOMAX);
  Serial.print("Max positive displacement degrees: ");
  Serial.println(WAVE_AMPLITUDE_DEGREES, 1);
  Serial.print("Good UI frames: ");
  Serial.println(goodFrameCount);
  Serial.print("Bad UI frames ignored: ");
  Serial.println(badFrameCount);
  Serial.print("Program ready: ");
  Serial.println(programReady ? "yes" : "no");
  Serial.print("Program frames: ");
  Serial.print(programFrameCount);
  Serial.print(" / ");
  Serial.println(expectedProgramFrameCount);
  Serial.print("Good program frames: ");
  Serial.println(goodProgramFrameCount);
  Serial.print("Bad program commands ignored: ");
  Serial.println(badProgramCommandCount);
}

void printHelp() {
  Serial.println("Commands:");
  Serial.println("  sine             - positive-only traveling wave");
  Serial.println("  diag             - positive-only diagonal wave");
  Serial.println("  uiuc             - pulse UIUC letters");
  Serial.println("  flat             - hold all servos at calibrated zero");
  Serial.println("  frame:<64 vals>  - UI frame, row-major positive degrees 0..28");
  Serial.println("  prog begin <n>   - begin uploaded keyframe program");
  Serial.println("  prog frame <i> <ms>:<64 vals>");
  Serial.println("  prog play|pause|resume|stop|clear");
  Serial.println("  status           - show controller state");
  Serial.println("  help             - show commands");
}

void processSerialLine(String line) {
  line.trim();

  if (line.length() == 0) {
    return;
  }

  if (handleFrameCommand(line)) {
    return;
  }

  if (handleProgramCommand(line)) {
    return;
  }

  String command = line;
  command.toLowerCase();

  if (command == "sine") {
    currentPattern = PATTERN_SINE;
    Serial.println("Pattern set to sine.");
    return;
  }

  if (command == "diag") {
    currentPattern = PATTERN_DIAGONAL;
    Serial.println("Pattern set to diagonal.");
    return;
  }

  if (command == "uiuc") {
    currentPattern = PATTERN_UIUC;
    Serial.println("Pattern set to UIUC.");
    return;
  }

  if (command == "flat") {
    clearUiFrame();
    currentPattern = PATTERN_FLAT;
    Serial.println("Pattern set to flat.");
    return;
  }

  if (command == "status") {
    printStatus();
    return;
  }

  if (command == "help") {
    printHelp();
    return;
  }

  clearUiFrame();
  currentPattern = PATTERN_FLAT;
  Serial.println("Unknown command. Flattened for safety.");
  printHelp();
}

void handleSerialCommands() {
  while (Serial.available()) {
    char incoming = (char)Serial.read();

    if (incoming == '\r') {
      continue;
    }

    if (incoming == '\n') {
      serialLineBuffer[serialLineLength] = '\0';
      processSerialLine(String(serialLineBuffer));
      serialLineLength = 0;
      continue;
    }

    if (serialLineLength < SERIAL_LINE_MAX - 1) {
      serialLineBuffer[serialLineLength] = incoming;
      serialLineLength += 1;
    } else {
      serialLineLength = 0;
      badFrameCount += 1;
    }
  }
}

void responsiveDelay(unsigned long durationMs) {
  unsigned long startMs = millis();
  while (millis() - startMs < durationMs) {
    handleSerialCommands();
    delay(1);
  }
}

void initializeCenters() {
  for (int servoIndex = 0; servoIndex < TOTAL_SERVOS; servoIndex += 1) {
    centers[servoIndex] = baseCenter + (centerOffsetDegrees[servoIndex] * ticksPerDegree);
    centers[servoIndex] = constrain(centers[servoIndex], SERVOMIN, SERVOMAX);
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
  clearUiFrame();
  resetProgram();
  currentPattern = PATTERN_FLAT;
  driveCurrentPattern(0.0);

  Serial.println("wall-controller-ready");
  printHelp();
}

void loop() {
  handleSerialCommands();

  static unsigned long startTime = millis();
  float timeSec = (millis() - startTime) / 1000.0;

  driveCurrentPattern(timeSec);
  responsiveDelay(20);
}
