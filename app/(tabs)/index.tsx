import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { fetchWithAuth, getToken, getUser, logout } from '@/utils/auth';
import { API_BASE_URL } from '@/constants/config';
import { startBackgroundService, stopBackgroundService, updateBackgroundInterval } from '@/utils/background';
import { updateWidgetData } from '@/utils/widget';

const FONT_SCALE_KEY = '@layrate_font_scale';
const POLL_INTERVAL_KEY = '@layrate_poll_interval';

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

const FONT_SIZES = [
  { label: 'Small', value: 0.85 },
  { label: 'Medium', value: 1.0 },
  { label: 'Large', value: 1.15 },
] as const;

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
          <Stop offset={0} stopColor="#5FBFB3" stopOpacity={1} />
          <Stop offset={1} stopColor="#1E8A7A" stopOpacity={1} />
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
      <SvgText x={0} y={8} textAnchor="middle" fontSize={13} fontWeight="700" fill={NAVY_0} fontFamily="serif">
        {label}
      </SvgText>
    </Svg>
  );
}

function DotPattern() {
  const dots: { cx: number; cy: number }[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 12; col++) {
      dots.push({ cx: 30 + col * 30 + (row % 2) * 15, cy: 40 + row * 30 });
    }
  }
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.cx} cy={d.cy} r={1.2} fill="rgba(255,255,255,0.07)" />
      ))}
    </Svg>
  );
}

