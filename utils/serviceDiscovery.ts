import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@layrate_server_url';

// ── mDNS discovery via react-native-zeroconf (optional) ─────────────────

let Zeroconf: any = null;
try {
  Zeroconf = require('react-native-zeroconf').default;
} catch {}

function discoverMdns(timeout: number): Promise<string | null> {
  if (!Zeroconf) return Promise.resolve(null);

  try {
    return new Promise((resolve) => {
      try {
        const zc = new Zeroconf();
        const timer = setTimeout(() => {
          try { zc.stop(); } catch {}
          try { zc.removeDeviceListeners(); } catch {}
          resolve(null);
        }, timeout);

        zc.on('resolved', (service: any) => {
          if (service.name === 'Layrate Server') {
            clearTimeout(timer);
            try { zc.stop(); } catch {}
            try { zc.removeDeviceListeners(); } catch {}
            const ip = service.host || (service.addresses && service.addresses[0]);
            resolve(ip ? `http://${ip}:${service.port}` : null);
          }
        });

        zc.on('error', () => {
          clearTimeout(timer);
          try { zc.stop(); } catch {}
          try { zc.removeDeviceListeners(); } catch {}
          resolve(null);
        });

        zc.scan('http', 'tcp', 'local.');
      } catch {
        resolve(null);
      }
    });
  } catch {
    return Promise.resolve(null);
  }
}

// ── Fallback: full /24 subnet scan via HTTP probe ───────────────────────

async function probeIp(ip: string, timeoutMs = 600): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`http://${ip}:5000/api/ping`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    return resp.ok;
  } catch {
    return false;
  }
}

async function scanSubnet(): Promise<string | null> {
  try {
    const Network = require('expo-network');
    const deviceIp = await Network.getIpAddressAsync();
    if (!deviceIp || deviceIp === '0.0.0.0' || deviceIp.startsWith('127.')) return null;

    const parts = deviceIp.split('.');
    if (parts.length !== 4) return null;
    const subnet = parts.slice(0, 3).join('.');

    const candidates = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);

    const results = await Promise.allSettled(
      candidates.map(async (ip) => {
        const ok = await probeIp(ip);
        return ok ? ip : null;
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        return `http://${r.value}:5000`;
      }
    }
  } catch {}
  return null;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Discover the Layrate server on the LAN.
 *
 * 1. Tries mDNS (zeroconf) — fast, zero-config, 2s timeout.
 * 2. Falls back to subnet HTTP probe — scans all 254 IPs, ~600ms total.
 * 3. Returns the base URL (e.g. "http://192.168.1.100:5000") or null.
 */
export async function discoverServer(): Promise<string | null> {
  const fromMdns = await discoverMdns(2000);
  if (fromMdns) return fromMdns;
  return scanSubnet();
}

export async function getSavedServerUrl(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function saveServerUrl(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, url);
  } catch {}
}
