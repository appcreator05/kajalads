import {
  DEFAULT_KEYSTORE_DATA_URL,
  DEFAULT_KEYSTORE_FILENAME,
  DEFAULT_KEY_ALIAS,
  DEFAULT_STORE_PASSWORD,
  DEFAULT_KEY_PASSWORD,
  DEFAULT_CERT_NAME,
  DEFAULT_ORG_NAME,
} from './utils/defaultKeystore';

export type AdNetwork = 'admob' | 'startio' | 'none';
export type CacheMode = 'no_cache' | 'default_cache' | 'highly_cached';
export type AppOrientation = 'auto_rotate' | 'portrait' | 'landscape';

export interface AppPermissions {
  internet: boolean;
  accessNetworkState: boolean;
  accessCoarseLocation: boolean;
  accessFineLocation: boolean;
  camera: boolean;
  readExternalStorage: boolean;
  writeExternalStorage: boolean;
  recordAudio: boolean;
  modifyAudioSettings: boolean;
  vibrate: boolean;
  wakeLock?: boolean;
  postNotifications?: boolean;
}

export interface AdMobConfig {
  appId: string;
  bannerId: string;
  interstitialId: string;
  rewardedId: string;
}

export interface StartIoConfig {
  appId: string;
  showBanner: boolean;
  showInterstitial: boolean;
  showRewarded: boolean;
}

export interface KeystoreConfig {
  useCustomKeystore: boolean;
  keystoreFileName: string;
  keystoreBase64?: string; // Uploaded .jks or .keystore file in base64
  storePassword: string;
  keyAlias: string;
  keyPassword: string;
  validityYears: number; // Google Play requires at least 25 years
  certificateName: string; // e.g. "WebToApk Publisher"
  organization: string; // e.g. "App Studio"
}

export interface AppConfig {
  appName: string;
  packageName: string;
  websiteUrl: string;
  appLogoUrl: string;
  splashImageUrl: string;
  splashDuration: number; // in seconds
  splashBgColor: string;

  // App Versioning
  versionName: string;
  versionCode: number;

  // App Orientation
  orientation: AppOrientation;

  // Webview & App Feature Checkboxes (Tickmarks)
  textSelection: boolean;
  saveFormData: boolean;
  fullscreenMode: boolean; // edge-to-edge immersive, no top/bottom navigation
  confirmOnExit: boolean;
  enableGpsPrompt: boolean;
  pullToRefresh: boolean;
  deepLinking: boolean;
  showProgressWheel: boolean; // Circular spinner when page loads and hides on finish
  useCustomTabs: boolean; // Open external links in Chrome Custom Tabs
  enablePaymentRedirects: boolean; // Handle payment gateways, popups, and wallet app return redirects
  keepScreenOn: boolean; // Keeps screen always awake, prevents display turn off / sleep

  // Cache Mode
  cacheMode: CacheMode;
  cacheEnabled: boolean; // backward compatibility

  // Ads Configuration
  adNetwork: AdNetwork;
  interstitialIntervalMinutes: number; // Minutes interval between interstitial ads
  admob: AdMobConfig;
  startio: StartIoConfig;

  // Permissions (Tickmark options)
  permissions: AppPermissions;

  // Keystore & Display
  keystore: KeystoreConfig;
  allowZoom: boolean;

  // Google Services & Firebase (google-services.json)
  googleServicesJson?: string;
  googleServicesFileName?: string;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  appName: '',
  packageName: '',
  websiteUrl: '',
  appLogoUrl: '/logo.png',
  splashImageUrl: '/splash.png',
  splashDuration: 2.5,
  splashBgColor: '#070b19',

  versionName: '1.0.0',
  versionCode: 1,

  orientation: 'portrait',

  textSelection: true,
  saveFormData: true,
  fullscreenMode: false,
  confirmOnExit: true,
  enableGpsPrompt: false,
  pullToRefresh: true,
  deepLinking: true,
  showProgressWheel: true,
  useCustomTabs: true,
  enablePaymentRedirects: true,
  keepScreenOn: true,

  cacheMode: 'default_cache',
  cacheEnabled: true,

  adNetwork: 'admob',
  interstitialIntervalMinutes: 3,
  admob: {
    appId: '', // Real Live AdMob App ID entered by user
    bannerId: '', // Real Live Banner ID
    interstitialId: '', // Real Live Interstitial ID
    rewardedId: '', // Real Live Rewarded ID
  },
  startio: {
    appId: '', // Real Live Start.io App ID entered by user
    showBanner: true,
    showInterstitial: true,
    showRewarded: true,
  },

  permissions: {
    internet: true,
    accessNetworkState: true,
    accessCoarseLocation: false,
    accessFineLocation: false,
    camera: false,
    readExternalStorage: true,
    writeExternalStorage: true,
    recordAudio: false,
    modifyAudioSettings: false,
    vibrate: true,
    wakeLock: true,
    postNotifications: true,
  },

  keystore: {
    useCustomKeystore: true,
    keystoreFileName: DEFAULT_KEYSTORE_FILENAME,
    keystoreBase64: DEFAULT_KEYSTORE_DATA_URL,
    storePassword: DEFAULT_STORE_PASSWORD,
    keyAlias: DEFAULT_KEY_ALIAS,
    keyPassword: DEFAULT_KEY_PASSWORD,
    validityYears: 25,
    certificateName: DEFAULT_CERT_NAME,
    organization: DEFAULT_ORG_NAME,
  },
  allowZoom: false,
  googleServicesJson: '',
  googleServicesFileName: '',
};

