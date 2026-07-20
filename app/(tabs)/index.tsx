import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { fetchWithAuth, getToken, getUser, logout } from '@/utils/auth';
import { API_BASE_URL, LARAVEL_URL } from '@/constants/config';
import { startBackgroundService, stopBackgroundService, updateBackgroundInterval } from '@/utils/background';
import { updateWidgetData } from '@/utils/widget';
import { useSettings } from '@/app/contexts/SettingsContext';

const UPDATE_LOGS_KEY = '@layrate_update_logs';
const LAST_SEEN_KEY = '@layrate_last_seen';

const ONE_MINUTE = 60000;
const FIVE_MINUTES = 300000;
const ONE_HOUR = 3600000;
const ONE_DAY = 86400000;
const NAVY_0 = '#0A2647';
const NAVY_1 = '#0D3B66';

const POLL_PRESETS = [
  { label: '5 sec', value: 5000 },
  { label: '1 min', value: ONE_MINUTE },
  { label: '5 min', value: FIVE_MINUTES },
  { label: '15 min', value: FIVE_MINUTES * 3 },
  { label: '30 min', value: FIVE_MINUTES * 6 },
  { label: '1 hr', value: ONE_HOUR },
  { label: '6 hr', value: ONE_HOUR * 6 },
  { label: '24 hr', value: ONE_DAY },
] as const;

type IncubatorData = {
  temperature: number;
  humidity: number;
  eggCount: number;
  totalHens: number;
};

type UpdateLog = {
  timestamp: string;
  temperature: number | null;
  humidity: number | null;
  eggCount: number | null;
};

function ProgressRing({ size, strokeWidth, progress, color, bgColor = '#e6e6e6' }: { size: number; strokeWidth: number; progress: number; color: string; bgColor?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(progress, 0), 1));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={bgColor} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90, ${size / 2}, ${size / 2})`}
      />
    </Svg>
  );
}

function EggFill({ width, ratio, label }: { width: number; ratio: number; label: string }) {
  const eggPath = "M0,-26 C16,-26 24,-8 24,12 C24,32 15,40 0,40 C-15,40 -24,32 -24,12 C-24,-8 -16,-26 0,-26 Z";
  const EGG_W = 48;
  const EGG_H = 66;
  const EGG_BOTTOM = 40;
  const PAD = 7;
  const VB_W = EGG_W + PAD * 2;
  const VB_H = EGG_H + PAD * 2;
  const height = Math.round(width * (VB_H / VB_W));
  const fillH = ratio * EGG_H;
  const fillY = EGG_BOTTOM - fillH;

  const wavePath = fillH > 0
    ? `M-24,${fillY} C-16,${fillY - 3} -8,${fillY + 3} 0,${fillY} C8,${fillY - 3} 16,${fillY + 3} 24,${fillY} L24,${EGG_BOTTOM} L-24,${EGG_BOTTOM} Z`
    : '';

  return (
    <Svg width={width} height={height} viewBox={`${-EGG_W / 2 - PAD} ${-26 - PAD} ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
      <Defs>
        <ClipPath id="eggClip">
          <Path d={eggPath} />
        </ClipPath>
        <SvgGradient id="fillGrad" x1={0} y1={0} x2={0} y2={1}>
          <Stop offset={0} stopColor="#F5E6CC" stopOpacity={1} />
          <Stop offset={1} stopColor="#E3CDA4" stopOpacity={1} />
        </SvgGradient>
        <RadialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
          <Stop offset={0} stopColor="#B8BEC7" stopOpacity={0.15} />
          <Stop offset={1} stopColor="#B8BEC7" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Background glow circle */}
      <Circle cx={0} cy={7} r={36} fill="url(#bgGlow)" />

      {/* Drop shadow */}
      <Path d={eggPath} fill="rgba(0,0,0,0.08)" transform="translate(0, 3)" stroke="none" />

      {/* Outer glow */}
      <Path d={eggPath} fill="none" stroke="rgba(0,74,154,0.2)" strokeWidth={6} />

      {/* Fill gradient layer — clipped to egg */}
      {fillH > 0 && (
        <Path d={wavePath} fill="url(#fillGrad)" clipPath="url(#eggClip)" />
      )}

      {/* Glossy highlight on upper-left shell */}
      <Path
        d="M-16,-14 C-20,-6 -20,4 -16,12 C-12,4 -12,-6 -16,-14 Z"
        fill="rgba(255,255,255,0.25)"
        clipPath="url(#eggClip)"
      />

      {/* Egg outline */}
      <Path d={eggPath} fill="none" stroke="#B8BEC7" strokeWidth={3} />

      {/* Percentage label with background chip */}
      <Rect x={-20} y={-2} width={40} height={16} rx={8} fill="rgba(255,255,255,0.85)" />
      <SvgText x={0} y={8} textAnchor="middle" fontSize={9} fontWeight="bold">
        {label}
      </SvgText>
    </Svg>
  );
}

