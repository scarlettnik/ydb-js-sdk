import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

const traceStorage = new AsyncLocalStorage<any>()
const recentQueries: any[] = []
const MAX_RECENT_QUERIES = 120

function trimRecentQueries() {
	while (recentQueries.length > MAX_RECENT_QUERIES) {
		recentQueries.shift()
	}
}

function normalizeValue(value: any): any {
	if (typeof value === 'bigint') {
		return value.toString()
	}

	if (value instanceof Date) {
		return value.toISOString()
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeValue(item))
	}

	if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry)])
		)
	}

	return value
}

function normalizeParams(params: any[]) {
	return params.map((value) => normalizeValue(value))
}

export const traceLogger = {
	logQuery(query: string, params: any[]) {
		const scope = traceStorage.getStore()
		const entry = {
			id: randomUUID(),
			at: new Date().toISOString(),
			sql: query,
			params: normalizeParams(params),
			actionId: scope?.id ?? null,
			actionTitle: scope?.title ?? null,
		}

		recentQueries.push(entry)
		trimRecentQueries()

		if (scope) {
			scope.queries.push(entry)
		}

		if (process.env.YDB_LOG_SQL === '1') {
			console.log(`[trace:${scope?.title ?? 'global'}]`, query, params)
		}
	},
}

export function getRecentQueries(limit = 18) {
	return recentQueries.slice(-limit).reverse()
}

function buildTraceSummary(scope: any, error: any) {
	return {
		id: scope.id,
		title: scope.title,
		description: scope.description,
		category: scope.category,
		mode: scope.mode ?? 'live',
		adapterMethods: scope.adapterMethods,
		docUrl: scope.docUrl ?? null,
		sampleCode: scope.sampleCode ?? null,
		startedAt: scope.startedAt,
		durationMs: Date.now() - scope.startedAtMs,
		error: error ? { message: error.message } : null,
		queries: scope.queries,
	}
}

export async function runWithTrace(metadata: any, callback: () => Promise<any>) {
	const scope = {
		id: randomUUID(),
		title: metadata.title,
		description: metadata.description,
		category: metadata.category ?? null,
		mode: metadata.mode ?? 'live',
		adapterMethods: metadata.adapterMethods,
		docUrl: metadata.docUrl ?? null,
		sampleCode: metadata.sampleCode ?? null,
		startedAt: new Date().toISOString(),
		startedAtMs: Date.now(),
		queries: [],
	}

	return traceStorage.run(scope, async () => {
		try {
			const data = await callback()
			return { data, trace: buildTraceSummary(scope, null) }
		} catch (error: any) {
			error.trace = buildTraceSummary(scope, error)
			throw error
		}
	})
}
