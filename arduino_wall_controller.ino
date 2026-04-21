#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pwmBoards[] = {
  Adafruit_PWMServoDriver(0x40),
  Adafruit_PWMServoDriver(0x41),
  Adafruit_PWMServoDriver(0x42),
  Adafruit_PWMServoDriver(0x43),
};

const int BOARD_COUNT = sizeof(pwmBoards) / sizeof(pwmBoards[0]);
const int CHANNELS_PER_BOARD = 16;
const int TOTAL_SERVOS = BOARD_COUNT * CHANNELS_PER_BOARD;

#define SERVOMIN   102
#define SERVOMAX   512
#define SERVO_FREQ 50

// Kept at 9600 so the existing frontend/browser serial integration continues to work.
const long SERIAL_BAUD_RATE = 9600;

const float baseCenter = (SERVOMIN + SERVOMAX) / 2.0;
const float ticksPerDegree = (SERVOMAX - SERVOMIN) / 180.0;
const int UNCLAMPED_CENTER_SERVO_INDEX = 10;  // Servo 11 in 1-based numbering.

// Per-servo calibration offsets in degrees, indexed by global servo number - 1.
const float centerOffsetDegrees[TOTAL_SERVOS] = {
  10, 10, 0, 0, 0, -3, 5, 15, 10, 5, 85, -6, 13, 0, 12, 10,
  0, 5, -25, -30, -5, -30, 0, 0, -8, 8, -30, 0, 8, 0, -3, 6,
  -5, -12, -5, -2, -2, -15, -5, -5, -5, 12, -5, 10, 21, -3, -2, -15,
  15, 10, 5, 3, 5, -10, 7, -2, 5, 10, 3, 20, 5, 5, 15, 20
};

float centers[TOTAL_SERVOS];
float commandedAngle[TOTAL_SERVOS] = {0};

int servoIndexToBoard(int servoIndex) {
  return servoIndex / CHANNELS_PER_BOARD;
}

int servoIndexToChannel(int servoIndex) {
  return servoIndex % CHANNELS_PER_BOARD;
}

bool isValidServoIndex(int servoIndex) {
  return servoIndex >= 0 && servoIndex < TOTAL_SERVOS;
}

void setServoPulseTicks(int servoIndex, int pwmValue) {
  int boardIndex = servoIndexToBoard(servoIndex);
  int boardChannel = servoIndexToChannel(servoIndex);
  pwmBoards[boardIndex].setPWM(boardChannel, 0, pwmValue);
}

void moveServoRelative(int servoIndex, float angleDeg) {
  if (!isValidServoIndex(servoIndex)) {
    Serial.println("Servo index out of range.");
    return;
  }

  float pwmValue = centers[servoIndex] + angleDeg * ticksPerDegree;

  if (servoIndex != UNCLAMPED_CENTER_SERVO_INDEX) {
    if (pwmValue < SERVOMIN) pwmValue = SERVOMIN;
    if (pwmValue > SERVOMAX) pwmValue = SERVOMAX;
  }

  setServoPulseTicks(servoIndex, (int)pwmValue);
  commandedAngle[servoIndex] = angleDeg;

  Serial.print("Servo ");
  Serial.print(servoIndex + 1);
  Serial.print(" moved to relative angle ");
  Serial.print(angleDeg);
  Serial.print(" deg, PWM = ");
  Serial.println((int)pwmValue);
}

void moveAllToCenters() {
  for (int i = 0; i < TOTAL_SERVOS; i++) {
    setServoPulseTicks(i, (int)centers[i]);
    commandedAngle[i] = 0;
  }
  Serial.println("All servos moved to their calibrated centers.");
}

void printStatus() {
  Serial.println("---- Servo Status ----");
  for (int i = 0; i < TOTAL_SERVOS; i++) {
    Serial.print("Servo ");
    Serial.print(i + 1);
    Serial.print(" (0x");
    Serial.print(0x40 + servoIndexToBoard(i), HEX);
    Serial.print(" ch ");
    Serial.print(servoIndexToChannel(i));
    Serial.print("): center = ");
    Serial.print(centers[i], 1);
    Serial.print(", angle = ");
    Serial.println(commandedAngle[i]);
  }
}

void printCentersArray() {
  Serial.println("Copy this back into your code:");
  Serial.print("float centers[");
  Serial.print(TOTAL_SERVOS);
  Serial.println("] = {");
  for (int i = 0; i < TOTAL_SERVOS; i++) {
    Serial.print("  ");
    Serial.print(centers[i], 1);
    if (i < TOTAL_SERVOS - 1) Serial.println(",");
    else Serial.println();
  }
  Serial.println("};");
}

void printOffsetsArray() {
  Serial.println("Calibration offsets in degrees:");
  Serial.print("float centerOffsetDegrees[");
  Serial.print(TOTAL_SERVOS);
  Serial.println("] = {");
  for (int i = 0; i < TOTAL_SERVOS; i++) {
    Serial.print("  ");
    Serial.print(centerOffsetDegrees[i], 1);
    if (i < TOTAL_SERVOS - 1) Serial.println(",");
    else Serial.println();
  }
  Serial.println("};");
}

