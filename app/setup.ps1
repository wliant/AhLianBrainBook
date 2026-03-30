# Setup script for AhLianBrainBook backend development environment
# Configures Java 21 (Liberica) as the active JDK for this session

$JAVA21_HOME = "D:\Installation\Java\liberica-21.0.5"

if (-not (Test-Path $JAVA21_HOME)) {
    Write-Error "Java 21 not found at $JAVA21_HOME. Please install Liberica JDK 21."
    exit 1
}

$env:JAVA_HOME = $JAVA21_HOME
$env:PATH = "$JAVA21_HOME\bin;$env:PATH"

Write-Host "JAVA_HOME set to: $env:JAVA_HOME"
& java -version
