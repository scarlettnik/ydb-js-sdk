import { closeDb } from './db/client.js'
import { getStateSnapshot, seedTutorialData } from './db/lab.js'

let exitCode = 0

try {
	await seedTutorialData()
	const snapshot = await getStateSnapshot()
	console.log(
		JSON.stringify(
			{
				connectionString: snapshot.connectionString,
				counts: snapshot.counts,
				users: snapshot.users.slice(0, 3),
				projects: snapshot.projects.slice(0, 3),
				tasks: snapshot.tasks.slice(0, 5),
				migrations: snapshot.migrations.history.slice(0, 3),
			},
			null,
			2
		)
	)
} catch (error) {
	console.error(error)
	exitCode = 1
} finally {
	await closeDb()
	process.exit(exitCode)
}
