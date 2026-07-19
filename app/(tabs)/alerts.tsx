import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, PanResponder, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type AlertData } from '@/utils/notifications';
import { LARAVEL_URL, DEVICE_KEY } from '@/constants/config';
import { setAlertCount } from '@/utils/alert-count';

const NAVY_0 = '#0A2647';
const NAVY_1 = '#0D3B66';

function SwipeableRow({ children, onSwipe }: { children: React.ReactNode; onSwipe: () => void }) {
  const cb = useRef(onSwipe);
  cb.current = onSwipe;
  const pan = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) pan.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -100) {
          Animated.timing(pan, { toValue: -500, duration: 250, useNativeDriver: true }).start(() => cb.current());
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View>
      <View className="absolute right-0 top-0 bottom-0 w-24 rounded-2xl items-center justify-center gap-1" style={{ backgroundColor: '#16a34a' }}>
        <MaterialCommunityIcons name="check-bold" size={20} color="#ffffff" />
        <Text className="text-white text-xs font-semibold">Read</Text>
      </View>
      <Animated.View style={{ transform: [{ translateX: pan }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch(`${LARAVEL_URL}/api/alerts`, {
        headers: { 'X-Device-Key': DEVICE_KEY },
      });
      if (!response.ok) return;
      const body = await response.json();
      const fetched: AlertData[] = (body.data ?? []).map((a: any) => ({
        id: a.id,
        alert_type: a.alert_type,
        message: a.message,
        cage_name: a.cage_code,
        triggered_at: a.triggered_at,
      }));
      setAlerts(fetched);
      setAlertCount(fetched.length);
      setLoading(false);
    } catch {
      setAlertCount(0);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${LARAVEL_URL}/api/alerts/${id}/read`, {
        method: 'PUT',
        headers: { 'X-Device-Key': DEVICE_KEY },
      });
      if (res.ok) {
        setAlerts((prev) => {
          const next = prev.filter((a) => a.id !== id);
          setAlertCount(next.length);
          return next;
        });
      }
    } catch {}
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isTemp = (t: string) => t.toLowerCase().includes('temperature');

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <SafeAreaView className="flex-1">
        {/* Header */}
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
          <View className="flex-1 px-5 justify-center">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
                  <MaterialCommunityIcons name="bell-outline" size={20} color="#ffffff" />
                </View>
                <Text className="text-white text-xl font-extrabold italic" style={{ fontFamily: 'serif' }}>Alerts</Text>
              </View>
              <View className="px-3.5 py-1.5 rounded-full bg-white/15 border border-white/10">
                <Text className="text-white text-sm font-bold">{alerts.length}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-1 px-5 pt-4">
          {loading ? (
            <View className="flex-1 justify-center items-center gap-4 pb-24">
              <MaterialCommunityIcons name="bell-outline" size={44} color="#d0d0d8" />
              <Text className="text-[#a39e98] text-base font-semibold">Loading...</Text>
            </View>
          ) : alerts.length === 0 ? (
            <View className="flex-1 justify-center items-center gap-3 pb-24">
              <MaterialCommunityIcons name="check-circle-outline" size={48} color="#16a34a" />
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
                <SwipeableRow onSwipe={() => markAsRead(item.id)}>
                  <View className="flex-row bg-white rounded-2xl overflow-hidden" style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }}>
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
                      <Text className="text-[#615d59] text-sm leading-5 ml-11">
                        {item.message}
                      </Text>
                    </View>
                  </View>
                </SwipeableRow>
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
