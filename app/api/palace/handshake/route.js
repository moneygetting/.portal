import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { validateProfile, logStep, corsHeaders } from '@/lib/palace/core.js'
import { getStudentByNationalId, getStudentByComputerNumber, issueSession, readSession, signupStudent, semesterSignIn, isComputerNumber } from '@/lib/portal/lifecycle.js'

const response = (body, status = 200, origin = '') => NextResponse.json(body, { status, headers: corsHeaders(origin) })
const hashPassword = (password) => crypto.scryptSync(password, process.env.PALACE_SECRET_KEY || 'local-development-only-secret', 32).toString('hex')

export async function POST(request) {
  const origin = request.headers.get('origin') || ''
  try {
    const body = await request.json()
    const action = String(body.action || 'HANDSHAKE').toUpperCase()
    logStep('API:HANDSHAKE', `Received ${action} request from Wix/client`, 'START', { action, origin })

    if (action === 'SIGN_UP') {
      logStep('API:HANDSHAKE', 'Processing SIGN_UP step 1: validating profile & password', 'START')
      const profile = validateProfile(body.profile || body)
      if (!profile || typeof body.password !== 'string' || body.password.length < 8) {
        logStep('API:HANDSHAKE', 'SIGN_UP failed: invalid profile or password shorter than 8 chars', 'WARN')
        return response({ ok: false, code: 'INVALID_PAYLOAD' }, 400, origin)
      }
      logStep('API:HANDSHAKE', 'Processing SIGN_UP step 2: hashing password and persisting student', 'START', { computerNumber: profile.computerNumber })
      const student = await signupStudent({ ...profile, passwordHash: hashPassword(body.password) })
      
      logStep('API:HANDSHAKE', 'Processing SIGN_UP step 3: issuing session token', 'START', { computerNumber: student.computerNumber })
      const sessionToken = issueSession({ role: 'student', computerNumber: student.computerNumber })
      
      logStep('API:HANDSHAKE', 'SIGN_UP completed successfully (201 Created)', 'SUCCESS', { computerNumber: student.computerNumber })
      return response({ ok: true, profile: student, sessionToken }, 201, origin)
    }

    if (action === 'SIGN_IN') {
      logStep('API:HANDSHAKE', 'Processing SIGN_IN step 1: checking computer number format', 'START', { computerNumber: body.computerNumber })
      if (!isComputerNumber(body.computerNumber)) {
        logStep('API:HANDSHAKE', 'SIGN_IN failed: computer number must be 10 digits', 'WARN', { computerNumber: body.computerNumber })
        return response({ ok: false, code: 'INVALID_COMPUTER_NUMBER' }, 400, origin)
      }
      logStep('API:HANDSHAKE', 'Processing SIGN_IN step 2: updating semester sign-in state', 'START', { computerNumber: body.computerNumber })
      const student = await semesterSignIn(body.computerNumber)
      
      logStep('API:HANDSHAKE', 'Processing SIGN_IN step 3: issuing student session token', 'START', { computerNumber: student.computerNumber })
      const sessionToken = issueSession({ role: 'student', computerNumber: student.computerNumber })
      
      logStep('API:HANDSHAKE', 'SIGN_IN completed successfully (200 OK)', 'SUCCESS', { computerNumber: student.computerNumber })
      return response({ ok: true, profile: student, sessionToken }, 200, origin)
    }

    if (action === 'LOGIN') {
      logStep('API:HANDSHAKE', 'Processing LOGIN step 1: authenticating caller session', 'START')
      const session = readSession(request)
      if (!session?.computerNumber) {
        logStep('API:HANDSHAKE', 'LOGIN failed: unauthorized or missing session token', 'WARN')
        return response({ ok: false, code: 'UNAUTHORIZED' }, 401, origin)
      }
      logStep('API:HANDSHAKE', 'Processing LOGIN step 2: fetching student record', 'START', { computerNumber: session.computerNumber })
      const student = await getStudentByComputerNumber(session.computerNumber)
      if (!student) {
        logStep('API:HANDSHAKE', 'LOGIN failed: student record not found', 'WARN', { computerNumber: session.computerNumber })
        return response({ ok: false, code: 'NOT_FOUND' }, 404, origin)
      }
      const sessionToken = issueSession({ role: 'student', computerNumber: student.computerNumber })
      logStep('API:HANDSHAKE', 'LOGIN completed successfully (200 OK)', 'SUCCESS', { computerNumber: student.computerNumber })
      return response({ ok: true, profile: student, sessionToken }, 200, origin)
    }

    logStep('API:HANDSHAKE', 'Processing profile lookup by national ID', 'START')
    const nationalId = String(body.nationalIdNumber || '').trim()
    const student = await getStudentByNationalId(nationalId)
    if (!student) {
      logStep('API:HANDSHAKE', 'Profile lookup: student not found', 'WARN', { nationalId })
      return response({ ok: false, code: 'NOT_FOUND' }, 404, origin)
    }
    logStep('API:HANDSHAKE', 'Profile lookup completed successfully', 'SUCCESS', { computerNumber: student.computerNumber })
    return response({ ok: true, profile: student }, 200, origin)
  } catch (error) {
    logStep('API:HANDSHAKE', `Handshake request error: ${error.message}`, 'FAILED', { code: error.code })
    return response({ ok: false, code: error.code || 'REQUEST_FAILED' }, error.code === 'CONFLICT' ? 409 : error.code === 'NOT_FOUND' ? 404 : 400, origin)
  }
}

export function OPTIONS(request) {
  const origin = request?.headers?.get('origin') || ''
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

