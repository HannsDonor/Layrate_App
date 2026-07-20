import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type BatchData = {
  batchId: string;
  harvestedDate: string;
  cageCode: string;
  eggSize: string;
  count: number;
};

type Freshness = { label: string; bg: string; fg: string };

function computeFreshness(harvested: string): Freshness {
  const harvestedMs = new Date(harvested).getTime();
  const nowMs = Date.now();
  const diffDays = Math.max(0, Math.floor((nowMs - harvestedMs) / 86400000));
  if (diffDays <= 7) return { label: 'Fresh', bg: '#e6f9ed', fg: '#1a8a3f' };
  if (diffDays <= 14) return { label: 'Aging', bg: '#fef3d6', fg: '#b8860b' };
  return { label: 'Old', bg: '#fde8e8', fg: '#c62828' };
}

function parseQR(data: string): BatchData | null {
  const parts = data.split('|');
  if (parts.length !== 6 || parts[0] !== 'LAYRATE') return null;
  const count = parseInt(parts[5], 10);
  if (isNaN(count)) return null;
  return { batchId: parts[1], harvestedDate: parts[2], cageCode: parts[3], eggSize: parts[4], count };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center py-2.5">
      <Text className="text-muted-ink text-sm">{label}</Text>
      <Text className="text-ink text-sm font-semibold">{value}</Text>
    </View>
  );
}

export default function QRScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [screen, setScreen] = useState<'scan' | 'result' | 'error'>('scan');
  const [batch, setBatch] = useState<BatchData | null>(null);

  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    const parsed = parseQR(data);
    if (parsed) {
      setBatch(parsed);
      setScreen('result');
    } else {
      setScreen('error');
    }
  }, []);

  const resetScan = useCallback(() => {
    setBatch(null);
    setScreen('scan');
  }, []);

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-ink text-base">Loading camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-white rounded-card p-8 items-center gap-4 border border-hairline w-full max-w-sm">
            <MaterialCommunityIcons name="camera-off-outline" size={48} color="#a39e98" />
            <Text className="text-ink text-lg font-bold text-center">Camera Access Needed</Text>
            <Text className="text-muted-ink text-sm text-center leading-5">
              Allow camera access to scan QR codes
            </Text>
            <Pressable
              onPress={requestPermission}
              className="bg-primary px-6 py-3 rounded-button mt-2"
            >
              <Text className="text-white text-sm font-semibold">Grant Permission</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'result' && batch) {
    const freshness = computeFreshness(batch.harvestedDate);
    const trays = Math.ceil(batch.count / 30);
    const sizeLabel = batch.eggSize.charAt(0).toUpperCase() + batch.eggSize.slice(1);

    return (
      <SafeAreaView className="flex-1 bg-paper">
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
          <View className="bg-white rounded-card overflow-hidden border border-hairline">
            <View className="bg-paper px-5 py-4 border-b border-hairline">
              <View className="flex-row items-center gap-2.5">
                <MaterialCommunityIcons name="egg-outline" size={24} color="#004e9a" />
                <View>
                  <Text className="text-ink text-base font-bold tracking-tight">
                    LayRate Poultry Farm
                  </Text>
                  <Text className="text-muted-ink text-xs">Egg Stock Batch</Text>
                </View>
              </View>
            </View>

            <View className="px-5 pt-5 pb-3">
              <Text className="text-muted-ink text-xs font-semibold uppercase tracking-wider">Batch</Text>
              <Text className="text-ink text-3xl font-extrabold tracking-tight mt-1">
                #{batch.batchId}
              </Text>
            </View>

            <View className="h-px bg-hairline mx-5" />

            <View className="px-5 py-3">
              <DetailRow label="Size" value={sizeLabel} />
              <DetailRow label="Count" value={`${batch.count.toLocaleString()} eggs`} />
              <DetailRow label="Trays" value={`${trays} (30 eggs/tray)`} />
              <DetailRow label="Harvested" value={formatDate(batch.harvestedDate)} />
              <DetailRow label="Source Cage" value={batch.cageCode} />
              <View className="flex-row justify-between items-center py-2.5">
                <Text className="text-muted-ink text-sm">Freshness</Text>
                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: freshness.bg }}>
                  <Text className="text-xs font-bold" style={{ color: freshness.fg }}>
                    {freshness.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View className="items-center gap-4">
            <Pressable
              onPress={resetScan}
              className="flex-row items-center gap-2 px-5 py-2.5 rounded-button bg-white border border-hairline active:bg-paper"
            >
              <MaterialCommunityIcons name="qrcode-scan" size={18} color="#004e9a" />
              <Text className="text-primary text-sm font-medium">Scan Another Code</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 items-center justify-center gap-5 px-8">
          <View className="bg-white rounded-card p-8 items-center gap-4 border border-error-bg w-full max-w-sm">
            <MaterialCommunityIcons name="alert-circle-outline" size={52} color="#c62828" />
            <Text className="text-error text-lg font-bold">Invalid QR Code</Text>
            <Text className="text-muted-ink text-sm text-center leading-5">
              The scanned code doesn't match the expected format.
            </Text>
            <Pressable
              onPress={resetScan}
              className="flex-row items-center gap-2 bg-error px-6 py-3 rounded-button mt-2"
            >
              <MaterialCommunityIcons name="camera" size={18} color="#ffffff" />
              <Text className="text-white text-sm font-semibold">Scan Again</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarCodeScanned}
        >
          <View className="flex-1 justify-center items-center gap-6 px-5">
            <View className="absolute top-6 left-5 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
                <MaterialCommunityIcons name="qrcode-scan" size={22} color="#ffffff" />
              </View>
              <Text className="text-white text-lg font-bold tracking-tight" style={{ textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                Scan QR Code
              </Text>
            </View>

            <View className="w-64 h-64 rounded-card items-center justify-center border-2 border-white/50 bg-black/10">
              <View className="absolute -inset-[2px] rounded-[14px] border-2 border-primary" />
              <MaterialCommunityIcons name="qrcode-scan" size={56} color="rgba(255,255,255,0.25)" />
            </View>

            <Text className="text-white/70 text-sm text-center">Point the camera at a crate QR code</Text>

            <Pressable
              onPress={() => setTorch((t) => !t)}
              className="absolute bottom-10 w-12 h-12 rounded-full bg-white/20 items-center justify-center active:bg-white/35"
            >
              <MaterialCommunityIcons
                name={torch ? 'flashlight' : 'flashlight-off'}
                size={22}
                color={torch ? '#004e9a' : '#ffffff'}
              />
            </Pressable>
          </View>
        </CameraView>

      </View>
    </SafeAreaView>
  );
}
