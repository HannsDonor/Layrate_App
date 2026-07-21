import AsyncStorage from '@react-native-async-storage/async-storage';
import Zeroconf from 'react-native-zeroconf';

const STORAGE_KEY = '@layrate_server_url';
const SERVICE_NAME = 'Layrate Server';
const SCAN_TIMEOUT = 4000;

/**
 * Discover the Layrate server on the LAN via mDNS (zeroconf).
 * Resolves with the base URL (e.g. "http://192.168.1.100:5000") or null.
 */
export function discoverServer(): Promise<string | null> {
  return new Promise((resolve) => {
    const zc = new Zeroconf();
    const timer = setTimeout(() => {
      zc.stop();
      zc.removeDeviceListeners();
      resolve(null);
    }, SCAN_TIMEOUT);

    zc.on('resolved', (service: any) => {
      if (service.name === SERVICE_NAME) {
        clearTimeout(timer);
        zc.stop();
        zc.removeDeviceListeners();
        const ip = service.host || (service.addresses && service.addresses[0]);
        if (ip) {
          resolve(`http://${ip}:${service.port}`);
        } else {
          resolve(null);
        }
      }
    });

    zc.on('error', () => {
      clearTimeout(timer);
      zc.stop();
      zc.removeDeviceListeners();
      resolve(null);
    });

    zc.scan('http', 'tcp', 'local.');
  });
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
