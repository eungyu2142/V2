import { supabase } from './supabase'

const IMAGE_BUCKET = 'app-images'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const MAX_IMAGE_EDGE = 4096
const PUBLIC_OBJECT_MARKER = `/storage/v1/object/public/${IMAGE_BUCKET}/`
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])

type ImageArea = 'pets' | 'profiles' | 'reviews'

function imageExtension(file: File) {
  const mimeExtension = file.type.split('/')[1]?.toLowerCase().replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '')
  if (mimeExtension) return mimeExtension
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromName) return fromName
  return 'jpg'
}

export function validateImageFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new Error('JPG, PNG, WebP, GIF 또는 HEIC 사진만 선택할 수 있습니다.')
  }
  if (file.size > MAX_IMAGE_SIZE) throw new Error('사진은 10MB 이하만 업로드할 수 있습니다.')
}

function safeImageName(name: string, extension: string) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 48) || 'image'
  return `${base}.${extension}`
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('사진을 안전한 형식으로 변환하지 못했습니다.')), type, quality)
  })
}

/** Decodes pixels and writes a new file so EXIF, GPS and untrusted metadata are discarded. */
export async function sanitizeImageFile(file: File) {
  validateImageFile(file)

  let bitmap: ImageBitmap | undefined
  let image: HTMLImageElement | undefined
  let objectUrl = ''
  try {
    if ('createImageBitmap' in window) {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } else {
      objectUrl = URL.createObjectURL(file)
      image = new Image()
      image.decoding = 'async'
      image.src = objectUrl
      await image.decode()
    }

    const sourceWidth = bitmap?.width ?? image?.naturalWidth ?? 0
    const sourceHeight = bitmap?.height ?? image?.naturalHeight ?? 0
    if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > MAX_IMAGE_PIXELS) {
      throw new Error('사진 해상도가 너무 크거나 올바른 이미지가 아닙니다.')
    }

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight))
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: file.type === 'image/png' })
    if (!context) throw new Error('사진을 안전하게 처리할 수 없는 브라우저입니다.')

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    if (outputType === 'image/jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
    }
    context.drawImage(bitmap ?? image as CanvasImageSource, 0, 0, width, height)
    const blob = await canvasBlob(canvas, outputType, outputType === 'image/jpeg' ? 0.9 : undefined)
    const extension = outputType === 'image/png' ? 'png' : 'jpg'
    return new File([blob], safeImageName(file.name, extension), { type: outputType, lastModified: Date.now() })
  } catch (error) {
    if (error instanceof Error && error.message.includes('해상도')) throw error
    throw new Error('손상되었거나 지원되지 않는 사진입니다. JPG, PNG 또는 WebP로 다시 선택해 주세요.', { cause: error })
  } finally {
    bitmap?.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

export async function uploadImageFile({
  file,
  userId,
  area,
  ownerId,
}: {
  file: File
  userId: string
  area: ImageArea
  ownerId: string
}) {
  const sanitizedFile = await sanitizeImageFile(file)
  const path = `${userId}/${area}/${ownerId}/${crypto.randomUUID()}.${imageExtension(sanitizedFile)}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, sanitizedFile, {
    cacheControl: '3600',
    contentType: sanitizedFile.type,
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

export async function removeUploadedImage(imageUrl?: string | null) {
  if (!imageUrl || !imageUrl.includes(PUBLIC_OBJECT_MARKER)) return
  const encodedPath = imageUrl.split(PUBLIC_OBJECT_MARKER)[1]?.split('?')[0]
  if (!encodedPath) return
  const path = decodeURIComponent(encodedPath)
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([path])
  if (error) throw error
}

export async function dataUrlToImageFile(dataUrl: string, name: string) {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}
