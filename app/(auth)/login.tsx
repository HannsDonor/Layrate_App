import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { login } from '@/utils/auth';
import { setApiBaseUrl, getLaravelUrl } from '@/constants/config';
import { discoverServer, getSavedServerUrl, saveServerUrl } from '@/utils/serviceDiscovery';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

function DotPattern({ color }: { color?: string }) {
  const dots: { cx: number; cy: number }[] = [];
  for (let row = 0; row < 30; row++) {
    for (let col = 0; col < 12; col++) {
      dots.push({ cx: 30 + col * 30 + (row % 2) * 15, cy: 40 + row * 30 });
    }
  }
  const fill = color ?? 'rgba(200,200,210,0.18)';
  return (
    <Svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.cx} cy={d.cy} r={1.2} fill={fill} />
      ))}
    </Svg>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [debugStatus, setDebugStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [debugResult, setDebugResult] = useState('');

  const handleTestServer = async () => {
    const url = serverUrl || 'http://192.168.254.107:5000';
    setDebugStatus('testing');
    setDebugResult('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/api/ping`, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (res.ok && data.ok) {
        setDebugStatus('ok');
        setDebugResult(`OK (${res.status})`);
      } else {
        setDebugStatus('fail');
        setDebugResult(`Response ${res.status}`);
      }
    } catch (e: any) {
      setDebugStatus('fail');
      setDebugResult(e.message || 'Network error');
    }
  };

  const doodles = useMemo(() => {
    const result: { icon: string; x: number; y: number; size: number; rotation: number; opacity: number }[] = [];
    for (let i = 0; i < 40; i++) {
      result.push({
        icon: 'egg',
        x: Math.random() * 90 + 5,
        y: Math.random() * 80 + 10,
        size: Math.random() * 18 + 16,
        rotation: Math.random() * 60 - 30,
        opacity: Math.random() * 0.09 + 0.05,
      });
    }
    return result;
  }, []);

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync('#0A2647');
    NavigationBar.setButtonStyleAsync('light');
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await getSavedServerUrl();
      if (saved) {
        setServerUrl(saved);
        setApiBaseUrl(saved);
        return;
      }
      const found = await discoverServer();
      if (found) {
        setServerUrl(found);
        setApiBaseUrl(found);
        saveServerUrl(found);
      } else {
        const fallback = 'http://192.168.254.107:5000';
        setServerUrl(fallback);
        setApiBaseUrl(fallback);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    if (serverUrl) {
      await saveServerUrl(serverUrl);
      setApiBaseUrl(serverUrl);
    }
    setLoading(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="light" />
      {/* Gradient wave header */}
      <View className="h-[280px]" style={{ zIndex: 1 }}>
        <Svg width="100%" height="100%" viewBox="0 0 375 280" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <SvgGradient id="headerGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#001c3d" stopOpacity="1" />
              <Stop offset="1" stopColor="#003366" stopOpacity="1" />
            </SvgGradient>
          </Defs>
          <Path
            d="M0,0 L0,230 C60,280 127,180 187,230 C247,280 314,180 375,230 L375,0 Z"
            fill="url(#headerGrad)"
          />
        </Svg>
        {/* Doodle icons */}
        <View className="absolute inset-0" pointerEvents="none">
          {doodles.map((d, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: `${d.x}%`,
                top: `${d.y}%`,
                transform: [{ rotate: `${d.rotation}deg` }],
                opacity: d.opacity,
              }}
            >
              <MaterialCommunityIcons name={d.icon as any} size={d.size} color="#ffffff" />
            </View>
          ))}
        </View>

        <Pressable
          onLongPress={() => { if (__DEV__) setShowDebugMenu((v) => !v); }}
          delayLongPress={800}
          className="absolute inset-0 items-center justify-center pb-10 active:opacity-80"
        >
          <Text
            className="text-white text-5xl font-black tracking-[6px]"
            style={{ fontFamily: 'serif', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 }}
          >
            LAYRATE
          </Text>
          <Text
            className="text-white/70 text-base font-light tracking-[2px] mt-1"
            style={{ fontFamily: 'serif', textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}
          >
            Live Monitoring App
          </Text>
        </Pressable>
      </View>

      <DotPattern color="rgba(200,200,210,0.18)" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        className="flex-1 mt-6"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1 }}
      >
        {/* Welcome text */}
        <View className="mb-8">
          <Text className="text-[28px] text-ink">
            <Text className="font-bold">Welcome</Text>
            <Text className="font-normal"> back!</Text>
          </Text>
        </View>

        {/* Input fields */}
        <View className="gap-4 mb-8">
          <TextInput
            className="bg-[#F0F0F5] rounded-full px-6 py-[18px] text-base text-ink"
            placeholder="Email"
            placeholderTextColor="#a39e98"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
          <View className="relative">
            <TextInput
              className="bg-[#F0F0F5] rounded-full px-6 py-[18px] text-base text-ink pr-14"
              placeholder="Password"
              placeholderTextColor="#a39e98"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              className="absolute right-5 top-0 bottom-0 justify-center"
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off' : 'eye'}
                size={22}
                color="#a39e98"
              />
            </Pressable>
          </View>
        </View>

        {error && (
          <Text className="text-accent text-sm text-center mb-4">{error}</Text>
        )}

        {/* Hidden debug menu (long-press LAYRATE logo in __DEV__) */}
        {showDebugMenu && (
          <View className="mb-4">
            <TextInput
              className="bg-[#F0F0F5] rounded-full px-6 py-[14px] text-sm text-ink mb-2"
              placeholder="Server URL"
              placeholderTextColor="#a39e98"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={serverUrl}
              onChangeText={setServerUrl}
              editable={!loading}
            />
            <View className="flex-row items-center justify-center gap-3">
              <Pressable onPress={handleTestServer} disabled={debugStatus === 'testing'}>
                <Text className="text-primary text-xs font-semibold underline">
                  {debugStatus === 'testing' ? 'Testing...' : 'Test'}
                </Text>
              </Pressable>
              {debugStatus !== 'idle' && (
                <Text className={`text-xs ${debugStatus === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
                  {debugResult}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Login button */}
        <Pressable
          onPress={handleLogin}
          disabled={loading}
          className={`rounded-full h-[56px] items-center justify-center active:opacity-90 ${loading ? 'opacity-50' : ''}`}
          style={{ backgroundColor: '#004e9a', elevation: 6, shadowColor: '#001c3d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-lg font-bold tracking-[2px]" style={{ fontFamily: 'serif' }}>Login</Text>
          )}
        </Pressable>

        <View className="flex-1" />

        {/* Footer */}
        <View className="mb-6">
          <View className="h-[1px] bg-[#e6e6e6] mb-6" />
          <Pressable
            onPress={() => {
              const url = `${getLaravelUrl()}/login`;
              Linking.openURL(url).catch((e) => console.error('Linking failed:', url, e));
            }}
            className="items-center"
          >
            <Text className="text-[#8e8e93] text-base">
              Access via{' '}
              <Text className="text-primary font-semibold underline">Web Browser</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
