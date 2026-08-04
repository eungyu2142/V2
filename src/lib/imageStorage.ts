import { supabase } from './supabase'

const IMAGE_BUCKET = 'app-images'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const PUBLIC_OBJECT_MARKER = `/storage/v1/object/public/${IMAGE_BUCKET}/`
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])

type ImageArea = 'pets' | 'profiles'

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
  validateImageFile(file)
  const path = `${userId}/${area}/${ownerId}/${crypto.randomUUID()}.${imageExtension(file)}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
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
