import crypto from 'node:crypto'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { logStep } from '@/lib/palace/core.js'

function getApp() {
  if (getApps()[0]) {
    return getApps()[0]
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  const bucket = process.env.FIREBASE_STORAGE_BUCKET
  if (!raw || !bucket) {
    logStep('FIREBASE', 'Firebase Storage credentials missing', 'WARN')
    throw new Error('Firebase storage is not configured')
  }
  logStep('FIREBASE', 'Initializing Firebase Admin App with service account', 'START', { bucket })
  const app = initializeApp({ credential: cert(JSON.parse(raw)), storageBucket: bucket })
  logStep('FIREBASE', 'Firebase Admin App initialized successfully', 'SUCCESS')
  return app
}

export function firebaseConfigured() {
  const configured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY && process.env.FIREBASE_STORAGE_BUCKET)
  logStep('FIREBASE', 'Checking Firebase Storage configuration', configured ? 'SUCCESS' : 'WARN', { configured })
  return configured
}

export async function createPrivateUploadUrl(path, contentType) {
  logStep('STORAGE', 'Generating signed upload URL', 'START', { path, contentType })
  const [url] = await getStorage(getApp()).bucket().file(path).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 10 * 60 * 1000,
    contentType,
  })
  logStep('STORAGE', 'Signed upload URL generated successfully', 'SUCCESS', { path, expiresInMinutes: 10 })
  return url
}

export async function createPrivateReadUrl(path) {
  logStep('STORAGE', 'Generating signed read URL', 'START', { path })
  const [url] = await getStorage(getApp()).bucket().file(path).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  })
  logStep('STORAGE', 'Signed read URL generated successfully', 'SUCCESS', { path, expiresInMinutes: 5 })
  return url
}

export function privateObjectPath(computerNumber, type, extension) {
  return `student-media/${computerNumber}/${type}/${crypto.randomUUID()}.${extension}`
}

export function safeExtension(contentType) {
  return contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp'
}

