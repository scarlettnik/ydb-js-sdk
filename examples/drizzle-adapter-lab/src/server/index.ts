import express from 'express'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureSchema } from '../db/setup.js'
import { jsonSafe } from './serialize.js'
import { executeAction, loadBootstrap } from './actions.js'
import { getStateSnapshot } from '../db/lab.js'
import { getRecentQueries } from './trace.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.resolve(__dirname, '../../public')

function formatError(error: any) {
	return {
		message: error.message,
		trace: error.trace ?? null,
	}
}

export function createApp() {
	const app = express()

	app.disable('x-powered-by')
	app.use(express.json({ limit: '1mb' }))
	app.use((_, res, next) => {
		res.setHeader('Cache-Control', 'no-store')
		next()
	})

	app.get('/api/bootstrap', async (_, res) => {
		try {
			await ensureSchema()
			res.json(jsonSafe({ ok: true, data: await loadBootstrap() }))
		} catch (error) {
			res.status(500).json(jsonSafe({ ok: false, error: formatError(error) }))
		}
	})

	app.get('/api/state', async (_, res) => {
		try {
			await ensureSchema()
			res.json(jsonSafe({ ok: true, data: await getStateSnapshot() }))
		} catch (error) {
			res.status(500).json(jsonSafe({ ok: false, error: formatError(error) }))
		}
	})

	app.get('/api/recent-queries', (_, res) => {
		res.json(jsonSafe({ ok: true, data: { recentQueries: getRecentQueries() } }))
	})

	app.post('/api/actions/:actionId', async (req, res) => {
		try {
			await ensureSchema()
			const result = await executeAction(req.params.actionId, req.body ?? {})
			res.json(
				jsonSafe({
					ok: true,
					data: result.data,
					action: result.trace,
					recentQueries: getRecentQueries(),
				})
			)
		} catch (error) {
			res.status(400).json(
				jsonSafe({
					ok: false,
					error: formatError(error),
					recentQueries: getRecentQueries(),
				})
			)
		}
	})

	app.use(express.static(publicDir))
	app.get(/.*/, (_, res) => {
		res.sendFile(path.join(publicDir, 'index.html'))
	})

	return app
}

export function startServer() {
	const app = createApp()
	const port = Number(process.env.PORT || 3000)

	app.listen(port, () => {
		console.log(`YDB adapter lab is running on http://localhost:${port}`)
	})
}
