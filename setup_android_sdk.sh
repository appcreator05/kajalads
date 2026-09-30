#!/usr/bin/env bash
set -e

echo "=== Starting Android SDK Setup ==="

# 1. Ensure directories exist
export ANDROID_HOME="/opt/android-sdk"
export ANDROID_SDK_ROOT="/opt/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"

# 2. Download Android Command Line Tools
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
TMP_ZIP="/tmp/cmdline-tools.zip"

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo "Downloading command-line tools..."
    wget -q -O "$TMP_ZIP" "$CMDLINE_TOOLS_URL"
    echo "Unpacking command-line tools..."
    unzip -q -o "$TMP_ZIP" -d "/tmp/cmdline-tools-extracted"
    rm -rf "$ANDROID_HOME/cmdline-tools/latest"
    mv "/tmp/cmdline-tools-extracted/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
    rm -f "$TMP_ZIP"
    rm -rf "/tmp/cmdline-tools-extracted"
fi

export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

echo "Accepting SDK licenses..."
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses > /dev/null 2>&1 || true

echo "Installing platforms;android-34 and build-tools;34.0.0..."
sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-34" "build-tools;34.0.0" > /dev/null 2>&1 || true

# 3. Create local.properties for gradle projects
mkdir -p /android
echo "sdk.dir=$ANDROID_HOME" > /android/local.properties
if [ -d "./android" ]; then
    echo "sdk.dir=$ANDROID_HOME" > ./android/local.properties
fi

# 4. Set persistent system environment variables
cat << 'EOF' > /etc/profile.d/android.sh
export ANDROID_HOME="/opt/android-sdk"
export ANDROID_SDK_ROOT="/opt/android-sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
EOF
chmod +x /etc/profile.d/android.sh

echo "export ANDROID_HOME=/opt/android-sdk" >> /etc/environment
echo "export ANDROID_SDK_ROOT=/opt/android-sdk" >> /etc/environment

echo "=== Android SDK Setup Complete! ==="
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" --list_installed
