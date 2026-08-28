import crypto from 'node:crypto'
import { connectDatabase, Result } from '../db/index.js'

export function isComputerNumber(value) {
  return typeof value === 'string' && /^\d{10}$/.test(value)
}

export function adminKeyMatches(value) {
  const expected = process.env.PALACE_ADMIN_KEY
  if (!expected || !value || value.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected))
}

function signingSecret() {
  const value = process.env.PALACE_SECRET_KEY
  if (!value && process.env.NODE_ENV === 'production') throw new Error('PALACE_SECRET_KEY is required in production')
  return value || 'local-development-only-secret'
}

export function studentAccessToken(computerNumber) {
  return crypto.createHmac('sha256', signingSecret()).update(computerNumber).digest('hex')
}

export function studentTokenMatches(computerNumber, token) {
  if (!token) return false
  const expected = studentAccessToken(computerNumber)
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export function gradeFor(mark) {
  return mark >= 90 ? 'A+' : mark >= 80 ? 'A' : mark >= 70 ? 'B' : mark >= 60 ? 'C' : 'D'
}

export async function getResults(computerNumber) {
  await connectDatabase()
  return Result.find({ computerNumber }).sort({ createdAt: -1 }).lean()
}

export async function createResult(input) {
  await connectDatabase()
  return Result.create({
    ...input,
    subject: input.subject.trim(),
    term: input.term.trim(),
    grade: gradeFor(input.mark),
  })
}
