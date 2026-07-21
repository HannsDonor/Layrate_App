import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

const STORAGE_KEY = '@layrate_server_url';

async function probeIp(ip: string, timeoutMs = 800): Promise<boolean> {
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

async function scanSubnet(deviceIp: string): Promise<string | null> {
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
  return null;
}

export async function discoverServer(): Promise<string | null> {
  try {
    const deviceIp = await Network.getIpAddressAsync();
    if (!deviceIp || deviceIp === '0.0.0.0' || deviceIp.startsWith('127.')) {
      return null;
    }
    return await scanSubnet(deviceIp);
  } catch {
    return null;
  }
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
