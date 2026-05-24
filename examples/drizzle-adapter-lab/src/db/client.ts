import { createDrizzle } from '@ydbjs/drizzle-adapter'
import { traceLogger } from '../server/trace.js'
import { schema } from './schema.js'

export const connectionString = process.env.YDB_CONNECTION_STRING ?? 'grpc://127.0.0.1:2136/local'

export const db = createDrizzle({
	connectionString,
	schema,
	logger: traceLogger,
})

export async function closeDb() {
	await db.$client.close?.()
}
