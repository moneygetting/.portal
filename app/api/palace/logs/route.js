import { NextResponse } from 'next/server'
export async function GET(request) { if (!process.env.PALACE_ADMIN_KEY || request.headers.get('x-palace-admin-key') !== process.env.PALACE_ADMIN_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json({ events: [], note: 'Runtime logs are available in the deployment log stream.' }) }
