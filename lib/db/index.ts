import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { portalPool?: Pool }
export const pool = globalForDb.portalPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })
if (process.env.NODE_ENV !== 'production') globalForDb.portalPool = pool
export const db = drizzle(pool, { schema })
