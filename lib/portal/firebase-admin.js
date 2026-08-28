import crypto from 'node:crypto'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'

function getApp() {
  if (getApps()[0]) return getApps()[0]
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  const bucket = process.env.FIREBASE_STORAGE_BUCKET
  if (!raw || !bucket) throw new Error('Firebase storage is not configured')
  return initializeApp({ credential: cert(JSON.parse(raw)), storageBucket: bucket })
}

export function firebaseConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY && process.env.FIREBASE_STORAGE_BUCKET)
}

export async function createPrivateUploadUrl(path, contentType) {
  const [url] = await getStorage(getApp()).bucket().file(path).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 10 * 60 * 1000,
    contentType,
  })
  return url
}

export async function createPrivateReadUrl(path) {
  const [url] = await getStorage(getApp()).bucket().file(path).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  })
  return url
}

export function privateObjectPath(computerNumber, type, extension) {
  return `student-media/${computerNumber}/${type}/${crypto.randomUUID()}.${extension}`
}

export function safeExtension(contentType) {
  return contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp'
}
