/**
 * Authentication & Pairing Module for PalrixShowWebOps
 * Handles Seller Passkey, QR Code pairing, and credentials storage.
 */

const STORAGE_KEY = 'palrix_show_web_ops_auth_v1';

export function parsePairingKey(keyString) {
  if (!keyString || typeof keyString !== 'string') return null;
  const trimmed = keyString.trim();

  // Try parsing direct JSON
  try {
    const json = JSON.parse(trimmed);
    if (json.token && json.repo) {
      return {
        token: json.token,
        repo: json.repo,
        branch: json.branch || 'main',
        sellerId: json.sellerId || 'palrix-fashion'
      };
    }
  } catch (e) {
    // Not raw JSON, try prefixed Base64
  }

  // Check for psw_v1 prefix format
  if (trimmed.startsWith('psw_v1:')) {
    try {
      const b64 = trimmed.substring(7);
      const decoded = atob(b64);
      const json = JSON.parse(decoded);
      return {
        token: json.token,
        repo: json.repo,
        branch: json.branch || 'main',
        sellerId: json.sellerId || 'palrix-fashion'
      };
    } catch (e) {
      console.error('Failed to decode psw_v1 key', e);
    }
  }

  // Check for simple token
  if (trimmed.startsWith('ghp_') || trimmed.startsWith('github_pat_')) {
    return {
      token: trimmed,
      repo: 'palrixtech/PalrixShow',
      branch: 'main',
      sellerId: 'palrix-fashion'
    };
  }

  return null;
}

export function generatePairingKey(config) {
  const payload = {
    token: config.token,
    repo: config.repo || 'palrixtech/PalrixShow',
    branch: config.branch || 'main',
    sellerId: config.sellerId || 'palrix-fashion',
    created: new Date().toISOString()
  };
  return 'psw_v1:' + btoa(JSON.stringify(payload));
}

export function getAuthConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load auth config', e);
    return null;
  }
}

export function setAuthConfig(config) {
  const cleanConfig = {
    token: config.token.trim(),
    repo: (config.repo || 'palrixtech/PalrixShow').trim(),
    branch: (config.branch || 'main').trim(),
    sellerId: (config.sellerId || 'palrix-fashion').trim()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanConfig));
  return cleanConfig;
}

export function clearAuthConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated() {
  const config = getAuthConfig();
  return !!(config && config.token && config.repo);
}
