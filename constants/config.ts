import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolve the host machine's IP address reachable by the device.
 *
 * - **Expo Go** (physical device): extracts the IP from the bundler's `hostUri`
 *   (e.g. `192.168.254.107:8081` → `192.168.254.107`).
 * - **Android emulator**: uses `10.0.2.2` (special alias for host loopback).
 * - **iOS simulator**: uses `localhost`.
 */
function resolveHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return hostUri.split(':')[0];
  }
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  return '127.0.0.1';
}

const host = resolveHost();

export const API_BASE_URL = `http://${host}:5000`;
export const LARAVEL_URL = `http://${host}:8000`;
export const DEVICE_KEY = 'lr_3EXO8fHo5wXRfk4gl2pImfNJyaX817OdbNWL4syf';
