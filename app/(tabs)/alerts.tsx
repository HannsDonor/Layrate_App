import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, Text, View, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { fetchWithAuth, getUser, logout } from '@/utils/auth';
import { type AlertData } from '@/utils/notifications';
import { API_BASE_URL, LARAVEL_URL } from '@/constants/config';
import { setAlertCount } from '@/utils/alert-count';
import { stopBackgroundService } from '@/utils/background';
import { useSettings } from '@/app/contexts/SettingsContext';

const NAVY_0 = '#0A2647';
const NAVY_1 = '#0D3B66';

const POLL_PRESETS = [
  { label: '5 sec', value: 5000 },
  { label: '1 min', value: 60000 },
  { label: '5 min', value: 300000 },
  { label: '15 min', value: 900000 },
  { label: '30 min', value: 1800000 },
  { label: '1 hr', value: 3600000 },
  { label: '6 hr', value: 21600000 },
  { label: '24 hr', value: 86400000 },
] as const;

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

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const { pollInterval, changePollInterval: ctxChangePollInterval } = useSettings();
  const [userEmail, setUserEmail] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    getUser().then((u) => {
      if (u?.email) setUserEmail(u.email);
    });
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
    showToast();
  }, [ctxChangePollInterval, showToast]);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/alerts?is_read=0');
      setLoading(false);
      if (!response.ok) {
        console.error(`Alerts API returned ${response.status}: ${API_BASE_URL}/api/alerts`);
        setAlertCount(0);
        return;
      }
      const body = await response.json();
      setLastUpdated(new Date());
      const alertsData = body.alerts ?? body.data ?? [];
      const fetched: AlertData[] = alertsData.map((a: any) => ({
        id: a.id,
        alert_type: a.alert_type,
        message: a.message,
        cage_name: a.cage_code,
        triggered_at: a.triggered_at,
      }));
      setAlerts(fetched);
      setAlertCount(fetched.length);
    } catch (e) {
      console.error(`Alerts fetch failed: ${API_BASE_URL}/api/alerts`, e);
      setAlertCount(0);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/alerts/${id}/read`, { method: 'PUT' });
      if (res.ok) {
        setAlerts((prev) => {
          const next = prev.filter((a) => a.id !== id);
          setAlertCount(next.length);
          return next;
        });
        fetchAlerts();
      }
    } catch {}
  }, [fetchAlerts]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isTemp = (t: string) => t.toLowerCase().includes('temperature');
  const isLive = lastUpdated !== null;

  const handleLogout = async () => {
    await stopBackgroundService();
    await logout();
    router.replace('/(auth)/login');
  };

  const { width: SCREEN_WIDTH } = useWindowDimensions();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <DotPattern color="rgba(80,80,80,0.15)" />
      <SafeAreaView className="flex-1">
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

          <View className="flex-1 px-5 justify-center">
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mr-3">
                <MaterialCommunityIcons name="egg" size={26} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-2xl font-black tracking-wider" style={{ fontFamily: 'serif' }}>
                  Layrate
                </Text>
                {userEmail ? (
                  <Text className="text-white/55 text-xs">{userEmail}</Text>
                ) : (
                  <Text className="text-white/55 text-xs">Alerts</Text>
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

        <View className="px-5 pt-5 pb-1.5 flex-row items-center justify-between">
          <Text className="text-[#8e8e93] text-[12px] font-semibold uppercase tracking-widest">Alerts</Text>
          <View className="flex-row items-center gap-2">
            {lastUpdated && (
              <View className="bg-white rounded-full px-3 py-1 border border-[#e6e6e6]">
                <Text className="text-[#a39e98] text-[11px] font-medium">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            {alerts.length > 0 && (
              <View className="bg-white rounded-full px-3 py-1 border border-[#e6e6e6]">
                <Text className="text-[#a39e98] text-[12px] font-medium">{alerts.length} unread</Text>
              </View>
            )}
          </View>
        </View>

        <View className="flex-1 px-5 pt-0">
          {loading ? (
            <View className="flex-1 justify-center items-center gap-4 pb-24">
              <MaterialCommunityIcons name="bell-outline" size={44} color="#d0d0d8" />
              <Text className="text-[#a39e98] text-base font-semibold">Loading...</Text>
            </View>
          ) : alerts.length === 0 ? (
            <View className="flex-1 justify-center items-center gap-3 pb-24">
              <MaterialCommunityIcons name="bell-outline" size={48} color="#d0d0d8" />
              <Text className="text-[#a39e98] text-base font-semibold">No alerts</Text>
              <Text className="text-[#a39e98] text-sm">All clear — no issues detected</Text>
            </View>
          ) : (
            <FlatList
              data={alerts}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Swipeable
                  renderRightActions={() => (
                    <View style={{ width: SCREEN_WIDTH - 64 }} />
                  )}
                  onSwipeableOpen={(direction) => {
                    if (direction === 'right') markAsRead(item.id);
                  }}
                  overshootRight={false}
                  rightThreshold={100}
                >
                  <View
                    className="flex-row bg-white rounded-2xl overflow-hidden"
                    style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }}
                  >
                    <View className={`w-[4px] ${isTemp(item.alert_type) ? 'bg-[#dd5b00]' : 'bg-[#62aef0]'}`} />
                    <View className="flex-1 p-4 gap-2.5">
                      <View className="flex-row items-start gap-3">
                        <View className={`w-8 h-8 rounded-full items-center justify-center mt-0.5 ${isTemp(item.alert_type) ? 'bg-[#dd5b00]' : 'bg-[#0A2647]'}`}>
                          <MaterialCommunityIcons
                            name={isTemp(item.alert_type) ? 'thermometer-alert' : 'alert-outline'}
                            size={18}
                            color="#ffffff"
                          />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-start justify-between">
                            <Text className="text-[#1a1a1a] text-base font-semibold flex-1 mr-2">
                              {item.alert_type}
                            </Text>
                            <Text className="text-[#a39e98] text-xs mt-0.5 shrink-0">
                              {formatTime(item.triggered_at)}
                            </Text>
                          </View>
                          {item.cage_name && (
                            <Text className="text-[#615d59] text-sm mt-0.5">{item.cage_name}</Text>
                          )}
                        </View>
                      </View>
                      <Text className="text-[#615d59] text-base ml-11">
                        {item.message}
                      </Text>
                    </View>
                  </View>
                </Swipeable>
              )}
            />
          )}
        </View>
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
    </GestureHandlerRootView>
  );
}
