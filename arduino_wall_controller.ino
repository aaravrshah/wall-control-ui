#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

// Four PCA9685 boards at consecutive I2C addresses.
Adafruit_PWMServoDriver pwmBoards[] = {
  Adafruit_PWMServoDriver(0x40),
  Adafruit_PWMServoDriver(0x41),
  Adafruit_PWMServoDriver(0x42),
  Adafruit_PWMServoDriver(0x43),
};

const int BOARD_COUNT = sizeof(pwmBoards) / sizeof(pwmBoards[0]);
const int CHANNELS_PER_BOARD = 16;
const int TOTAL_CHANNELS = BOARD_COUNT * CHANNELS_PER_BOARD;

const int SERVO_MIN = 102;  // 500 microseconds
const int SERVO_MAX = 512;  // 2500 microseconds
const int SERVO_FREQ = 60;
const long SERIAL_BAUD_RATE = 9600;

int angleToPulse(int angle) {
  int safeAngle = constrain(angle, 0, 180);
  return map(safeAngle, 0, 180, SERVO_MIN, SERVO_MAX);
}

bool setServoChannel(int channel, int angle) {
  if (channel < 0 || channel >= TOTAL_CHANNELS) {
    return false;
  }

  int boardIndex = channel / CHANNELS_PER_BOARD;
  int boardChannel = channel % CHANNELS_PER_BOARD;
  int pulse = angleToPulse(angle);

  pwmBoards[boardIndex].setPWM(boardChannel, 0, pulse);
  return true;
}

void initializeBoards() {
  for (int index = 0; index < BOARD_COUNT; index += 1) {
    pwmBoards[index].begin();
    pwmBoards[index].setPWMFreq(SERVO_FREQ);
  }
}

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  Wire.begin();
  initializeBoards();
  Serial.println("wall-controller-ready");
}

void loop() {
  if (Serial.available() <= 0) {
    return;
  }

  String data = Serial.readStringUntil('\n');
  data.trim();
  if (data.length() == 0) {
    return;
  }

  int separatorIndex = data.indexOf(':');
  if (separatorIndex == -1) {
    Serial.println("error:invalid-format");
    return;
  }

  int channel = data.substring(0, separatorIndex).toInt();
  int angle = data.substring(separatorIndex + 1).toInt();

  if (!setServoChannel(channel, angle)) {
    Serial.println("error:channel-out-of-range");
    return;
  }

  Serial.print("ok:");
  Serial.print(channel);
  Serial.print(':');
  Serial.println(constrain(angle, 0, 180));
}