void printHelp() {
  Serial.println("Commands:");
  Serial.println("  <servo> <angle>      Example: 10 20   (servo 1-64, relative angle -90 to +90)");
  Serial.println("  setc <servo> <tick>  Example: setc 3 320");
  Serial.println("  center               Move all servos to center");
  Serial.println("  status               Print current centers and angles");
  Serial.println("  printc               Print centers array");
  Serial.println("  printo               Print offset array");
  Serial.println("  help                 Show commands");
  Serial.println("  <channel>:<angle>    Example: 0:90    (UI protocol, channel 0-63, absolute angle 0-180)");
}

void initializeBoards() {
  for (int index = 0; index < BOARD_COUNT; index += 1) {
    pwmBoards[index].begin();
    pwmBoards[index].setOscillatorFrequency(27000000);
    pwmBoards[index].setPWMFreq(SERVO_FREQ);
  }
  delay(10);
}

void initializeCenters() {
  for (int i = 0; i < TOTAL_SERVOS; i++) {
    centers[i] = baseCenter + centerOffsetDegrees[i] * ticksPerDegree;

    if (i == UNCLAMPED_CENTER_SERVO_INDEX) {
      continue;
    }

    if (centers[i] < SERVOMIN) centers[i] = SERVOMIN;
    if (centers[i] > SERVOMAX) centers[i] = SERVOMAX;
  }
}

bool handleUiCommand(String line) {
  int separatorIndex = line.indexOf(':');
  if (separatorIndex == -1) {
    return false;
  }

  int channel = line.substring(0, separatorIndex).toInt();
  float absoluteAngle = line.substring(separatorIndex + 1).toFloat();

  if (channel < 0 || channel >= TOTAL_SERVOS) {
    Serial.println("error:channel-out-of-range");
    return true;
  }

  if (absoluteAngle < 0.0 || absoluteAngle > 180.0) {
    Serial.println("error:angle-out-of-range");
    return true;
  }

  float relativeAngle = absoluteAngle - 90.0;
  moveServoRelative(channel, relativeAngle);

  Serial.print("ok:");
  Serial.print(channel);
  Serial.print(':');
  Serial.println((int)constrain((int)absoluteAngle, 0, 180));
  return true;
}

bool handleSetCenterCommand(String line) {
  if (!line.startsWith("setc ")) {
    return false;
  }

  int firstSpace = line.indexOf(' ');
  int secondSpace = line.indexOf(' ', firstSpace + 1);

  if (firstSpace == -1 || secondSpace == -1) {
    Serial.println("Invalid setc command. Example: setc 3 320");
    return true;
  }

  String servoStr = line.substring(firstSpace + 1, secondSpace);
  String centerStr = line.substring(secondSpace + 1);

  servoStr.trim();
  centerStr.trim();

  int servoNum = servoStr.toInt();
  int newCenter = centerStr.toInt();

  if (servoNum < 1 || servoNum > TOTAL_SERVOS) {
    Serial.print("Servo number must be 1 to ");
    Serial.print(TOTAL_SERVOS);
    Serial.println(".");
    return true;
  }

  if (newCenter < SERVOMIN || newCenter > SERVOMAX) {
    Serial.println("Center tick out of range.");
    return true;
  }

  centers[servoNum - 1] = newCenter;
  setServoPulseTicks(servoNum - 1, newCenter);
  commandedAngle[servoNum - 1] = 0;

  Serial.print("Servo ");
  Serial.print(servoNum);
  Serial.print(" center updated to ");
  Serial.println(newCenter);
  return true;
}

bool handleManualServoCommand(String line) {
  int spaceIndex = line.indexOf(' ');
  if (spaceIndex == -1) {
    return false;
  }

  String servoStr = line.substring(0, spaceIndex);
  String angleStr = line.substring(spaceIndex + 1);

  servoStr.trim();
  angleStr.trim();

  int servoNum = servoStr.toInt();
  float angleDeg = angleStr.toFloat();

  if (servoNum < 1 || servoNum > TOTAL_SERVOS) {
    Serial.print("Servo number must be 1 to ");
    Serial.print(TOTAL_SERVOS);
    Serial.println(".");
    return true;
  }

  if (angleDeg < -90.0 || angleDeg > 90.0) {
    Serial.println("Angle should be between -90 and +90 degrees.");
    return true;
  }

  moveServoRelative(servoNum - 1, angleDeg);
  return true;
}

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  Wire.begin();

  initializeBoards();
  initializeCenters();
  moveAllToCenters();

  Serial.println("wall-controller-ready");
  printHelp();
}

void loop() {
  if (!Serial.available()) {
    return;
  }

  String line = Serial.readStringUntil('\n');
  line.trim();

  if (line.length() == 0) return;

  Serial.print("Received: [");
  Serial.print(line);
  Serial.println("]");

  if (line.equalsIgnoreCase("help")) {
    printHelp();
    return;
  }

  if (line.equalsIgnoreCase("center")) {
    moveAllToCenters();
    return;
  }

  if (line.equalsIgnoreCase("status")) {
    printStatus();
    return;
  }

  if (line.equalsIgnoreCase("printc")) {
    printCentersArray();
    return;
  }

  if (line.equalsIgnoreCase("printo")) {
    printOffsetsArray();
    return;
  }

  if (handleSetCenterCommand(line)) {
    return;
  }

  if (handleUiCommand(line)) {
    return;
  }

  if (handleManualServoCommand(line)) {
    return;
  }

  Serial.println("Invalid command. Type 'help' for format.");
}
