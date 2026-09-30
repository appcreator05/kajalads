#!/usr/bin/env bash
set -e

echo "=== 1. Setting up Java OpenJDK 17 ==="
mkdir -p /opt/java
if [ ! -d "/opt/java/jdk-17" ]; then
    echo "Downloading Eclipse Temurin OpenJDK 17..."
    curl -sSL "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.12%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.12_7.tar.gz" -o /tmp/jdk17.tar.gz
    echo "Extracting OpenJDK 17..."
    tar -xzf /tmp/jdk17.tar.gz -C /opt/java
    EXTRACTED_DIR=$(find /opt/java -maxdepth 1 -type d -name "jdk-17*" | head -n 1)
    mv "$EXTRACTED_DIR" /opt/java/jdk-17
    rm -f /tmp/jdk17.tar.gz
fi

export JAVA_HOME="/opt/java/jdk-17"
ln -sf /opt/java/jdk-17/bin/java /usr/local/bin/java
ln -sf /opt/java/jdk-17/bin/javac /usr/local/bin/javac
ln -sf /opt/java/jdk-17/bin/keytool /usr/local/bin/keytool
echo "Java installed successfully:"
/usr/local/bin/java -version

echo "=== 2. Setting up Android SDK ==="
export ANDROID_HOME="/opt/android-sdk"
export ANDROID_SDK_ROOT="/opt/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo "Downloading Android Commandline Tools..."
    curl -sSL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o /tmp/cmdline-tools.zip
    echo "Extracting Commandline Tools..."
    unzip -q -o /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-extracted
    mv /tmp/cmdline-tools-extracted/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
    rm -f /tmp/cmdline-tools.zip
    rm -rf /tmp/cmdline-tools-extracted
fi

export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

ln -sf "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" /usr/local/bin/sdkmanager

echo "Accepting Android SDK licenses..."
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses > /dev/null 2>&1 || true

echo "Installing Android SDK Platform 34 and Build-Tools 34.0.0..."
sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-34" "build-tools;34.0.0"

ln -sf "$ANDROID_HOME/platform-tools/adb" /usr/local/bin/adb

# Configure local.properties for the android project
echo "Configuring android/local.properties..."
echo "sdk.dir=$ANDROID_HOME" > /app/applet/android/local.properties

# Export persistent environment variables
cat << 'EOF' > /etc/profile.d/android.sh
export JAVA_HOME="/opt/java/jdk-17"
export ANDROID_HOME="/opt/android-sdk"
export ANDROID_SDK_ROOT="/opt/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
EOF
chmod +x /etc/profile.d/android.sh

echo "export JAVA_HOME=/opt/java/jdk-17" >> /etc/environment
echo "export ANDROID_HOME=/opt/android-sdk" >> /etc/environment
echo "export ANDROID_SDK_ROOT=/opt/android-sdk" >> /etc/environment

echo "=== Android SDK Setup Verification ==="
sdkmanager --sdk_root="$ANDROID_HOME" --list_installed

echo "=== SETUP COMPLETE SUCCESSFUL ==="
