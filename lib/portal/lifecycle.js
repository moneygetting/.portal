import crypto from 'node:crypto'
import { connectDatabase, Event, Student } from '@/lib/db/index.js'
import { logStep } from '@/lib/palace/core.js'

function secret() {
  const value = process.env.PALACE_SECRET_KEY
  if (!value && process.env.NODE_ENV === 'production') throw new Error('PALACE_SECRET_KEY is required in production')
  return value || 'local-development-only-secret'
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url')
}

export function issueSession(session, ttlSeconds = 60 * 60 * 8) {
  logStep('SESSION', 'Issuing signed session token', 'START', { role: session.role, computerNumber: session.computerNumber })
  const body = Buffer.from(JSON.stringify({ ...session, expiresAt: Date.now() + ttlSeconds * 1000 })).toString('base64url')
  const token = `${body}.${sign(body)}`
  logStep('SESSION', 'Session token issued successfully', 'SUCCESS', { role: session.role, ttlSeconds })
  return token
}

export function readSession(request) {
  const value = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-palace-session')
  if (!value) return null
  const [body, signature] = value.split('.')
  const expected = body ? sign(body) : ''
  if (!body || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    logStep('SESSION', 'Session signature verification failed', 'WARN')
    return null
  }
  try {
    const session = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (session.expiresAt <= Date.now()) {
      logStep('SESSION', 'Session token expired', 'WARN', { role: session.role, computerNumber: session.computerNumber })
      return null
    }
    logStep('SESSION', 'Session token authenticated successfully', 'SUCCESS', { role: session.role, computerNumber: session.computerNumber })
    return session
  } catch (err) {
    logStep('SESSION', `Failed to parse session token: ${err.message}`, 'WARN')
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
  logStep('PORTAL', 'Querying student by computer number', 'START', { computerNumber })
  await connectDatabase()
  const student = await Student.findOne({ computerNumber }).lean()
  if (student) {
    logStep('PORTAL', 'Found student record by computer number', 'SUCCESS', { computerNumber, status: student.status })
  } else {
    logStep('PORTAL', 'No student found for computer number', 'WARN', { computerNumber })
  }
  return student
}

export async function getStudentByNationalId(nationalId) {
  logStep('PORTAL', 'Querying student by national ID', 'START', { nationalId })
  await connectDatabase()
  const student = await Student.findOne({ nationalId }).lean()
  if (student) {
    logStep('PORTAL', 'Found student record by national ID', 'SUCCESS', { computerNumber: student.computerNumber, status: student.status })
  } else {
    logStep('PORTAL', 'No student found for national ID', 'WARN', { nationalId })
  }
  return student
}

export async function signupStudent(input) {
  logStep('PORTAL', 'Registering new student record in database', 'START', { computerNumber: input.computerNumber, studentNumber: input.studentNumber })
  await connectDatabase()
  const student = await Student.create({
    ...input,
    status: 'pending',
    photoFresh: false,
  })
  logStep('PORTAL', 'Student record created in MongoDB', 'SUCCESS', { computerNumber: student.computerNumber })
  
  await Event.create({ computerNumber: input.computerNumber, event: 'SIGN_UP', academicYear: student.academicYear })
  logStep('PORTAL', 'Audit event logged: SIGN_UP', 'SUCCESS', { computerNumber: input.computerNumber, academicYear: student.academicYear })

  return student.toObject()
}

export async function semesterSignIn(computerNumber) {
  logStep('PORTAL', 'Processing semester sign-in', 'START', { computerNumber })
  await connectDatabase()
  const semester = currentSemester()
  const student = await Student.findOne({ computerNumber })
  if (!student) {
    logStep('PORTAL', 'Semester sign-in failed: student record not found', 'WARN', { computerNumber })
    throw Object.assign(new Error('Student not found'), { code: 'NOT_FOUND' })
  }
  if (student.lastSignInSemester === semester && student.semesterSignIns >= 2) {
    logStep('PORTAL', 'Semester sign-in failed: semester sign-in limit (2) reached', 'WARN', { computerNumber, semester })
    throw Object.assign(new Error('Semester sign-in limit reached'), { code: 'CONFLICT' })
  }
  const count = student.lastSignInSemester === semester ? student.semesterSignIns + 1 : 1
  const level = count >= 2 && student.lastSignInSemester === semester ? student.academicLevel + 1 : student.academicLevel
  
  logStep('PORTAL', 'Updating student semester sign-in counters', 'START', { computerNumber, count, level, semester })
  const updated = await Student.findOneAndUpdate(
    { computerNumber, ...(student.lastSignInSemester === semester ? { semesterSignIns: student.semesterSignIns } : {}) },
    { $set: { semesterSignIns: count, lastSignInSemester: semester, lastSignInAt: new Date(), academicLevel: level } },
    { new: true },
  ).lean()
  
  if (!updated) {
    logStep('PORTAL', 'Concurrent sign-in race condition detected', 'WARN', { computerNumber })
    throw Object.assign(new Error('Concurrent sign-in conflict'), { code: 'CONFLICT' })
  }
  
  await Event.create({ computerNumber, event: 'SIGN_IN', semester, academicYear: updated.academicYear })
  logStep('PORTAL', 'Semester sign-in completed and audit event logged', 'SUCCESS', { computerNumber, count, level, semester })
  return updated
}

