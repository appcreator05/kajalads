# 📱 Web to APK Creator

> Convert any Website URL into a production-ready Android APK (.apk) & Google Play Store App Bundle (.aab) directly with **100% Fullscreen Immersive Mode**, **Real Google AdMob / Start.io Ads**, and **Custom Keystore Signing**.

---

## 🚀 How to Build the APK via GitHub Actions

This repository is pre-configured with **GitHub Actions CI/CD** (`.github/workflows/build-apk.yml`) and a native Android project wrapper (`/android`).

### 3 Simple Steps to Get Your APK:

1. **Push this Repository to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: APK Creator App"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/apk-creator.git
   git push -u origin main
   ```

2. **GitHub Actions Automatically Builds the APK:**
   - Go to your repository on GitHub.
   - Click the **Actions** tab.
   - You will see the **Build APK Creator Android App** workflow running automatically.
   - It compiles the web code, bundles it into the Android wrapper, and generates the APK files.

3. **Download & Install on Your Phone (2 Easy Options):**
   - **Option A (Direct Download via Releases):**
     Go to the main page of your GitHub repository. On the right sidebar, click **Releases** (or `v1.0.0`). Under **Assets**, click **`apk-creator-app.apk`** to download it directly!
   - **Option B (Via Actions Summary):**
     In the **Actions** tab, click on the completed workflow run. In the left navigation, make sure you are on the **Summary** tab (not inside the black console logs). Scroll down to the bottom **Artifacts** section, and click **`apk-creator-app`** to download the ZIP.
   - **Install on Phone:**
     Open the `.apk` file on your Android phone and tap **Install**!

---

## ⚡ Direct Mobile Install (PWA)

If you don't want to compile via GitHub:
1. Open this website URL in **Google Chrome** on your Android phone.
2. Tap the **3-dots menu (⋮)** in Chrome.
3. Tap **Install app** or **Add to Home screen**.
4. The APK Creator app will be installed directly on your phone as a standalone full-screen application!

---

## 🛠️ Local Development & Build

### 1. Web App
```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Build web distribution
npm run build
```

### 2. Android APK Build (via Gradle)
```bash
# 1. Build web assets & copy to Android assets
npm run build
mkdir -p android/app/src/main/assets/web
cp -r dist/* android/app/src/main/assets/web/

# 2. Compile APK using Gradle wrapper
cd android
chmod +x gradlew
./gradlew assembleDebug
```
The compiled APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## ✨ Key Features
- **Direct `.apk` & `.aab` Generation:** Download `.apk` for direct phone installation, or `.aab` for Google Play Store upload.
- **100% Fullscreen Immersive Mode:** No browser URL bar, top status bar, or navigation buttons.
- **Real Production Ads:** Pre-configured with Google AdMob (App ID, Banner, Interstitial, Rewarded) and Start.io SDK.
- **Custom Keystore Support:** Upload your existing `.jks` file or generate a new secure `.jks` key with 1 click.
- **Offline & Standalone Ready:** Complete PWA support with service worker precaching.
