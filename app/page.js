import React from 'react'

export default function HealthPage() {
  return React.createElement(
    'pre',
    null,
    JSON.stringify({ service: 'portal-backend', status: 'ok' }, null, 2),
  )
}
