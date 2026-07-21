import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl, getLaravelUrl, DEVICE_KEY } from '@/constants/config';
import { getToken } from '@/utils/auth';

const POLL_INTERVAL_KEY = '@layrate_poll_interval';

const isAndroid = Platform.OS === 'android';

const readInterval = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(POLL_INTERVAL_KEY);
  return raw ? Number(raw) : 60000;
};

function getModule() {
  if (!isAndroid) return null;
  const mod = NativeModules.PollServiceModule;
  if (!mod) {
    console.warn('[background] PollServiceModule is null — native module not linked');
    return null;
  }
  return mod;
}

export async function startBackgroundService() {
  const mod = getModule();
  if (!mod) return;

  const token = await getToken();
  if (!token) {
    console.warn('[background] No token, skipping service start');
    return;
  }

  const pollIntervalMs = await readInterval();
  console.log('[background] Starting foreground service, interval:', pollIntervalMs);

  try {
    mod.startService({
      flaskUrl: getApiBaseUrl(),
      laravelUrl: getLaravelUrl(),
      deviceKey: DEVICE_KEY,
      token,
      pollIntervalMs,
    });
  } catch (e) {
    console.error('[background] Failed to start service:', e);
  }
}

export function checkAuthStatus(): boolean {
  const mod = getModule();
  if (!mod) return false;
  try {
    return mod.isAuthFailed();
  } catch {
    return false;
  }
}

export function clearAuthFailed() {
  const mod = getModule();
  if (!mod) return;
  try {
    mod.clearAuthFailed();
  } catch {}
}

export async function stopBackgroundService() {
  const mod = getModule();
  if (!mod) return;

  try {
    mod.stopService();
    console.log('[background] Stopped foreground service');
  } catch (e) {
    console.error('[background] Failed to stop service:', e);
  }
}

export async function updateBackgroundInterval() {
  const mod = getModule();
  if (!mod) return;

  const pollIntervalMs = await readInterval();
  console.log('[background] Updating interval to:', pollIntervalMs);

  try {
    mod.updateInterval(pollIntervalMs);
  } catch (e) {
    console.error('[background] Failed to update interval:', e);
  }
}
