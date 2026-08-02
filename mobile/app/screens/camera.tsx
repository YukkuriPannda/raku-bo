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

// OCRは長辺1600pxまで縮めても店名・日付・品目・金額を正しく読める
// （実測: 3072x4080原寸で送信4111K/応答5.6秒 → 長辺1600で送信324K/応答4.3秒）。
// 撮影解像度自体をここで絞ることで、圧縮前のデータ量を減らす。
const TARGET_LONG_EDGE = 1600;

/**
 * getAvailablePictureSizesAsync() が返す "1600x1200" 形式の文字列から、
 * 長辺が TARGET_LONG_EDGE 以上のうち最小のものを選ぶ。無ければ配列中の最大を選ぶ。
 * 想定外の書式（パースできない要素）は無視し、有効な候補が1つも無ければ undefined を返す
 * （呼び出し側は undefined のとき pictureSize を指定せず、従来の既定解像度にフォールバックする）。
 */
function pickPictureSize(sizes: string[]): string | undefined {
  const candidates = sizes
    .map((raw) => {
      const match = raw.match(/^(\d+)x(\d+)$/);
      if (!match) return null;
      const longEdge = Math.max(parseInt(match[1], 10), parseInt(match[2], 10));
      return { raw, longEdge };
    })
    .filter((c): c is { raw: string; longEdge: number } => c !== null);

  if (candidates.length === 0) return undefined;

  const atLeastTarget = candidates.filter((c) => c.longEdge >= TARGET_LONG_EDGE);
  if (atLeastTarget.length > 0) {
    atLeastTarget.sort((a, b) => a.longEdge - b.longEdge);
    return atLeastTarget[0].raw;
  }

  // 1600以上が無い端末では、確保できる最大解像度で妥協する
  candidates.sort((a, b) => b.longEdge - a.longEdge);
  return candidates[0].raw;
}

export default function CameraScreen() {
  const router = useRouter();
  const setPendingImage = useAppStore((s) => s.setPendingImage);

  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [facing] = useState<CameraType>('back');
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // カメラ準備後に一度だけ利用可能な解像度を問い合わせる。
  // 失敗・空配列の場合は pictureSize を指定しないまま（＝従来動作）にして、
  // 撮影自体ができなくなることを避ける。
  const handleCameraReady = async () => {
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
      if (sizes && sizes.length > 0) {
        const picked = pickPictureSize(sizes);
        if (picked) setPictureSize(picked);
      }
    } catch (error) {
      console.warn('[Camera] 解像度一覧の取得に失敗、既定解像度で続行:', describeError(error));
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      // skipProcessing: true にすると quality が一切効かない（処理パイプライン自体を
      // 丸ごとスキップするため）。外すことで quality の圧縮とEXIF向き補正が効くようになる。
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
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
        pictureSize={pictureSize}
        onCameraReady={handleCameraReady}
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
