import { TransactionRollbackError } from 'drizzle-orm/errors'

export interface AppError extends Error {
	trace?: any
	status?: number
}

export function handleActionError(error: any): never {
	const appError = error as AppError

	if (error instanceof TransactionRollbackError) {
		appError.message = `Транзакция откачена: ${error.message}`
		appError.status = 400
	}

	// Handle YDB specific errors if we can detect them via name or properties
	// Since we are in a demo, we can be quite verbose
	if (error.name?.includes('YdbError') || error.message?.includes('YDB')) {
		appError.message = `Ошибка YDB: ${error.message}`
		appError.status = 500
	}

	throw appError
}
