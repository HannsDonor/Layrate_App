import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { getToken, logout } from '@/utils/auth';
import { getApiBaseUrl } from '@/constants/config';
import LoginScreen from './login';
export default function AuthIndex() {
  const [session, setSession] = useState<'loading' | 'authenticated' | 'guest'>('loading');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setSession('guest');
        return;
      }

      try {
        const res = await fetch(`${getApiBaseUrl()}/api/dashboard/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setSession('authenticated');
        } else {
          await logout();
          setExpired(true);
          setSession('guest');
        }
      } catch {
        setSession('authenticated');
      }
    })();
  }, []);

  useEffect(() => {
    if (expired) {
      Alert.alert(
        'Session Expired',
        'Your account was logged in from another device.\nPlease sign in again.',
      );
    }
  }, [expired]);

  if (session === 'loading') return null;
  if (session === 'authenticated') return <Redirect href="/(tabs)" />;

  return <LoginScreen />;
}
