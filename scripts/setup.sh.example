#!/usr/bin/env bash
# Setup script for AhLianBrainBook backend development environment
# Configures Java 21 (Liberica) as the active JDK for this session
# Usage: source setup.sh

JAVA21_HOME="/d/Installation/Java/liberica-21.0.5"

if [ ! -d "$JAVA21_HOME" ]; then
    echo "Error: Java 21 not found at $JAVA21_HOME. Please install Liberica JDK 21."
    return 1 2>/dev/null || exit 1
fi

export JAVA_HOME="$JAVA21_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

echo "JAVA_HOME set to: $JAVA_HOME"
java -version