function DotPattern({ color }: { color?: string }) {
  const dots: { cx: number; cy: number }[] = [];
  for (let row = 0; row < 30; row++) {
    for (let col = 0; col < 12; col++) {
      dots.push({ cx: 30 + col * 30 + (row % 2) * 15, cy: 40 + row * 30 });
    }
  }
  const fill = color ?? 'rgba(255,255,255,0.07)';
  return (
    <Svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.cx} cy={d.cy} r={1.2} fill={fill} />
      ))}
    </Svg>
  );
}

export default function DashboardScreen() {
  const [data, setData] = useState<IncubatorData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pollInterval, changePollInterval: ctxChangePollInterval } = useSettings();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [missedUpdates, setMissedUpdates] = useState<UpdateLog[]>([]);
  const [missedVisible, setMissedVisible] = useState(false);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasBackground = useRef(false);
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextUpdate = useRef<number>(0);
  const authHandled = useRef(false);

  const headerDoodles = useMemo(() => {
    const result: { x: number; y: number; size: number; rotation: number }[] = [];
    for (let i = 0; i < 40; i++) {
      result.push({
        x: Math.random() * 90 + 5,
        y: Math.random() * 80 + 10,
        size: Math.random() * 14 + 12,
        rotation: Math.random() * 60 - 30,
      });
    }
    return result;
  }, []);

  useEffect(() => {
    getUser().then((u) => setUser(u));
  }, []);

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync('#F5F5F7');
    NavigationBar.setButtonStyleAsync('dark');
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2000);
  }, []);

  const changePollInterval = useCallback(async (ms: number) => {
    await ctxChangePollInterval(ms);
    updateBackgroundInterval();
    showToast();
  }, [ctxChangePollInterval, showToast]);

  const fetchLiveData = async () => {
    try {
      setUpdating(true);
      setError(null);
      const response = await fetchWithAuth('/api/dashboard/status');

      if (response.status === 401) {
        const body = await response.text().catch(() => '');
        console.error('Auth failed (401), re-login required:', body);
        await stopBackgroundService();
        await logout();
        Alert.alert(
          'Session Expired',
          'Your account was logged in from another device.\nPlease sign in again to continue monitoring.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
        );
        return;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Server error: ${response.status}${body ? ` — ${body}` : ''}`);
      }

      const result = await response.json();
      setData({
        temperature: result.temperature,
        humidity: result.humidity,
        eggCount: result.egg_count,
        totalHens: result.total_hens,
      });
      setLastUpdated(new Date());
      const gaugeRatio = result.total_hens > 0
        ? Math.min(result.egg_count / result.total_hens, 1)
        : 0;
      updateWidgetData({
        eggCount: String(result.egg_count ?? '--'),
        temperature: result.temperature != null ? `${result.temperature.toFixed(1)}°` : '--°',
        humidity: result.humidity != null ? `${result.humidity}%` : '--%',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      // Persist to update log (only when egg count changes)
      try {
        const logsJson = await AsyncStorage.getItem(UPDATE_LOGS_KEY);
        const logs: UpdateLog[] = logsJson ? JSON.parse(logsJson) : [];
        const newEggCount = result.egg_count ?? null;
        const lastLog = logs[logs.length - 1];
        if (!lastLog || lastLog.eggCount !== newEggCount) {
          logs.push({
            timestamp: new Date().toISOString(),
            temperature: result.temperature ?? null,
            humidity: result.humidity ?? null,
            eggCount: newEggCount,
          });
          await AsyncStorage.setItem(UPDATE_LOGS_KEY, JSON.stringify(logs.slice(-10)));
        }
      } catch {}
    } catch (err) {
      const isNetworkError = err instanceof TypeError && err.message?.includes('Network request failed');
      const message = isNetworkError
        ? 'Please connect to your Layrate hotspot network'
        : (err instanceof Error ? err.message : 'Failed to fetch live data');
      setError(message);
      console.error('Live monitoring error:', err);
    } finally {
      setUpdating(false);
    }
  };

  const scheduleTimers = useCallback(() => {
    if (statusTimer.current) clearInterval(statusTimer.current);
    fetchLiveData();
    statusTimer.current = setInterval(fetchLiveData, pollInterval);
  }, [pollInterval]);

  useEffect(() => {
    scheduleTimers();
    startBackgroundService();
    return () => {
      if (statusTimer.current) clearInterval(statusTimer.current);
    };
  }, [scheduleTimers]);

  useEffect(() => {
    nextUpdate.current = Date.now() + pollInterval;
    setCountdown(Math.floor(pollInterval / 1000));

    const tick = setInterval(() => {
      const remain = Math.max(0, Math.round((nextUpdate.current - Date.now()) / 1000));
      setCountdown(remain);
    }, 1000);

    return () => {
      clearInterval(tick);
      authHandled.current = false;
    };
  }, [pollInterval, lastUpdated]);

  const triggerSessionExpired = useCallback(async () => {
    if (authHandled.current) return;
    authHandled.current = true;
    await stopBackgroundService();
    await logout();
    Alert.alert(
      'Session Expired',
      'Your account was logged in from another device.\nPlease sign in again to continue monitoring.',
      [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const res = await fetch(`${API_BASE_URL}/api/dashboard/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 && !cancelled) {
          triggerSessionExpired();
        }
      } catch {}
    };
    check();
    const authTimer = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(authTimer);
    };
  }, [triggerSessionExpired]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        wasBackground.current = true;
      }
      if (state === 'active') {
        // Show missed updates when returning from background
        if (wasBackground.current) {
          wasBackground.current = false;
          try {
            const [logsJson, lastSeenJson] = await Promise.all([
              AsyncStorage.getItem(UPDATE_LOGS_KEY),
              AsyncStorage.getItem(LAST_SEEN_KEY),
            ]);
            setLastSeenTimestamp(lastSeenJson);
            if (logsJson) {
              const logs: UpdateLog[] = JSON.parse(logsJson);
              if (logs.length > 0) {
                setMissedUpdates(logs.slice().reverse());
                setMissedVisible(true);
              }
            }
          } catch {}
        }
        // Auth check
        try {
          const token = await getToken();
          if (!token) return;
          const res = await fetch(`${API_BASE_URL}/api/dashboard/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.status === 401) {
            triggerSessionExpired();
          }
        } catch {}
      }
    });
    return () => sub.remove();
  }, [triggerSessionExpired]);

  const handleLogout = async () => {
    await stopBackgroundService();
    await logout();
    router.replace('/(auth)/login');
  };

  const handleUpdateNow = () => {
    fetchLiveData();
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const isLive = data !== null && !error;
  const countdownProgress = pollInterval > 0 ? countdown / (pollInterval / 1000) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <DotPattern color="rgba(80,80,80,0.15)" />
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

          {/* ═══ HEADER ═══ */}
          <View className="h-24">
            <Svg width="100%" height="100%" style={{ position: 'absolute' }} preserveAspectRatio="xMidYMid slice" viewBox="0 0 375 96">
                <Defs>
                  <SvgGradient id="headerBg" x1={0} y1={0} x2={1} y2={1}>
                    <Stop offset={0} stopColor={NAVY_0} />
                    <Stop offset={1} stopColor={NAVY_1} />
                  </SvgGradient>
                </Defs>
                <Rect x={0} y={0} width="100%" height="100%" fill="url(#headerBg)" />
            </Svg>
            <DotPattern />

            {/* Doodle eggs */}
            <View className="absolute inset-0" pointerEvents="none">
              {headerDoodles.map((d, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${d.x}%`,
                    top: `${d.y}%`,
                    transform: [{ rotate: `${d.rotation}deg` }],
                    opacity: 0.12,
                  }}
                >
                  <MaterialCommunityIcons name="egg" size={d.size} color="#ffffff" />
                </View>
              ))}
            </View>

            {/* Header content */}
            <View className="flex-1 px-5 justify-center">
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mr-3">
                  <MaterialCommunityIcons name="egg" size={26} color="#ffffff" />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-2xl font-black tracking-wider" style={{ fontFamily: 'serif' }}>
                    Layrate
                  </Text>
                  {user && (
                    <Text className="text-white/55 text-xs">{user.email}</Text>
                  )}
                </View>
                {isLive ? (
                  <View className="bg-white/15 rounded-full px-4 py-2 flex-row items-center gap-1.5 border border-white/10">
                    <View className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#22c55e', shadowColor: '#22c55e', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 5, elevation: 3 }} />
                    <Text className="text-white text-sm font-bold tracking-wider">Live</Text>
                  </View>
                ) : (
                  <View className="bg-white/15 rounded-full px-4 py-2 flex-row items-center gap-1.5 border border-white/10">
                    <View className="w-[10px] h-[10px] rounded-full bg-[#dd5b00]" />
                    <Text className="text-white text-sm font-bold tracking-wider">Reconnecting</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ═══ TODAY'S STATS ═══ */}
          <View className="px-5 pt-6 pb-2 flex-row items-center justify-between">
            <Text className="text-[#8e8e93] text-[12px] font-semibold uppercase tracking-widest">Today's Stats</Text>
            {lastUpdated && (
              <View className="bg-white rounded-full px-3 py-1 border border-[#e6e6e6]">
                <Text className="text-[#a39e98] text-[11px] font-medium">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          </View>

          {/* ═══ ERROR BANNER ═══ */}
          {error && (
            <View className="mx-5 mt-2 bg-[#fde8e8] rounded-2xl px-4 py-3">
              <Text className="text-[#c62828] text-sm font-medium">{error}</Text>
            </View>
          )}

          {/* ═══ TOTAL EGGS HERO CARD ═══ */}
          <View className="mx-5 mt-2 rounded-2xl bg-white" style={{ elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }}>
            <View className="px-5 pt-5 pb-5">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 rounded-full" style={{ backgroundColor: `${NAVY_0}15` }}>
                  <MaterialCommunityIcons name="egg-outline" size={18} color={NAVY_0} style={{ textAlignVertical: 'center', lineHeight: 32, textAlign: 'center' }} />
                </View>
                <Text className="text-[#8e8e93] text-[12px] font-semibold uppercase tracking-wider">Total Eggs</Text>
              </View>
              <View className="flex-row items-center justify-center" style={{ gap: 70 }}>
                <View>
                  <Text className="text-6xl font-bold tracking-tighter text-center" style={{ color: NAVY_0 }}>
                    {data ? data.eggCount : '--'}
                  </Text>
                  <Text className="text-[#a39e98] text-base font-semibold mt-1 text-center">Eggs Today</Text>
                </View>
                {data && data.totalHens > 0 && (
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[#8e8e93] text-sm font-bold uppercase tracking-wider">HDEP:</Text>
                    <EggFill
                      width={100}
                      ratio={Math.min(data.eggCount / data.totalHens, 1)}
                      label={`${((data.eggCount / data.totalHens) * 100).toFixed(1)}%`}
                    />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ═══ ENVIRONMENT ═══ */}
          <View className="px-5 pt-7 pb-3">
            <Text className="text-[#8e8e93] text-[12px] font-semibold uppercase tracking-widest">Environment</Text>
          </View>

          {/* ═══ TEMP & HUMIDITY CARDS ═══ */}
          <View className="px-5 flex-row gap-3">
            {/* Temperature */}
            <View className="flex-1 rounded-2xl overflow-hidden" style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, backgroundColor: '#fff8f0' }}>
              <View className="h-1" style={{ backgroundColor: '#dd5b00' }} />
              <View className="p-5" style={{ minHeight: 90 }}>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5 mb-3">
                    <View className="w-7 h-7 rounded-full bg-[#dd5b00]/10 items-center justify-center">
                      <MaterialCommunityIcons name="thermometer" size={16} color="#dd5b00" />
                    </View>
                    <Text className="text-[#8e8e93] text-[12px] font-semibold uppercase tracking-wider">Temperature</Text>
                  </View>
                  <Text className="text-4xl font-bold tracking-tighter" style={{ color: '#1a1a1a' }}>
                    {data ? `${data.temperature.toFixed(1)}°` : '--'}
                  </Text>
                  <Text className="text-[#a39e98] text-xs mt-1">Celsius</Text>
                </View>
                <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                  <ProgressRing size={52} strokeWidth={4} progress={data ? data.temperature / 50 : 0} color="#dd5b00" bgColor="#f0d6c5" />
                </View>
              </View>
            </View>

            {/* Humidity */}
            <View className="flex-1 rounded-2xl overflow-hidden" style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, backgroundColor: '#f0faf9' }}>
              <View className="h-1" style={{ backgroundColor: '#2a9d99' }} />
              <View className="p-5" style={{ minHeight: 90 }}>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5 mb-3">
                    <View className="w-7 h-7 rounded-full bg-[#2a9d99]/10 items-center justify-center">
                      <MaterialCommunityIcons name="water-percent" size={16} color="#2a9d99" />
                    </View>
                    <Text className="text-[#8e8e93] text-[12px] font-semibold uppercase tracking-wider">Humidity</Text>
                  </View>
                  <Text className="text-4xl font-bold tracking-tighter" style={{ color: '#1a1a1a' }}>
                    {data ? `${data.humidity}%` : '--'}
                  </Text>
                  <Text className="text-[#a39e98] text-xs mt-1">Percent</Text>
                </View>
                <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                  <ProgressRing size={52} strokeWidth={4} progress={data ? data.humidity / 100 : 0} color="#2a9d99" bgColor="#c5e3e1" />
                </View>
              </View>
            </View>
          </View>

          {/* ═══ CONTROLS ═══ */}
          <View className="px-5 pt-6 pb-2">
            <Text className="text-[#8e8e93] text-[12px] font-semibold uppercase tracking-widest">Refresh Data</Text>
          </View>
          <View className="mx-5 rounded-2xl bg-white p-6 items-center" style={{ elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }}>
            <Pressable
              onPress={handleUpdateNow}
              disabled={updating}
              className={`flex-row items-center justify-center gap-3 rounded-xl h-[60px] px-10 active:opacity-90 ${updating ? 'opacity-50' : ''}`}
              style={{
                backgroundColor: NAVY_1,
                elevation: 4,
                shadowColor: NAVY_1,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.35,
                shadowRadius: 6,
              }}
            >
              <View className="relative w-10 h-10 items-center justify-center">
                <View style={{ position: 'absolute' }}>
                  <ProgressRing size={40} strokeWidth={3} progress={1 - countdownProgress} color="rgba(255,255,255,0.4)" bgColor="rgba(255,255,255,0.12)" />
                </View>
                <MaterialCommunityIcons name="refresh" size={20} color="#ffffff" />
              </View>
              <Text className="text-white text-lg font-bold tracking-wide">Update Now</Text>
            </Pressable>
            <Text className="text-[#a39e98] text-sm mt-3">
              {countdown > 0 ? `Next update in ${formatCountdown(countdown)}` : 'Updating...'}
            </Text>
          </View>

          <View className="h-32" />
        </ScrollView>
      </SafeAreaView>

      {/* Settings FAB */}
      <Pressable
        onPress={() => setSettingsVisible(true)}
        className="absolute bottom-7 right-5 w-[56px] h-[56px] rounded-full items-center justify-center"
        style={{
          backgroundColor: NAVY_1,
          elevation: 6,
          shadowColor: NAVY_0,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        }}
      >
        <MaterialCommunityIcons name="cog-outline" size={28} color="#ffffff" />
      </Pressable>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable className="flex-1 justify-end bg-black/20" onPress={() => setSettingsVisible(false)}>
          <Pressable className="bg-white rounded-t-[16px] px-6 pt-5 pb-10 gap-5" onPress={(e) => e.stopPropagation()}>
            <View className="w-8 h-[3.5px] rounded-sm bg-[#e6e6e6] self-center" />

            {/* Settings toast inside drawer */}
            {toastVisible && (
              <View className="bg-[#22c55e] rounded-[8px] px-5 py-3 items-center">
                <Text className="text-white text-[15px] font-semibold">Settings Updated Successfully!</Text>
              </View>
            )}

            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons name="tune-vertical" size={18} color="#a39e98" />
              <Text className="text-[#1a1a1a] text-lg font-bold tracking-tight">Settings</Text>
            </View>

            <Text className="text-[#a39e98] text-[11px] font-semibold uppercase tracking-widest">Update Interval</Text>
            <View className="flex-row flex-wrap gap-2">
              {POLL_PRESETS.map((opt) => (
                <Pressable
                  key={opt.label}
                  onPress={() => changePollInterval(opt.value)}
                  className={`px-4 py-2 rounded-[8px] border items-center active:opacity-60 ${pollInterval === opt.value ? 'border-[#004e9a] bg-[#e6f0fe]' : 'border-[#e6e6e6] bg-white'}`}
                >
                  <Text className={`text-sm ${pollInterval === opt.value ? 'text-[#004e9a] font-semibold' : 'text-[#1a1a1a] font-medium'}`}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="h-px bg-[#e6e6e6] my-1" />
            <View className="flex-row justify-between">
              <Pressable
                onPress={() => {
                  const url = `${LARAVEL_URL}/login`;
                  Linking.openURL(url).catch((e) => console.error('Linking failed:', url, e));
                }}
                className="flex-row items-center gap-2 py-3 px-4 rounded-[8px] active:opacity-80"
                style={{ backgroundColor: NAVY_1 }}
              >
                <MaterialCommunityIcons name="web" size={16} color="#ffffff" />
                <Text className="text-white text-sm font-semibold">Visit Web App</Text>
              </Pressable>
              <Pressable
                onPress={handleLogout}
                className="flex-row items-center gap-2 py-3 px-4 rounded-[8px] active:opacity-80"
                style={{ backgroundColor: '#dd5b00' }}
              >
                <MaterialCommunityIcons name="logout" size={16} color="#ffffff" />
                <Text className="text-white text-sm font-semibold">Log Out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Missed Updates Modal */}
      <Modal visible={missedVisible} transparent animationType="fade" onRequestClose={() => setMissedVisible(false)}>
        <View className="flex-1 justify-center items-center bg-black/20">
          <Pressable className="bg-white rounded-[16px] mx-5 w-[90%] max-h-[70%] overflow-hidden">
            <View className="px-5 pt-5 pb-3 border-b border-[#e6e6e6]">
              <Text className="text-[#1a1a1a] text-lg font-bold">While You Were Away</Text>
              <Text className="text-[#a39e98] text-sm mt-0.5">{missedUpdates.length} updates recorded</Text>
            </View>
            <ScrollView className="px-5 py-2" style={{ maxHeight: 400 }}>
              {missedUpdates.map((log, i) => (
                <View key={i} className={`py-3 px-3 rounded-lg border-b ${lastSeenTimestamp != null && log.timestamp > lastSeenTimestamp ? 'bg-[#e8f5e9] border-l-4 border-l-[#4caf50]' : 'border-[#f0f0f0]'}`}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[#a39e98] text-xs">
                      {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      {' '}
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {lastSeenTimestamp != null && log.timestamp > lastSeenTimestamp && (
                      <View className="bg-[#4caf50] rounded-[4px] px-1.5 py-0.5">
                        <Text className="text-white text-[10px] font-bold">NEW</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row gap-3 mt-1.5">
                    <View className="flex-row items-center gap-1">
                      <View className="w-5 h-5 rounded-full bg-[#dd5b00]/10 items-center justify-center">
                        <MaterialCommunityIcons name="thermometer" size={10} color="#dd5b00" />
                      </View>
                      <Text className="text-[#1a1a1a] text-sm font-semibold">
                        {log.temperature != null ? `${log.temperature.toFixed(1)}°` : '--°'}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <View className="w-5 h-5 rounded-full bg-[#2a9d99]/10 items-center justify-center">
                        <MaterialCommunityIcons name="water-percent" size={10} color="#2a9d99" />
                      </View>
                      <Text className="text-[#1a1a1a] text-sm font-semibold">
                        {log.humidity != null ? `${log.humidity}%` : '--%'}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <View className="w-5 h-5 rounded-full bg-[#0A2647]/10 items-center justify-center">
                        <MaterialCommunityIcons name="egg-outline" size={10} color="#0A2647" />
                      </View>
                      <Text className="text-[#1a1a1a] text-sm font-semibold">
                        {log.eggCount != null ? String(log.eggCount) : '--'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable
              onPress={async () => {
                const now = new Date().toISOString();
                await AsyncStorage.setItem(LAST_SEEN_KEY, now);
                setLastSeenTimestamp(now);
                setMissedVisible(false);
              }}
              className="mx-5 mb-4 mt-2 rounded-[8px] h-[48px] items-center justify-center"
              style={{ backgroundColor: NAVY_1 }}
            >
              <Text className="text-white text-base font-bold">Got it</Text>
            </Pressable>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
