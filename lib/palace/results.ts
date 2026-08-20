import 'server-only'
import crypto from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { portalResults } from '@/lib/db/schema'

export function isComputerNumber(value: unknown): value is string { return typeof value === 'string' && /^\d{10}$/.test(value) }
export function adminKeyMatches(value: string | null) { const expected = process.env.PALACE_ADMIN_KEY; if (!expected || !value || value.length !== expected.length) return false; return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected)) }
function signingSecret() { const value = process.env.PALACE_SECRET_KEY; if (!value && process.env.NODE_ENV === 'production') throw new Error('PALACE_SECRET_KEY is required in production'); return value || 'local-development-only-secret' }
export function studentAccessToken(computerNumber: string) { return crypto.createHmac('sha256', signingSecret()).update(computerNumber).digest('hex') }
export function studentTokenMatches(computerNumber: string, token: string | null) { if (!token) return false; const expected = studentAccessToken(computerNumber); return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected)) }
export function gradeFor(mark: number) { return mark >= 90 ? 'A+' : mark >= 80 ? 'A' : mark >= 70 ? 'B' : mark >= 60 ? 'C' : 'D' }
export async function getResults(computerNumber: string) { return db.select().from(portalResults).where(eq(portalResults.computerNumber, computerNumber)).orderBy(desc(portalResults.createdAt)) }
export async function createResult(input: { computerNumber: string; subject: string; mark: number; term: string; fileName?: string; fileSize?: number; uploadedBy: string }) { const now = new Date(); const row = { id: crypto.randomUUID(), computerNumber: input.computerNumber, subject: input.subject.trim(), mark: input.mark, grade: gradeFor(input.mark), term: input.term.trim(), fileName: input.fileName?.slice(0, 255), fileSize: input.fileSize, uploadedBy: input.uploadedBy, createdAt: now, updatedAt: now }; return db.insert(portalResults).values(row).returning() }
