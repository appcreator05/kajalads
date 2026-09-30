export interface ParsedGoogleServices {
  isValid: boolean;
  error?: string;
  projectId?: string;
  projectNumber?: string;
  storageBucket?: string;
  firebaseUrl?: string;
  packageName?: string;
  appId?: string;
  apiKey?: string;
  oauthClientId?: string;
  clientCount?: number;
  rawJson?: string;
}

export function parseGoogleServicesJson(jsonString: string): ParsedGoogleServices {
  if (!jsonString || !jsonString.trim()) {
    return { isValid: false };
  }

  try {
    const data = JSON.parse(jsonString.trim());
    
    if (typeof data !== 'object' || data === null) {
      return { isValid: false, error: 'Invalid JSON format' };
    }

    const projectInfo = data.project_info || {};
    const clients = Array.isArray(data.client) ? data.client : [];
    const firstClient = clients[0] || {};
    const clientInfo = firstClient.client_info || {};
    const androidClientInfo = clientInfo.android_client_info || {};
    const apiKeys = Array.isArray(firstClient.api_key) ? firstClient.api_key : [];
    const oauthClients = Array.isArray(firstClient.oauth_client) ? firstClient.oauth_client : [];

    const projectId = projectInfo.project_id || '';
    const projectNumber = projectInfo.project_number || '';
    const storageBucket = projectInfo.storage_bucket || '';
    const firebaseUrl = projectInfo.firebase_url || '';
    const packageName = androidClientInfo.package_name || '';
    const appId = clientInfo.mobilesdk_app_id || '';
    const apiKey = apiKeys[0]?.current_key || '';
    const oauthClientId = oauthClients[0]?.client_id || '';

    // Check if at least minimal required Firebase indicators exist
    const hasFirebaseIndicators = Boolean(
      projectId || appId || packageName || data.configuration_version
    );

    if (!hasFirebaseIndicators) {
      return {
        isValid: false,
        error: 'JSON file does not appear to be a valid google-services.json from Firebase Console.',
      };
    }

    return {
      isValid: true,
      projectId,
      projectNumber,
      storageBucket,
      firebaseUrl,
      packageName,
      appId,
      apiKey,
      oauthClientId,
      clientCount: clients.length,
      rawJson: jsonString,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `JSON parse error: ${err?.message || 'Syntax error'}`,
    };
  }
}

export function getFirebaseWebConfig(parsed: ParsedGoogleServices) {
  if (!parsed.isValid) return null;
  return {
    apiKey: parsed.apiKey || '',
    authDomain: parsed.projectId ? `${parsed.projectId}.firebaseapp.com` : '',
    projectId: parsed.projectId || '',
    storageBucket: parsed.storageBucket || (parsed.projectId ? `${parsed.projectId}.appspot.com` : ''),
    messagingSenderId: parsed.projectNumber || '',
    appId: parsed.appId || '',
  };
}
