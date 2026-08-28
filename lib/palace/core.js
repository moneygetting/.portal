import crypto from 'node:crypto'

export function trace(event, metadata = {}) {
  const redacted = Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    const sensitive = /id|key|token|secret|number/i.test(key)
    return [key, sensitive && typeof value === 'string' ? `${value.slice(0, 2)}***` : value]
  }))
  console.info('[PALACE]', event, { at: new Date().toISOString(), ...redacted })
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
  const signedBase = {
    ...payload,
    expiresAt: payload.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    nonce: payload.nonce || crypto.randomBytes(16).toString('base64url'),
  }
  const signed = { ...signedBase, signature: identitySignature(signedBase) }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', secret(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(signed)), cipher.final()])
  return `${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`
}

export function decryptTicket(ticket) {
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
    return payload
  } catch {
    throw new Error('Invalid or expired ticket')
  }
}

export function storeTicket(ticket) {
  trace('ticket issued', { ticketLength: ticket.length })
}

export function validateProfile(value) {
  if (!value || typeof value !== 'object') return null
  const required = ['studentNumber', 'computerNumber', 'firstName', 'lastName', 'email', 'phone', 'nationalIdNumber']
  if (!required.every((key) => typeof value[key] === 'string' && value[key].trim())) return null
  return Object.fromEntries(required.map((key) => [key, value[key].trim()]))
}

export function corsHeaders(origin) {
  const allowed = (process.env.WIX_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)
  const allowOrigin = origin && (allowed.includes(origin) || process.env.NODE_ENV !== 'production') ? origin : allowed[0] || '*'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Palace-Admin-Key, X-Palace-Session',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    Vary: 'Origin',
  }
}
