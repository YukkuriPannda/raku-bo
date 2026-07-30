import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';

import { useAppStore } from '@/store';
import { describeError } from '@/lib/auth-errors';

export default function CameraScreen() {
  const router = useRouter();
  const setPendingImage = useAppStore((s) => s.setPendingImage);

  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [facing] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        skipProcessing: true,
      });

      if (!photo?.base64) throw new Error('撮影に失敗しました');

      // 撮影完了 → 即座に遷移（アップロードは manual-entry 画面で行う）
      setPendingImage(photo.base64);
      router.replace('/screens/manual-entry');
    } catch (error) {
      console.error('[Camera] エラー:', describeError(error));
      Alert.alert('エラー', '撮影に失敗しました。もう一度お試しください。', [{ text: 'OK' }]);
      setIsCapturing(false);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Text className="text-white text-center text-base mb-6">
          カメラへのアクセス許可が必要です
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-primary rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">許可する</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
      />

      {/* シャッターボタン */}
      <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' }}>
        {isCapturing ? (
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleCapture}
            activeOpacity={0.7}
            style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#1B7F4F' }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#1B7F4F' }} />
          </TouchableOpacity>
        )}
        <Text style={{ color: '#fff', fontSize: 12, marginTop: 12 }}>
          {isCapturing ? '撮影中...' : 'タップして撮影'}
        </Text>
      </View>

      {/* 戻るボタン */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: 'absolute', top: 16, left: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}
