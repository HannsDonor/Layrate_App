import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const POLL_INTERVAL_KEY = '@layrate_poll_interval';

type SettingsContextType = {
  pollInterval: number;
  changePollInterval: (ms: number) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [pollInterval, setPollInterval] = useState(60000);

  useEffect(() => {
    AsyncStorage.getItem(POLL_INTERVAL_KEY).then((saved) => {
      if (saved) setPollInterval(parseInt(saved, 10));
    });
  }, []);

  const changePollInterval = useCallback(async (ms: number) => {
    setPollInterval(ms);
    await AsyncStorage.setItem(POLL_INTERVAL_KEY, String(ms));
  }, []);

  return (
    <SettingsContext.Provider value={{ pollInterval, changePollInterval }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
