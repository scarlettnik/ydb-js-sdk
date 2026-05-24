export function jsonSafe(value: any): any {
	if (typeof value === 'bigint') {
		return value.toString()
	}

	if (value instanceof Date) {
		return value.toISOString()
	}

	if (Array.isArray(value)) {
		return value.map((item) => jsonSafe(item))
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, jsonSafe(entry)])
		)
	}

	return value
}
