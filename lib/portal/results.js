import crypto from 'node:crypto'
import { connectDatabase, Result } from '@/lib/db/index.js'
import { logStep } from '@/lib/palace/core.js'

export function isComputerNumber(value) {
  return typeof value === 'string' && /^\d{10}$/.test(value)
}

export function adminKeyMatches(value) {
  const expected = process.env.PALACE_ADMIN_KEY
  if (!expected || !value || value.length !== expected.length) {
    return false
  }
  const matched = crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  logStep('AUTH', 'Verifying admin authorization key', matched ? 'SUCCESS' : 'WARN')
  return matched
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
  const matched = token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  logStep('AUTH', 'Verifying student access token', matched ? 'SUCCESS' : 'WARN', { computerNumber })
  return matched
}

export function gradeFor(mark) {
  return mark >= 90 ? 'A+' : mark >= 80 ? 'A' : mark >= 70 ? 'B' : mark >= 60 ? 'C' : 'D'
}

export async function getResults(computerNumber) {
  logStep('RESULTS', 'Fetching academic results from MongoDB', 'START', { computerNumber })
  await connectDatabase()
  const results = await Result.find({ computerNumber }).sort({ createdAt: -1 }).lean()
  logStep('RESULTS', `Retrieved ${results.length} academic result(s)`, 'SUCCESS', { computerNumber, count: results.length })
  return results
}

export async function createResult(input) {
  const calculatedGrade = gradeFor(input.mark)
  logStep('RESULTS', 'Saving academic result record', 'START', { computerNumber: input.computerNumber, subject: input.subject, mark: input.mark, grade: calculatedGrade })
  await connectDatabase()
  const result = await Result.create({
    ...input,
    subject: input.subject.trim(),
    term: input.term.trim(),
    grade: calculatedGrade,
  })
  logStep('RESULTS', 'Academic result saved successfully', 'SUCCESS', { computerNumber: input.computerNumber, resultId: result._id?.toString() })
  return result
}

