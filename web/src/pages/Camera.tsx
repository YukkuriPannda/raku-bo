import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { receiptApi } from '../lib/api'

export default function Camera() {
  const navigate = useNavigate()
  const { setOcrResult } = useAppStore()
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setError(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    setError(null)
    try {
      const { ocr_result } = await receiptApi.upload(selectedFile)
      setOcrResult(ocr_result)
      navigate('/confirm')
    } catch (err) {
      console.error('Upload error:', err)
      setError('アップロードに失敗しました。もう一度お試しください。')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          ←
        </button>
        <h2 className="text-xl font-bold text-white">レシート撮影</h2>
      </div>

      {/* Preview / Drop zone */}
      <div
        className="flex-1 bg-gray-900 rounded-2xl flex flex-col items-center justify-center mb-4 overflow-hidden cursor-pointer min-h-64 border-2 border-dashed border-gray-700 hover:border-green-600 transition-colors"
        onClick={() => galleryRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {preview ? (
          <img
            src={preview}
            alt="レシートプレビュー"
            className="max-h-96 w-full object-contain rounded-xl"
          />
        ) : (
          <div className="text-center text-gray-500 px-4">
            <p className="text-5xl mb-4">🧾</p>
            <p className="text-base font-medium text-gray-400">タップして写真を選択</p>
            <p className="text-sm mt-1">または、ここにドラッグ＆ドロップ</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3 mb-3 text-center">
          {error}
        </div>
      )}

      {/* Select buttons */}
      <div className="flex gap-3 mb-3">
        <button
          onClick={() => galleryRef.current?.click()}
          className="flex-1 bg-gray-800 text-white py-3 rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          🖼️ ギャラリー
        </button>
        <label className="flex-1 bg-gray-800 text-white py-3 rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium cursor-pointer">
          📷 カメラ
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleInputChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Hidden gallery input */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isUploading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            OCR解析中...
          </span>
        ) : (
          '送信してOCR解析'
        )}
      </button>
    </div>
  )
}
