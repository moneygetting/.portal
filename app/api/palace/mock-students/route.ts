import { NextResponse } from 'next/server'
import { mockStudents } from '@/lib/palace/core'
export async function GET() { if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Unavailable' }, { status: 404 }); return NextResponse.json({ students: mockStudents }) }