export default function DashboardScreen() {
  const [data, setData] = useState<IncubatorData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState(1.0);
  const [pollInterval, setPollInterval] = useState(ONE_MINUTE);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextUpdate = useRef<number>(0);
  const authHandled = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(FONT_SCALE_KEY).then((saved) => {
      if (saved) setFontScale(parseFloat(saved));
    });
    AsyncStorage.getItem(POLL_INTERVAL_KEY).then((saved) => {
      if (saved) setPollInterval(parseInt(saved, 10));
    });
    getUser().then((u) => setUser(u));
  }, []);

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync('#F5F5F7');
    NavigationBar.setButtonStyleAsync('dark');
  }, []);

  const changeFontScale = useCallback(async (scale: number) => {
    setFontScale(scale);
    await AsyncStorage.setItem(FONT_SCALE_KEY, String(scale));
  }, []);

  const changePollInterval = useCallback(async (ms: number) => {
    setPollInterval(ms);
    await AsyncStorage.setItem(POLL_INTERVAL_KEY, String(ms));
    updateBackgroundInterval();
  }, []);

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
      const remain = Math.max(0, Math.floor((nextUpdate.current - Date.now()) / 1000));
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
      if (state === 'active') {
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

  const fs = (base: number) => Math.round(base * fontScale);

  const isLive = data !== null && !error;
  const countdownProgress = pollInterval > 0 ? countdown / (pollInterval / 1000) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

          {/* ═══ HEADER ═══ */}
          <View className="h-20 overflow-hidden">
            <Svg width="100%" height="100%" style={{ position: 'absolute' }} preserveAspectRatio="xMidYMid slice" viewBox="0 0 375 80">
                <Defs>
                  <SvgGradient id="headerBg" x1={0} y1={0} x2={1} y2={1}>
                    <Stop offset={0} stopColor={NAVY_0} />
                    <Stop offset={1} stopColor={NAVY_1} />
                  </SvgGradient>
                </Defs>
                <Rect x={0} y={0} width="100%" height="100%" fill="url(#headerBg)" />
            </Svg>
            <DotPattern />

            {/* Header content */}
            <View className="flex-1 px-5 justify-center">
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mr-3">
                  <MaterialCommunityIcons name="egg" size={26} color="#ffffff" />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-2xl font-black tracking-wider -mb-0.5" style={{ fontFamily: 'serif' }}>
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
          <View className="px-5 pt-5 pb-1.5 flex-row items-center justify-between">
            <Text className="text-[#8e8e93] text-[11px] font-semibold uppercase tracking-widest">Today's Stats</Text>
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
            <View className="relative">
              {data && data.totalHens > 0 && (
                <View className="absolute inset-y-0 right-2 justify-center">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[#8e8e93] text-xs font-bold uppercase tracking-wider">HDEP:</Text>
                    <EggFill
                      width={80}
                      ratio={Math.min(data.eggCount / data.totalHens, 1)}
                      label={`${((data.eggCount / data.totalHens) * 100).toFixed(1)}%`}
                    />
                  </View>
                </View>
              )}
              <View className="px-5 pt-4 pb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <View className="w-7 h-7 rounded-full" style={{ backgroundColor: `${NAVY_0}15` }}>
                      <MaterialCommunityIcons name="egg-outline" size={16} color={NAVY_0} style={{ textAlignVertical: 'center', lineHeight: 28, textAlign: 'center' }} />
                    </View>
                    <Text className="text-[#8e8e93] text-[11px] font-semibold uppercase tracking-wider">Total Eggs</Text>
                  </View>
                </View>
                <Text className="font-bold tracking-tighter ml-5" style={{ fontSize: fs(48), lineHeight: fs(52), color: NAVY_0 }}>
                  {data ? data.eggCount : '--'}
                </Text>
                <Text className="text-[#a39e98] text-sm mt-0.5 ml-5">eggs today</Text>
              </View>
            </View>
          </View>

          {/* ═══ ENVIRONMENT ═══ */}
          <View className="px-5 pt-5 pb-1.5">
            <Text className="text-[#8e8e93] text-[11px] font-semibold uppercase tracking-widest">Environment</Text>
          </View>

          {/* ═══ TEMP & HUMIDITY CARDS ═══ */}
          <View className="px-5 flex-row gap-3">
            {/* Temperature */}
            <View className="flex-1 rounded-2xl overflow-hidden" style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, backgroundColor: '#fff8f0' }}>
              <View className="h-1" style={{ backgroundColor: '#dd5b00' }} />
              <View className="p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5 mb-2">
                      <View className="w-6 h-6 rounded-full bg-[#dd5b00]/10 items-center justify-center">
                        <MaterialCommunityIcons name="thermometer" size={14} color="#dd5b00" />
                      </View>
                      <Text className="text-[#8e8e93] text-[11px] font-semibold uppercase tracking-wider">Temperature</Text>
                    </View>
                    <Text className="font-bold tracking-tighter" style={{ fontSize: fs(28), lineHeight: fs(32), color: '#1a1a1a' }}>
                      {data ? `${data.temperature.toFixed(1)}°` : '--'}
                    </Text>
                    <Text className="text-[#a39e98] text-[11px] mt-0.5">Celsius</Text>
                  </View>
                  <View className="ml-2">
                    <ProgressRing size={44} strokeWidth={4} progress={data ? data.temperature / 50 : 0} color="#dd5b00" bgColor="#f0d6c5" />
                  </View>
                </View>
              </View>
            </View>

            {/* Humidity */}
            <View className="flex-1 rounded-2xl overflow-hidden" style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, backgroundColor: '#f0faf9' }}>
              <View className="h-1" style={{ backgroundColor: '#2a9d99' }} />
              <View className="p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5 mb-2">
                      <View className="w-6 h-6 rounded-full bg-[#2a9d99]/10 items-center justify-center">
                        <MaterialCommunityIcons name="water-percent" size={14} color="#2a9d99" />
                      </View>
                      <Text className="text-[#8e8e93] text-[11px] font-semibold uppercase tracking-wider">Humidity</Text>
                    </View>
                    <Text className="font-bold tracking-tighter" style={{ fontSize: fs(28), lineHeight: fs(32), color: '#1a1a1a' }}>
                      {data ? `${data.humidity}%` : '--'}
                    </Text>
                    <Text className="text-[#a39e98] text-[11px] mt-0.5">Percent</Text>
                  </View>
                  <View className="ml-2">
                    <ProgressRing size={44} strokeWidth={4} progress={data ? data.humidity / 100 : 0} color="#2a9d99" bgColor="#c5e3e1" />
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ═══ CONTROLS ═══ */}
          <View className="mx-5 mt-5 rounded-2xl bg-white p-5 items-center" style={{ elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }}>
            <Pressable
              onPress={handleUpdateNow}
              disabled={updating}
              className={`flex-row items-center justify-center gap-3 rounded-xl h-[52px] px-8 active:opacity-90 ${updating ? 'opacity-50' : ''}`}
              style={{
                backgroundColor: NAVY_1,
                elevation: 4,
                shadowColor: NAVY_1,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.35,
                shadowRadius: 6,
              }}
            >
              <View className="relative w-9 h-9 items-center justify-center">
                <View style={{ position: 'absolute' }}>
                  <ProgressRing size={36} strokeWidth={3} progress={1 - countdownProgress} color="rgba(255,255,255,0.4)" bgColor="rgba(255,255,255,0.12)" />
                </View>
                <MaterialCommunityIcons name="refresh" size={18} color="#ffffff" />
              </View>
              <Text className="text-white text-base font-bold tracking-wide">Update Now</Text>
            </Pressable>
            {countdown > 0 && (
              <Text className="text-[#a39e98] text-sm mt-2.5">
                Next update in {formatCountdown(countdown)}
              </Text>
            )}
          </View>

          <View className="h-24" />
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
            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons name="tune-vertical" size={18} color="#a39e98" />
              <Text className="text-[#1a1a1a] text-lg font-bold tracking-tight">Settings</Text>
            </View>

            <Text className="text-[#a39e98] text-[11px] font-semibold uppercase tracking-widest">Font Size</Text>
            <View className="flex-row flex-wrap gap-2">
              {FONT_SIZES.map((opt) => (
                <Pressable
                  key={opt.label}
                  onPress={() => changeFontScale(opt.value)}
                  className={`px-4 py-2 rounded-[8px] border items-center active:opacity-60 ${fontScale === opt.value ? 'border-[#004e9a] bg-[#e6f0fe]' : 'border-[#e6e6e6] bg-white'}`}
                >
                  <Text className={`text-sm ${fontScale === opt.value ? 'text-[#004e9a] font-semibold' : 'text-[#1a1a1a] font-medium'}`}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
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
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center justify-center gap-2 py-3 rounded-[8px] border border-[#dd5b00] bg-white active:bg-[#fef2ed]"
            >
              <MaterialCommunityIcons name="logout" size={16} color="#dd5b00" />
              <Text className="text-[#dd5b00] text-sm font-semibold">Log Out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
