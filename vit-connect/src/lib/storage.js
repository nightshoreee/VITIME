import { supabase } from './supabase'
import { validateImage } from './utils'

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// Uploads into "<bucket>/<userId>/<uuid>.<ext>"; storage RLS only allows writing to your own folder.
export async function uploadImage(bucket, userId, file) {
  const err = validateImage(file)
  if (err) throw new Error(err)
  const path = `${userId}/${crypto.randomUUID()}.${EXT[file.type]}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

export const removeImages = (bucket, paths) => {
  const list = (paths || []).filter(Boolean)
  return list.length ? supabase.storage.from(bucket).remove(list) : Promise.resolve()
}

export async function removeAllUserFiles(userId) {
  for (const bucket of ['avatars', 'posts', 'events']) {
    const { data } = await supabase.storage.from(bucket).list(userId, { limit: 1000 })
    if (data?.length) await supabase.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`))
  }
}
