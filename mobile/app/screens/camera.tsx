// ============================================================
// app/screens/camera.tsx
// レシート撮影モーダル画面
// - expo-camera でカメラプレビューを表示
// - シャッターボタンで撮影
// - 撮影後 → バックエンドにアップロード → confirm 画面に遷移
// ============================================================

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

import { receiptApi } from '@/lib/api';
import { useAppStore } from '@/store';
import type { OcrResult } from '@/types';

// ============================================================
// カメラ撮影画面コンポーネント
// ============================================================
export default function CameraScreen() {
  const router = useRouter();
  const setOcrResult = useAppStore((s) => s.setOcrResult);

  const [permission, requestPermission] = useCameraPermissions();
  const [isUploading, setIsUploading] = useState(false);
  const [facing] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView>(null);

  // カメラ権限の確認・要求
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // ============================================================
  // シャッター処理
  // 撮影 → アップロード → OCR 結果を受け取り → confirm 画面へ
  // ============================================================
  const handleCapture = async () => {
    if (!cameraRef.current || isUploading) return;

    setIsUploading(true);
    try {
      // 写真撮影
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      if (!photo) {
        throw new Error('撮影に失敗しました');
      }

      // FormData に画像をセット（バックエンドは "image" フィールドを期待）
      const formData = new FormData();
      formData.append('image', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'receipt.jpg',
      } as unknown as Blob);

      // バックエンドにアップロード（OCR 解析）
      // レスポンス: { receipt_id: string, ocr_result: OcrResult }
      const res = await receiptApi.upload(formData);
      const ocrResult: OcrResult = res.data.ocr_result;

      // Zustand に中間状態として保存
      setOcrResult(ocrResult);

      // confirm 画面に遷移
      router.replace('/screens/confirm');
    } catch (error) {
      console.error('[Camera] エラー:', error);
      Alert.alert(
        'エラー',
        'レシートの読み取りに失敗しました。\n明るい場所でもう一度お試しください。',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================================
  // 権限が付与されていない場合の表示
  // ============================================================
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
    <View style={StyleSheet.absoluteFill} className="bg-black">
      {/* カメラプレビュー */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
      >
        {/* オーバーレイ：撮影ガイド枠 */}
        <View className="flex-1 items-center justify-center">
          <View
            style={{
              width: 280,
              height: 180,
              borderWidth: 2,
              borderColor: '#22c55e',
              borderRadius: 12,
            }}
          />
          <Text className="text-white text-sm mt-4 bg-black/40 px-4 py-1 rounded-full">
            レシートを枠内に合わせてください
          </Text>
        </View>

        {/* シャッターボタン */}
        <View className="absolute bottom-12 left-0 right-0 items-center">
          {isUploading ? (
            <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center">
              <ActivityIndicator color="#ffffff" size="large" />
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleCapture}
              className="w-20 h-20 rounded-full bg-white items-center justify-center active:opacity-70"
              style={{
                borderWidth: 4,
                borderColor: '#22c55e',
              }}
            >
              <View className="w-14 h-14 rounded-full bg-primary" />
            </TouchableOpacity>
          )}
          <Text className="text-white text-xs mt-3">
            {isUploading ? 'アップロード中...' : 'タップして撮影'}
          </Text>
        </View>

        {/* 戻るボタン */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute top-4 left-4 bg-black/50 rounded-full w-10 h-10 items-center justify-center"
        >
          <Text className="text-white text-lg">✕</Text>
        </TouchableOpacity>
      </CameraView>
    </View>
  );
}
