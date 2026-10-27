#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ -n "${JAVA_HOME:-}" ]; then PATH="$JAVA_HOME/bin:$PATH"; export PATH; fi
mkdir -p build/classes
find src/main/java -name '*.java' > build/sources.txt
javac --release 17 -encoding UTF-8 -d build/classes @build/sources.txt
cp -R src/main/resources/. build/classes/
jar --create --file build/squelch-java.jar --main-class squelch.App -C build/classes .
if [ "${1:-}" = "--test" ]; then
  mkdir -p build/test-classes
  find src/test/java -name '*.java' > build/tests.txt
  javac --release 17 -encoding UTF-8 -cp build/classes -d build/test-classes @build/tests.txt
  java -cp 'build/classes:build/test-classes:src/test/resources' squelch.Tests
fi
printf '%s\n' 'Ready: build/squelch-java.jar'
