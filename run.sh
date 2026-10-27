#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ -n "${JAVA_HOME:-}" ]; then PATH="$JAVA_HOME/bin:$PATH"; export PATH; fi
if [ ! -f build/squelch-java.jar ]; then sh ./build.sh; fi
exec java -jar build/squelch-java.jar "${1:-8080}" "${2:-127.0.0.1}"
