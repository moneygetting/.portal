import crypto from 'node:crypto'

const logBuffer = []
const MAX_LOG_BUFFER = 200

export function getRecentLogs() {
  return [...logBuffer]
}

export function logStep(category, stepName, status = 'SUCCESS', metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    category: category.toUpperCase(),
    step: stepName,
    status: status.toUpperCase(),
    ...metadata,
  }

  // Sanitize any sensitive keys in metadata
  const sanitized = Object.fromEntries(Object.entries(entry).map(([key, value]) => {
    const sensitive = /id|key|token|secret|password|hash|signature/i.test(key)
    if (sensitive && typeof value === 'string' && value.length > 6) {
      return [key, `${value.slice(0, 3)}...${value.slice(-3)}`]
    }
    return [key, value]
  }))

  const icon = status === 'SUCCESS' ? '✓' : status === 'START' ? '▶' : status === 'WARN' ? '⚠' : '✗'
  console.info(`[PORTAL][${sanitized.category}] ${icon} Step: ${sanitized.step} | Status: ${sanitized.status}`, sanitized)

  logBuffer.push(sanitized)
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift()
  }
}

export function trace(event, metadata = {}) {
  const redacted = Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    const sensitive = /id|key|token|secret|number/i.test(key)
    return [key, sensitive && typeof value === 'string' ? `${value.slice(0, 2)}***` : value]
  }))
  logStep('TRACE', event, 'SUCCESS', redacted)
}

function secret() {
  const value = process.env.PALACE_SECRET_KEY
  if (!value && process.env.NODE_ENV === 'production') throw new Error('PALACE_SECRET_KEY is required in production')
  return crypto.createHash('sha256').update(value || 'local-development-only-secret').digest()
}

function identitySignature(payload) {
  return crypto.createHmac('sha256', secret()).update([
    payload.studentNumber,
    payload.computerNumber,
    payload.nationalIdNumber,
    payload.productNumber,
    payload.timestamp,
    payload.expiresAt || '',
    payload.nonce || '',
  ].join('|')).digest('hex')
}

export function encryptTicket(payload) {
  logStep('CRYPTO', 'Generating ticket HMAC signature and AES-256-GCM cipher', 'START', { computerNumber: payload.computerNumber })
  const signedBase = {
    ...payload,
    expiresAt: payload.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    nonce: payload.nonce || crypto.randomBytes(16).toString('base64url'),
  }
  const signed = { ...signedBase, signature: identitySignature(signedBase) }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', secret(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(signed)), cipher.final()])
  const ticket = `${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`
  logStep('CRYPTO', 'Ticket encrypted successfully', 'SUCCESS', { ticketLength: ticket.length, expiresAt: signed.expiresAt })
  return ticket
}

export function decryptTicket(ticket) {
  logStep('CRYPTO', 'Decrypting and validating ticket payload', 'START')
  try {
    const [ivText, tagText, encryptedText] = ticket.split(':')
    if (!ivText || !tagText || !encryptedText) throw new Error('Invalid ticket format')
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret(), Buffer.from(ivText, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
    const payload = JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final(),
    ]).toString())
    const expected = identitySignature(payload)
    if (!payload.expiresAt || Date.parse(payload.expiresAt) <= Date.now()) throw new Error('Expired ticket')
    if (!payload.signature || payload.signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expected))) throw new Error('Invalid signature')
    logStep('CRYPTO', 'Ticket decrypted and signature verified successfully', 'SUCCESS', { computerNumber: payload.computerNumber, productNumber: payload.productNumber })
    return payload
  } catch (err) {
    logStep('CRYPTO', `Ticket decryption failed: ${err.message}`, 'FAILED')
    throw new Error('Invalid or expired ticket')
  }
}

export function storeTicket(ticket) {
  trace('ticket issued', { ticketLength: ticket.length })
}

export function validateProfile(value) {
  logStep('AUTH', 'Validating student profile schema', 'START')
  if (!value || typeof value !== 'object') {
    logStep('AUTH', 'Profile validation failed: payload is not an object', 'WARN')
    return null
  }
  const required = ['studentNumber', 'computerNumber', 'firstName', 'lastName', 'email', 'phone', 'nationalIdNumber']
  const missing = required.filter((key) => !(typeof value[key] === 'string' && value[key].trim()))
  if (missing.length > 0) {
    logStep('AUTH', `Profile validation failed: missing fields [${missing.join(', ')}]`, 'WARN')
    return null
  }
  const profile = Object.fromEntries(required.map((key) => [key, value[key].trim()]))
  logStep('AUTH', 'Student profile validated successfully', 'SUCCESS', { studentNumber: profile.studentNumber, computerNumber: profile.computerNumber })
  return profile
}

export function corsHeaders(origin = '') {
  const allowed = (process.env.WIX_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)
  
  let allowOrigin = '*'
  if (allowed.length > 0) {
    if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
      allowOrigin = origin
    } else {
      allowOrigin = allowed[0]
    }
  } else if (origin) {
    allowOrigin = origin
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Palace-Admin-Key, X-Palace-Session, X-Student-Token, x-palace-admin-key, x-palace-session, x-student-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

