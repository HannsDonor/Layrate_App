import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { login } from '@/utils/auth';
import { LARAVEL_URL } from '@/constants/config';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync('#0A2647');
    NavigationBar.setButtonStyleAsync('light');
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
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
      <View className="h-[280px]">
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
        <View className="absolute inset-0 items-center justify-center pb-10">
          <Text
            className="text-white text-5xl font-extrabold italic tracking-[4px]"
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
        </View>
      </View>

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
            <Text className="text-white text-lg font-bold italic tracking-[2px]" style={{ fontFamily: 'serif' }}>Login</Text>
          )}
        </Pressable>

        <View className="flex-1" />

        {/* Footer */}
        <View className="mb-6">
          <View className="h-[1px] bg-[#e6e6e6] mb-6" />
          <Pressable
            onPress={() => Linking.openURL(`${LARAVEL_URL}/login`)}
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
