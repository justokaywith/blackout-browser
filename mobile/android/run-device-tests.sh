#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"
./gradlew :app:connectedDebugAndroidTest --no-daemon
result=$?
mkdir -p ../../android-qa
adb exec-out screencap -p > ../../android-qa/final-screen.png || true
adb shell uiautomator dump /sdcard/blackout-qa-window.xml || true
adb pull /sdcard/blackout-qa-window.xml ../../android-qa/ || true
adb pull /sdcard/Android/data/online.pactuno.blackout.debug/files/ ../../android-qa/ || true
adb pull /sdcard/blackout-qa-private-home.png ../../android-qa/ || true
adb pull /sdcard/blackout-qa-standard.png ../../android-qa/ || true
adb pull /sdcard/blackout-qa-light.png ../../android-qa/ || true
adb pull /sdcard/blackout-qa-tv-960x540.png ../../android-qa/ || true
adb pull /sdcard/blackout-qa-tv-1280x720.png ../../android-qa/ || true
exit "$result"
