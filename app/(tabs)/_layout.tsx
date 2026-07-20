import { useEffect, useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { getToken } from '@/utils/auth';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getAlertCount } from '@/utils/alert-count';
import { SettingsProvider } from '@/app/contexts/SettingsContext';

function AlertsIcon({ color }: { color: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(getAlertCount());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View>
      <MaterialCommunityIcons name="bell-outline" size={28} color={color} />
      {count > 0 && (
        <View className="absolute -top-2 right-[-6px] min-w-[22px] h-[22px] rounded-full items-center justify-center px-[5px]"
              style={{ backgroundColor: '#dd5b00', elevation: 4, shadowColor: '#dd5b00', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3 }}>
          <Text className="text-white text-[11px] font-bold">
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
}

function QRTabButton({ onPress, accessibilityState }: { onPress?: (...args: any[]) => void; accessibilityState?: { selected?: boolean } }) {
  const focused = accessibilityState?.selected;

  return (
    <View className="top-[-22px] z-10 items-center justify-center">
      <Pressable
        onPress={onPress}
        className={`w-[64px] h-[64px] rounded-full items-center justify-center active:opacity-80 ${focused ? 'bg-[#0D3B66]' : 'bg-[#0A2647]'}`}
        style={{ elevation: 6, shadowColor: '#0A2647', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 }}
      >
        <MaterialCommunityIcons name="qrcode-scan" size={33} color="#ffffff" />
      </Pressable>
    </View>
  );
}

export default function TabsGroupLayout() {
  const router = useRouter();

  useEffect(() => {
    getToken().then((token) => {
      if (!token) {
        router.replace('/(auth)');
      }
    });
  }, []);

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync('#ffffff');
    NavigationBar.setButtonStyleAsync('dark');
  }, []);

  return (
    <SettingsProvider>
      <StatusBar style="dark" />
      <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#0A2647',
      tabBarInactiveTintColor: '#a39e98',
      tabBarItemStyle: { flex: 1 },
      tabBarLabelStyle: { fontSize: 14, fontWeight: '600', paddingTop: 3 },
      tabBarStyle: {
        backgroundColor: '#ffffff',
        borderTopWidth: 0,
        height: 104,
        paddingBottom: 24,
        marginHorizontal: 0,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Monitor',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="monitor-dashboard" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="qr"
        options={{
          title: '',
          tabBarButton: (props) => <QRTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: (props) => <AlertsIcon {...props} />,
        }}
      />
    </Tabs>
    </SettingsProvider>
  );
}
