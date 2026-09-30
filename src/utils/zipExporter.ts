import JSZip from 'jszip';
import { AppConfig } from '../types';
import {
  generateActivityMainXml,
  generateActivitySplashXml,
  generateBuildGradle,
  generateMainActivityKt,
  generateManifestXml,
  generateSplashActivityKt,
  generateThemesXml,
  generateAppConfigJson,
  generateFilePathsXml,
} from './codeGenerator';
import { getImageBase64 } from './apkBuilder';
import { resizeLogoTo512, resizeSplashTo1080x1920 } from './imageResizer';
import { generateStandardJksBuffer } from './keystoreGenerator';

const DEFAULT_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAiSURBVHhe7cExAQAAAMKg9U9tCF8gAAAAAAAAAAAAAAAAPgYY3AAB3Kq0HQAAAABJRU5ErkJggg==';

export async function exportAndroidProjectZip(rawConfig: AppConfig): Promise<Blob> {
  const safeAppName = rawConfig.appName?.trim() || 'AppCreator05';
  const safePackageName = rawConfig.packageName?.trim() || 'com.appcreator05.app';
  const safeWebsiteUrl = rawConfig.websiteUrl?.trim() || 'https://yourwebsite.com';
  const config: AppConfig = {
    ...rawConfig,
    appName: safeAppName,
    packageName: safePackageName,
    websiteUrl: safeWebsiteUrl,
  };

  const zip = new JSZip();
  const packagePath = config.packageName.replace(/\./g, '/');

  // Root project files
  zip.file(
    'build.gradle.kts',
    `// Top-level build file
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
}
`
  );

  zip.file(
    'settings.gradle.kts',
    `pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\\\.android.*")
                includeGroupByRegex("com\\\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        ${config.adNetwork === 'startio' ? 'maven { url = uri("https://mvn.startapp.com/android") }' : ''}
    }
}

rootProject.name = "${config.appName.replace(/[^a-zA-Z0-9_-]/g, '_')}"
include(":app")
`
  );

  zip.file(
    'gradle.properties',
    `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
android.suppressUnsupportedCompileSdk=36
`
  );

  // GitHub Actions Workflow for automated 1-click cloud APK building
  const githubFolder = zip.folder('.github/workflows')!;
  githubFolder.file(
    'build.yml',
    `name: Build ${config.appName} APK

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    name: Compile Android APK
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4

      - name: Build Release APK & AAB Bundle
        run: |
          chmod +x ./gradlew || true
          ./gradlew assembleRelease bundleRelease --no-daemon --stacktrace || ./gradlew assembleRelease --no-daemon

      - name: Upload Release Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${config.appName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}-release-builds
          path: |
            app/build/outputs/apk/release/*.apk
            app/build/outputs/bundle/release/*.aab
          retention-days: 30
`
  );

  // App module
  const appFolder = zip.folder('app')!;
  appFolder.file('build.gradle.kts', generateBuildGradle(config));

  // Release Keystore for production signing & Real Ads (Google AdMob / Start.io)
  if (config.keystore?.useCustomKeystore && config.keystore.keystoreBase64) {
    try {
      const rawB64 = config.keystore.keystoreBase64.includes(',')
        ? config.keystore.keystoreBase64.split(',')[1]
        : config.keystore.keystoreBase64;
      const binStr = atob(rawB64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      appFolder.file(config.keystore.keystoreFileName || 'release.keystore', bytes);
    } catch {
      // fallback to generated keystore if custom base64 fails
      const defaultAlias = config.keystore?.keyAlias || 'androidkey';
      const defaultPass = config.keystore?.storePassword || 'android';
      const defaultKeyPass = config.keystore?.keyPassword || defaultPass;
      const defaultJks = generateStandardJksBuffer(defaultAlias, defaultPass, defaultKeyPass, config.appName, 'AppInventor for Android');
      appFolder.file('release.keystore', defaultJks);
    }
  } else {
    // Generate valid release keystore automatically
    const defaultAlias = config.keystore?.keyAlias || 'androidkey';
    const defaultPass = config.keystore?.storePassword || 'android';
    const defaultKeyPass = config.keystore?.keyPassword || defaultPass;
    const defaultJks = generateStandardJksBuffer(defaultAlias, defaultPass, defaultKeyPass, config.appName, 'AppInventor for Android');
    appFolder.file('release.keystore', defaultJks);
  }

  if (config.googleServicesJson && config.googleServicesJson.trim()) {
    appFolder.file('google-services.json', config.googleServicesJson.trim());
  }
  appFolder.file(
    'proguard-rules.pro',
    `# Proguard rules for Fullscreen WebView & Ads
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

${
  config.adNetwork === 'admob'
    ? `# Google Mobile Ads (GMA) Next-Gen SDK rules
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.libraries.ads.** { *; }
-keep interface com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**`
    : ''
}
${
  config.adNetwork === 'startio'
    ? `# Start.io In-App SDK 5.1.0 rules
-keep class com.startapp.** { *; }
-dontwarn com.startapp.**`
    : ''
}
`
  );

  // Source files
  const mainFolder = appFolder.folder('src/main')!;
  mainFolder.file('AndroidManifest.xml', generateManifestXml(config));

  // Kotlin source code
  const javaFolder = mainFolder.folder(`java/${packagePath}`)!;
  javaFolder.file('MainActivity.kt', generateMainActivityKt(config));
  javaFolder.file('SplashActivity.kt', generateSplashActivityKt(config));

  // Resources
  const resFolder = mainFolder.folder('res')!;
  const layoutFolder = resFolder.folder('layout')!;
  layoutFolder.file('activity_main.xml', generateActivityMainXml(config));
  layoutFolder.file('activity_splash.xml', generateActivitySplashXml(config));

  const valuesFolder = resFolder.folder('values')!;
  valuesFolder.file('themes.xml', generateThemesXml(config));
  valuesFolder.file(
    'strings.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${config.appName}</string>
</resources>`
  );
  valuesFolder.file(
    'colors.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="black">#FF000000</color>
    <color name="white">#FFFFFFFF</color>
    <color name="splash_bg">${config.splashBgColor}</color>
</resources>`
  );

  const xmlFolder = resFolder.folder('xml')!;
  xmlFolder.file('file_paths.xml', generateFilePathsXml());

  // Package App Logo and Splash Screen into project drawables and mipmaps
  let logoBase64 = (await getImageBase64(config.appLogoUrl)) || DEFAULT_ICON_BASE64;
  let splashBase64 = await getImageBase64(config.splashImageUrl);

  if (config.appLogoUrl) {
    try {
      const resized = await resizeLogoTo512(config.appLogoUrl);
      if (resized && resized.includes(',')) {
        logoBase64 = resized.split(',')[1];
      }
    } catch (_) {}
  }

  if (config.splashImageUrl) {
    try {
      const resizedSplash = await resizeSplashTo1080x1920(config.splashImageUrl, config.splashBgColor);
      if (resizedSplash && resizedSplash.includes(',')) {
        splashBase64 = resizedSplash.split(',')[1];
      }
    } catch (_) {}
  }

  const drawableFolder = resFolder.folder('drawable')!;
  drawableFolder.file('ic_launcher.png', logoBase64, { base64: true });
  drawableFolder.file('ic_launcher_round.png', logoBase64, { base64: true });

  const mipmapMdpiFolder = resFolder.folder('mipmap-mdpi')!;
  mipmapMdpiFolder.file('ic_launcher.png', logoBase64, { base64: true });
  mipmapMdpiFolder.file('ic_launcher_round.png', logoBase64, { base64: true });

  const mipmapHdpiFolder = resFolder.folder('mipmap-hdpi')!;
  mipmapHdpiFolder.file('ic_launcher.png', logoBase64, { base64: true });
  mipmapHdpiFolder.file('ic_launcher_round.png', logoBase64, { base64: true });

  const mipmapXhdpiFolder = resFolder.folder('mipmap-xhdpi')!;
  mipmapXhdpiFolder.file('ic_launcher.png', logoBase64, { base64: true });
  mipmapXhdpiFolder.file('ic_launcher_round.png', logoBase64, { base64: true });

  const mipmapFolder = resFolder.folder('mipmap-xxhdpi')!;
  mipmapFolder.file('ic_launcher.png', logoBase64, { base64: true });
  mipmapFolder.file('ic_launcher_round.png', logoBase64, { base64: true });

  const mipmapXxxhdpiFolder = resFolder.folder('mipmap-xxxhdpi')!;
  mipmapXxxhdpiFolder.file('ic_launcher.png', logoBase64, { base64: true });
  mipmapXxxhdpiFolder.file('ic_launcher_round.png', logoBase64, { base64: true });

  if (splashBase64) {
    drawableFolder.file('splash_bg.png', splashBase64, { base64: true });
    drawableFolder.file('splash_image.png', splashBase64, { base64: true });
  } else {
    drawableFolder.file('splash_bg.png', logoBase64, { base64: true });
  }

  // Assets folder
  const assetsFolder = mainFolder.folder('assets')!;
  assetsFolder.file('app_config.json', generateAppConfigJson(config));
  assetsFolder.file('app_logo.png', logoBase64, { base64: true });
  if (config.googleServicesJson && config.googleServicesJson.trim()) {
    assetsFolder.file('google-services.json', config.googleServicesJson.trim());
  }
  if (splashBase64) {
    assetsFolder.file('splash_image.png', splashBase64, { base64: true });
  }

  // Readme instructions
  const isAdMob = config.adNetwork === 'admob';
  const isStartIo = config.adNetwork === 'startio';
  zip.file(
    'README.md',
    `# ${config.appName} - Android Fullscreen APK Project

Generated with Web to APK Creator.

## App Specifications
- **App Name**: ${config.appName}
- **Package Name**: ${config.packageName}
- **Target Website**: ${config.websiteUrl}
- **Min SDK**: 21 (Android 5.0 Lollipop+)
- **Target SDK**: 37 (Android 17 Cinnamon Bun)
- **Compile SDK**: 37 (Android 17 Cinnamon Bun)
- **APK Signature Schemes**: v1 (JAR), v2 (APK Signature Block), v3 (Key Rotation), v4 (Streaming / fs-verity)
- **Display Mode**: Pure Fullscreen Immersive Mode (No top status bar, no bottom navigation bar)
- **Ad Network**: ${config.adNetwork.toUpperCase()}
${
  isAdMob
    ? `- **AdMob SDK**: Google Mobile Ads (GMA) Next-Gen SDK (24.0.0)
- **AdMob App ID**: ${config.admob.appId || 'None'}
- **Banner Ad ID**: ${config.admob.bannerId || 'None'}
- **Interstitial Ad ID**: ${config.admob.interstitialId || 'None'}
- **Rewarded Ad ID**: ${config.admob.rewardedId || 'None'}`
    : ''
}
${
  isStartIo
    ? `- **Start.io SDK**: In-App SDK 5.1.0 (com.startapp:inapp-sdk:5.1.0)
- **Start.io App ID**: ${config.startio.appId}
- **Banner Ad**: ${config.startio.showBanner ? 'Enabled' : 'Disabled'}
- **Interstitial Ad**: ${config.startio.showInterstitial ? 'Enabled' : 'Disabled'}
- **Rewarded Ad**: ${config.startio.showRewarded ? 'Enabled' : 'Disabled'}`
    : ''
}

---

## How to Build the Release APK & AAB (for Real Ads & Production)

> **Important for Real Ads (Google AdMob & Start.io)**: 
> Always build a **Release APK** (\`./gradlew assembleRelease\`) or **Release AAB Bundle** (\`./gradlew bundleRelease\`). Debug builds (\`assembleDebug\`) will only display test ads. Release builds use the included production keystore and serve live, revenue-generating ads!

### Method 1: Command Line (Fastest & Recommended)
Run in the project directory:
\`\`\`bash
# Linux / macOS:
# 1. Build Signed Release APK (for Direct Phone Installation & Real Ads):
./gradlew assembleRelease

# 2. Build Signed Release AAB Bundle (for Google Play Store Publishing):
./gradlew bundleRelease

# Windows (Command Prompt / PowerShell):
gradlew.bat assembleRelease
gradlew.bat bundleRelease
\`\`\`

The generated files:
- **Signed Release APK**: \`app/build/outputs/apk/release/app-release.apk\`
- **Signed Release AAB Bundle**: \`app/build/outputs/bundle/release/app-release.aab\`

---

### Method 2: Using Android Studio (GUI)
1. Unzip / Extract this ZIP archive to your computer.
2. Open **Android Studio** and choose **Open**, then select this project folder.
3. Once Gradle Sync completes:
   - For Release APK / AAB: Go to **Build -> Generate Signed Bundle / APK**
   - Select **Android App Bundle (.aab)** for Google Play Store, or **APK (.apk)** for direct installation.
   - Use the included keystore file: \`app/release.keystore\` (Alias: \`${config.keystore?.keyAlias || 'androidkey'}\`, Password: \`${config.keystore?.storePassword || 'android'}\`).
   - Select the **release** build variant and click **Finish**.
4. Your signed production Release APK or AAB with Real Ads will be ready!
`
  );

  // Config backup
  zip.file('app-config.json', generateAppConfigJson(config));

  // Generate ZIP blob
  return await zip.generateAsync({ type: 'blob' });
}
