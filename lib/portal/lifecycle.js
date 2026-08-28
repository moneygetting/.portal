import crypto from 'node:crypto'
import { connectDatabase, Event, Student } from '../db/index.js'

function secret() {
  const value = process.env.PALACE_SECRET_KEY
  if (!value && process.env.NODE_ENV === 'production') throw new Error('PALACE_SECRET_KEY is required in production')
  return value || 'local-development-only-secret'
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url')
}

export function issueSession(session, ttlSeconds = 60 * 60 * 8) {
  const body = Buffer.from(JSON.stringify({ ...session, expiresAt: Date.now() + ttlSeconds * 1000 })).toString('base64url')
  return `${body}.${sign(body)}`
}

export function readSession(request) {
  const value = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-palace-session')
  if (!value) return null
  const [body, signature] = value.split('.')
  const expected = body ? sign(body) : ''
  if (!body || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const session = JSON.parse(Buffer.from(body, 'base64url').toString())
    return session.expiresAt > Date.now() ? session : null
  } catch {
    return null
  }
}

export function isComputerNumber(value) {
  return typeof value === 'string' && /^\d{10}$/.test(value)
}

export function currentSemester() {
  return new Date().getUTCMonth() < 6 ? 1 : 2
}

export async function getStudentByComputerNumber(computerNumber) {
  await connectDatabase()
  return Student.findOne({ computerNumber }).lean()
}

export async function getStudentByNationalId(nationalId) {
  await connectDatabase()
  return Student.findOne({ nationalId }).lean()
}

export async function signupStudent(input) {
  await connectDatabase()
  const student = await Student.create({
    ...input,
    status: 'pending',
    photoFresh: false,
  })
  await Event.create({ computerNumber: input.computerNumber, event: 'SIGN_UP', academicYear: student.academicYear })
  return student.toObject()
}

export async function semesterSignIn(computerNumber) {
  await connectDatabase()
  const semester = currentSemester()
  const student = await Student.findOne({ computerNumber })
  if (!student) throw Object.assign(new Error('Student not found'), { code: 'NOT_FOUND' })
  if (student.lastSignInSemester === semester && student.semesterSignIns >= 2) throw Object.assign(new Error('Semester sign-in limit reached'), { code: 'CONFLICT' })
  const count = student.lastSignInSemester === semester ? student.semesterSignIns + 1 : 1
  const level = count >= 2 && student.lastSignInSemester === semester ? student.academicLevel + 1 : student.academicLevel
  const updated = await Student.findOneAndUpdate(
    { computerNumber, ...(student.lastSignInSemester === semester ? { semesterSignIns: student.semesterSignIns } : {}) },
    { $set: { semesterSignIns: count, lastSignInSemester: semester, lastSignInAt: new Date(), academicLevel: level } },
    { new: true },
  ).lean()
  if (!updated) throw Object.assign(new Error('Concurrent sign-in conflict'), { code: 'CONFLICT' })
  await Event.create({ computerNumber, event: 'SIGN_IN', semester, academicYear: updated.academicYear })
  return updated
}
