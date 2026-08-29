import React from 'react'

export default function BackendStatusPage() {
  const backendInfo = {
    service: 'palace-portal-backend',
    status: 'online',
    version: '1.0.0',
    wixStudioIntegration: {
      enabled: true,
      cors: 'configured',
      endpoints: {
        handshake: 'POST /api/palace/handshake',
        studentPortal: 'GET, POST /api/palace/student-portal',
        checkoutSecure: 'POST /api/palace/checkout-secure',
        mediaUploadUrl: 'POST /api/palace/media/upload-url',
        mediaUpdate: 'PUT /api/palace/media',
        mediaReview: 'GET /api/palace/media/review',
        decryptAuditor: 'POST /api/palace/decrypt-auditor',
        systemLogs: 'GET /api/palace/logs',
      },
    },
    deployment: {
      target: 'Render / Vercel / Cloud Run',
      port: 3000,
      timestamp: new Date().toISOString(),
    },
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', background: '#0a0a0a', color: '#e5e5e5', minHeight: '100vh' }}>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {JSON.stringify(backendInfo, null, 2)}
      </pre>
    </main>
  )
}
