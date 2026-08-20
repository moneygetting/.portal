import 'server-only'
import crypto from 'node:crypto'
import mongoose, { Schema } from 'mongoose'

export type StudentProfile = { studentNumber: string; computerNumber: string; firstName: string; lastName: string; email: string; phone: string; nationalIdNumber: string }
export type PalacePayload = StudentProfile & { productNumber: string; timestamp: string; expiresAt?: string; nonce?: string; signature?: string }

const safe = (value: unknown) => typeof value === 'string' ? value.replace(/\d(?=\d{3})/g, '*').slice(0, 80) : typeof value
export const trace = (event: string, meta: Record<string, unknown> = {}) => console.info(`[PALACE] ${event}`, { at: new Date().toISOString(), ...Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, k.toLowerCase().includes('id') || k.toLowerCase().includes('key') ? safe(v) : v])) })

function secret() {
  const value = process.env.PALACE_SECRET_KEY
  if (!value && process.env.NODE_ENV === 'production') throw new Error('PALACE_SECRET_KEY is required in production')
  return crypto.createHash('sha256').update(value || 'local-development-only-secret').digest()
}
const identitySignature = (payload: PalacePayload) => crypto.createHmac('sha256', secret()).update([payload.studentNumber, payload.computerNumber, payload.nationalIdNumber, payload.productNumber, payload.timestamp, payload.expiresAt || '', payload.nonce || ''].join('|')).digest('hex')
export function encryptTicket(payload: PalacePayload) {
  try { const signedBase = { ...payload, expiresAt: payload.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(), nonce: payload.nonce || crypto.randomBytes(16).toString('base64url') }; const signed = { ...signedBase, signature: identitySignature(signedBase) }; const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', secret(), iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(signed)), cipher.final()]); trace('ticket encrypted'); return `${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}` } catch (error) { console.error('[PALACE] encryption failure', error); throw error }
}
export function decryptTicket(ticket: string) {
  try { const [ivText, tagText, encryptedText] = ticket.split(':'); if (!ivText || !tagText || !encryptedText) throw new Error('Invalid ticket format'); const decipher = crypto.createDecipheriv('aes-256-gcm', secret(), Buffer.from(ivText, 'base64url')); decipher.setAuthTag(Buffer.from(tagText, 'base64url')); const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString()) as PalacePayload; if (!payload.expiresAt || Number.isNaN(Date.parse(payload.expiresAt)) || Date.parse(payload.expiresAt) <= Date.now()) throw new Error('Expired ticket'); if (!payload.signature || payload.signature.length !== identitySignature(payload).length || !crypto.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(identitySignature(payload)))) throw new Error('Invalid identity signature'); return payload } catch (error) { console.error('[PALACE] decryption failure', error); throw new Error('Invalid or expired ticket') }
}

const ticketSchema = new Schema({ encryptedKey: { type: String, required: true, unique: true }, createdAt: { type: Date, default: Date.now, expires: '365d' } }, { collection: 'palacetickets' })
const studentSchema = new Schema({}, { strict: false, collection: 'students' })
const PalaceTicket = mongoose.models.PalaceTicket || mongoose.model('PalaceTicket', ticketSchema)
const Student = mongoose.models.Student || mongoose.model('Student', studentSchema)
let connection: Promise<typeof mongoose> | undefined
async function db() { if (!process.env.MONGO_URI) return null; connection ||= mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3500 }); await connection; return mongoose.connection }

export const mockStudents: StudentProfile[] = [{ studentNumber: '202434357', computerNumber: 'COMP9876', firstName: 'Nandi', lastName: 'Dlamini', email: 'nandi@example.edu', phone: '+26876000000', nationalIdNumber: '4406056400016' }]
export async function findStudent(nationalIdNumber: string) { const database = await db(); if (database) { const doc = await Student.findOne({ nationalIdNumber }).lean(); if (doc) return { ...doc, nationalIdNumber } as StudentProfile }; return process.env.NODE_ENV !== 'production' ? mockStudents.find((student) => student.nationalIdNumber === nationalIdNumber) || null : null }
export async function storeTicket(encryptedKey: string) { await db(); if (process.env.MONGO_URI) await PalaceTicket.create({ encryptedKey }); trace('ticket stored'); }
export function validateProfile(value: unknown): StudentProfile | null { if (!value || typeof value !== 'object') return null; const item = value as Record<string, unknown>; const fields = ['studentNumber','computerNumber','firstName','lastName','email','phone','nationalIdNumber']; if (!fields.every((key) => typeof item[key] === 'string' && item[key])) return null; return Object.fromEntries(fields.map((key) => [key, String(item[key])])) as StudentProfile }
export function corsHeaders(origin?: string) { const allowed = (process.env.WIX_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean); const allow = origin && (allowed.includes(origin) || process.env.NODE_ENV !== 'production') ? origin : allowed[0] || '*'; return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'Content-Type, X-Palace-Admin-Key', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', Vary: 'Origin' } }
export { PalaceTicket }
