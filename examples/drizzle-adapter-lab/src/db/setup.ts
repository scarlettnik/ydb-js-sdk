import { sql } from 'drizzle-orm'
import {
	buildAddChangefeedSql,
	buildAddColumnsSql,
	buildAddIndexSql,
	buildAlterTableResetOptionsSql,
	buildAlterTableSetOptionsSql,
	buildAlterTableSql,
	buildAnalyzeSql,
	buildCreateTableSql,
	buildDropChangefeedSql,
	buildDropColumnsSql,
	buildDropIndexSql,
	buildDropTableSql,
	buildMigrationSql,
	buildRenameTableSql,
	buildShowCreateSql,
	columnFamily,
	index,
	integer,
	migrate,
	partitionByHash,
	rawTableOption,
	tableOptions,
	text,
	timestamp,
	ttl,
	ydbTable,
} from '@ydbjs/drizzle-adapter'
import { closeDb, db } from './client.js'
import { labProjects, labTaskSnapshots, labTasks, labUsers } from './schema.js'

export const LAB_MIGRATIONS_TABLE = '__adapter_lab_migrations'
export const LAB_MIGRATIONS_LOCK_TABLE = '__adapter_lab_migrations_lock'
export const RUNTIME_DDL_TABLE = 'adapter_lab_runtime_demo'
export const RUNTIME_DDL_ARCHIVE_TABLE = 'adapter_lab_runtime_demo_archive'

const migrationLock = {
	table: LAB_MIGRATIONS_LOCK_TABLE,
	key: 'adapter_lab_bootstrap',
	leaseMs: 60_000,
	acquireTimeoutMs: 10_000,
	retryIntervalMs: 300,
}

const labTables: any[] = [labUsers, labProjects, labTasks, labTaskSnapshots]

export const runtimeDdlBaseTable: any = ydbTable(RUNTIME_DDL_TABLE, {
	id: integer('id').primaryKey(),
	title: text('title').notNull(),
	createdAt: timestamp('created_at').notNull(),
} as any)

export const runtimeDdlExpandedTable: any = ydbTable(
	RUNTIME_DDL_TABLE,
	{
		id: integer('id').primaryKey(),
		title: text('title').notNull(),
		stage: text('stage').notNull(),
		createdAt: timestamp('created_at').notNull(),
	} as any,
	(table: any) =>
		[index('adapter_lab_runtime_demo_stage_idx').on(table.stage).build(table)] as any
)

const runtimeShowcaseTable: any = ydbTable(
	'adapter_lab_runtime_feature_showcase',
	{
		id: integer('id').primaryKey(),
		title: text('title').notNull(),
		stage: text('stage').notNull(),
		createdAt: timestamp('created_at').notNull(),
	} as any,
	(table: any) =>
		[
			partitionByHash(table.id),
			ttl(table.createdAt, 'P30D'),
			columnFamily('hot', { data: 'ssd', compression: 'lz4' }).columns(
				table.title,
				table.stage
			),
			tableOptions({
				auto_partitioning_by_size: true,
				auto_partitioning_min_partitions_count: 2,
				key_bloom_filter: rawTableOption('ENABLED'),
			}),
		] as any
)

const runtimeStageIndex = index('adapter_lab_runtime_demo_stage_idx')
	.on(runtimeDdlExpandedTable.stage)
	.build(runtimeDdlExpandedTable as any)

const labBootstrapMigrations = [
	{
		name: '001_create_adapter_lab_tables',
		operations: labTables.map((table) => ({
			kind: 'create_table',
			table,
			ifNotExists: true,
		})) as any[],
	},
]

function getDropStatements() {
	return [
		...labTables
			.slice()
			.reverse()
			.map((table) => buildDropTableSql(table as any, { ifExists: true })),
		buildDropTableSql(LAB_MIGRATIONS_LOCK_TABLE as any, { ifExists: true }),
		buildDropTableSql(LAB_MIGRATIONS_TABLE as any, { ifExists: true }),
	]
}

export function getCreateSchemaStatements() {
	return labTables.map((table) => buildCreateTableSql(table as any, { ifNotExists: true }))
}

export function getMigrationStatements() {
	return buildMigrationSql(labBootstrapMigrations[0]!.operations as any)
}

export function getServiceStatements() {
	return [
		`CREATE TABLE IF NOT EXISTS \`${LAB_MIGRATIONS_LOCK_TABLE}\` (
  \`lock_key\` Utf8 NOT NULL,
  \`owner_id\` Utf8 NOT NULL,
  \`acquired_at\` Int64 NOT NULL,
  \`heartbeat_at\` Int64 NOT NULL,
  \`expires_at\` Int64 NOT NULL,
  PRIMARY KEY (\`lock_key\`)
)`,
	]
}

export function getRuntimeDdlPreviewStatements() {
	return [
		{
			title: 'Migration bootstrap',
			mode: 'preview',
			statements: [...getMigrationStatements(), ...getServiceStatements()],
		},
		{
			title: 'Runtime: создание таблицы',
			mode: 'live',
			statements: [buildCreateTableSql(runtimeDdlBaseTable, { ifNotExists: true })],
		},
		{
			title: 'Runtime: добавление колонки',
			mode: 'preview',
			statements: buildAddColumnsSql(runtimeDdlExpandedTable, [
				runtimeDdlExpandedTable.stage,
			]),
		},
		{
			title: 'Runtime: удаление колонки',
			mode: 'preview',
			statements: buildDropColumnsSql(runtimeDdlExpandedTable, ['stage']),
		},
		{
			title: 'Runtime: индекс add/drop',
			mode: 'preview',
			statements: [
				buildAddIndexSql(runtimeDdlExpandedTable, runtimeStageIndex as any),
				buildDropIndexSql(runtimeDdlExpandedTable, (runtimeStageIndex as any).config.name),
			],
		},
		{
			title: 'Runtime: analyze / show create / rename',
			mode: 'mixed',
			statements: [
				buildAnalyzeSql(runtimeDdlExpandedTable, [
					runtimeDdlExpandedTable.id,
					runtimeDdlExpandedTable.stage,
				]),
				buildShowCreateSql('table', RUNTIME_DDL_TABLE),
				buildRenameTableSql(runtimeDdlExpandedTable, RUNTIME_DDL_ARCHIVE_TABLE),
			],
		},
		{
			title: 'Runtime: table options',
			mode: 'preview',
			statements: [
				buildAlterTableSetOptionsSql(runtimeDdlExpandedTable, {
					auto_partitioning_by_size: true,
					auto_partitioning_min_partitions_count: 2,
				}),
				buildAlterTableResetOptionsSql(runtimeDdlExpandedTable, [
					'auto_partitioning_min_partitions_count',
				]),
			],
		},
		{
			title: 'Runtime: multi-action ALTER TABLE',
			mode: 'preview',
			statements: [
				buildAlterTableSql(runtimeDdlExpandedTable, [
					{
						kind: 'add_index',
						index: runtimeStageIndex,
					} as any,
					{
						kind: 'set_table_options',
						options: {
							auto_partitioning_by_size: true,
							auto_partitioning_min_partitions_count: 2,
						},
					} as any,
				]),
			],
		},
		{
			title: 'Runtime: changefeed',
			mode: 'preview',
			statements: [
				buildAddChangefeedSql(runtimeDdlExpandedTable, 'runtime_updates', {
					mode: 'UPDATES',
					format: 'JSON',
				}),
				buildDropChangefeedSql(runtimeDdlExpandedTable, 'runtime_updates'),
			],
		},
		{
			title: 'Feature showcase: CREATE TABLE',
			mode: 'preview',
			statements: [buildCreateTableSql(runtimeShowcaseTable, { ifNotExists: true })],
		},
	]
}

export function getAdvancedDdlStatements() {
	const statements: string[] = []

	for (const group of getRuntimeDdlPreviewStatements()) {
		statements.push(`-- ${group.title} [${group.mode}]`, ...group.statements)
	}

	return statements
}

export function getRuntimeDdlLifecycleStatements() {
	return [
		buildDropTableSql(RUNTIME_DDL_ARCHIVE_TABLE as any, { ifExists: true }),
		buildDropTableSql(RUNTIME_DDL_TABLE as any, { ifExists: true }),
		buildCreateTableSql(runtimeDdlBaseTable, { ifNotExists: true }),
		buildRenameTableSql(runtimeDdlBaseTable, RUNTIME_DDL_ARCHIVE_TABLE),
		buildDropTableSql(RUNTIME_DDL_ARCHIVE_TABLE as any, { ifExists: true }),
	]
}

export function getRecreateSchemaStatements() {
	return [...getDropStatements(), ...getMigrationStatements()]
}

export function executeDdlStatementsInOrder(
	statements: string[],
	onApplied?: (statement: string) => void
) {
	return statements.reduce<Promise<void>>(
		(previous, statement) =>
			previous.then(() =>
				Promise.resolve(db.execute(sql.raw(statement))).then(() => {
					onApplied?.(statement)
				})
			),
		Promise.resolve()
	)
}

let schemaSetupPromise: Promise<void> | undefined

export async function setupSchema() {
	await (db as any).$client.ready?.()
	await migrate(db, {
		migrationsTable: LAB_MIGRATIONS_TABLE,
		migrationsLockTable: LAB_MIGRATIONS_LOCK_TABLE,
		migrationLock,
		migrations: labBootstrapMigrations as any,
	})
}

export async function ensureSchema() {
	if (!schemaSetupPromise) {
		schemaSetupPromise = setupSchema().catch((error) => {
			schemaSetupPromise = undefined
			throw error
		})
	}

	await schemaSetupPromise
}

export async function recreateSchema() {
	await db.$client.ready?.()
	await executeDdlStatementsInOrder(getDropStatements())

	schemaSetupPromise = undefined
	await ensureSchema()
}

if (import.meta.url === `file://${process.argv[1]}`) {
	let exitCode = 0

	try {
		await setupSchema()
		console.log('Adapter lab schema is reachable.')
	} catch (error) {
		console.error(error)
		exitCode = 1
	} finally {
		await closeDb()
		process.exit(exitCode)
	}
}
