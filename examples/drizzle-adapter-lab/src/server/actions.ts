import {
	batchDeleteTasks,
	batchUpdateTasks,
	deleteProject,
	deleteTask,
	deleteUser,
	ensureDemoData,
	getPreparedProject,
	getPreparedTask,
	getPreparedUser,
	getStateSnapshot,
	insertProject,
	insertTask,
	insertTaskWithConflictUpdate,
	insertUser,
	insertUserWithConflictUpdate,
	recreateLabSchema,
	replaceProject,
	replaceTask,
	replaceUser,
	runAdvancedJoinModes,
	runAdvancedScriptPreview,
	runCountOverview,
	runCteProjectLoad,
	runDistinctOverview,
	runFindFirstProjectOverview,
	runFromValuesBuilder,
	runGroupCompactOverview,
	runGroupingPreview,
	runInsertSnapshotsFromSelect,
	runJoinBuildersPreview,
	runJoinOverview,
	runKnnPreview,
	runPreparedReadsOverview,
	runRawAllTasks,
	runRawGetProject,
	runRawValuesUsers,
	runRelationsOverview,
	runRenderingOverview,
	runRuntimeDdlLifecycle,
	runRuntimeDdlPreview,
	runSelectClausesOverview,
	runSelectSyntaxPreview,
	runSetOperatorsOverview,
	runSourceHelpersPreview,
	runTimeWindowPreview,
	runTransactionCommit,
	runTransactionRollback,
	runUnionAllOverview,
	runValuesTableOverview,
	runWindowOverview,
	runYdbSpecificSelectPreview,
	runYqlScriptAction,
	seedTutorialData,
	updateProject,
	updateTask,
	updateUser,
	upsertProject,
	upsertTask,
	upsertUser,
} from '../db/lab.js'
import { runWithTrace } from './trace.js'

type ActionMode = 'live' | 'preview'

interface ActionCatalogEntry {
	id: string
	category: string
	mode: ActionMode
	title: string
	description: string
	adapterMethods: string[]
	docUrl: string
	sampleCode: string
}

interface MethodItemOptions {
	availability?: string
	payload?: Record<string, unknown>
}

interface MethodItem {
	id: string
	name: string
	actionId: string
	description: string
	docUrl: string | null
	mode: ActionMode
	availability: string
	payload: Record<string, unknown>
}

interface MethodSection {
	id: string
	title: string
	eyebrow: string
	docUrl: string | null
	items: MethodItem[]
}

type ActionHandler = (payload: Record<string, unknown>) => Promise<unknown>

const docs = {
	overview: 'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/',
	schemaOverview: 'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/schema',
	schemaConstraints:
		'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/schema#secondary-indexes',
	schemaOptions:
		'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/schema#table-options',
	methods: 'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/database-api',
	relations:
		'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/database-api#relational-query-api',
	mutations:
		'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/query-builders#mutations',
	select: 'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/query-builders#select-builder',
	joins: 'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/query-builders#joins',
	cte: 'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/query-builders#cte-with',
	sources:
		'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/yql-helpers#select-sources',
	analytical:
		'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/yql-helpers#analytical-functions-olap',
	scripts:
		'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/yql-helpers#yql-scripts',
	examples: 'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/examples',
	migrate:
		'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/migrations-ddl#migrator-migrate',
	tableDdl:
		'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/migrations-ddl#ddl-builders',
}
export const actionCatalog: ActionCatalogEntry[] = [
	{
		id: 'recreateLabSchema',
		category: 'schema',
		mode: 'live',
		title: 'Пересоздать lab-схему',
		description: 'Удаляет lab-таблицы и поднимает их заново через migrate().',
		adapterMethods: ['migrate', 'buildDropTableSql'],
		docUrl: docs.migrate,
		sampleCode: `await migrate(db, {\n  migrationsTable: "__adapter_lab_migrations",\n  migrations: [{ name: "001", operations: [{ kind: "create_table", table: labUsers }] }],\n});`,
	},
	{
		id: 'seedTutorial',
		category: 'schema',
		mode: 'live',
		title: 'Засеять tutorial-данные',
		description:
			'Пересоздает схему и загружает стабильный multi-table dataset в одной транзакции.',
		adapterMethods: ['db.transaction', 'db.insert'],
		docUrl: docs.relations,
		sampleCode: `await db.transaction(async (tx) => {\n  await tx.insert(labUsers).values(users).execute();\n  await tx.insert(labProjects).values(projects).execute();\n  await tx.insert(labTasks).values(tasks).execute();\n});`,
	},
	{
		id: 'runRuntimeDdlLifecycle',
		category: 'schema',
		mode: 'live',
		title: 'Живой DDL lifecycle',
		description:
			'В отдельной runtime-таблице выполняет CREATE -> RENAME -> DROP, не трогая основные сущности приложения.',
		adapterMethods: [
			'buildCreateTableSql',
			'buildRenameTableSql',
			'buildDropTableSql',
			'db.execute',
		],
		docUrl: docs.tableDdl,
		sampleCode: `await db.execute(sql.raw(buildCreateTableSql(runtimeTable)));\nawait db.execute(sql.raw(buildRenameTableSql(runtimeTable, "archive")));`,
	},
	{
		id: 'runRuntimeDdlPreview',
		category: 'schema',
		mode: 'preview',
		title: 'Preview расширенного DDL toolkit',
		description:
			'Показывает multi-action ALTER TABLE, ADD/DROP COLUMN, INDEX, ANALYZE, SHOW CREATE, table options и changefeed builders.',
		adapterMethods: [
			'buildAddColumnsSql',
			'buildDropColumnsSql',
			'buildAddIndexSql',
			'buildDropIndexSql',
			'buildAnalyzeSql',
			'buildShowCreateSql',
			'buildAlterTableSetOptionsSql',
			'buildAlterTableResetOptionsSql',
			'buildAlterTableSql',
			'buildAddChangefeedSql',
			'buildDropChangefeedSql',
		],
		docUrl: docs.tableDdl,
		sampleCode: `buildAddColumnsSql(runtimeTable, [runtimeTable.stage]);\nbuildAlterTableSetOptionsSql(runtimeTable, { auto_partitioning_by_size: true });\nbuildAddChangefeedSql(runtimeTable, "updates", { mode: "updates", format: "json" });`,
	},
	{
		id: 'runCountOverview',
		category: 'explore',
		mode: 'live',
		title: 'Обзор через $count()',
		description: 'Считает строки по users, projects, tasks и task_copies.',
		adapterMethods: ['$count'],
		docUrl: docs.methods,
		sampleCode: `const todoTasks = await db.$count(labTasks, eq(labTasks.status, "todo"));`,
	},
	{
		id: 'insertUser',
		category: 'users',
		mode: 'live',
		title: 'Добавить пользователя',
		description: 'Создает пользователя через insert().returning().',
		adapterMethods: ['db.insert', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.insert(labUsers).values(record).returning(userSelection).execute();`,
	},
	{
		id: 'insertUserWithConflictUpdate',
		category: 'users',
		mode: 'live',
		title: 'Добавить с onDuplicateKeyUpdate',
		description: 'Показывает conflict-aware запись пользователя.',
		adapterMethods: ['db.insert', 'onDuplicateKeyUpdate', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.insert(labUsers).values(record).onDuplicateKeyUpdate({ set: { email: record.email } }).execute();`,
	},
	{
		id: 'upsertUser',
		category: 'users',
		mode: 'live',
		title: 'Upsert пользователя',
		description: 'Показывает upsert() для одной строки пользователя.',
		adapterMethods: ['db.upsert', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.upsert(labUsers).values(record).returning(userSelection).execute();`,
	},
	{
		id: 'replaceUser',
		category: 'users',
		mode: 'live',
		title: 'Replace пользователя',
		description: 'Полностью перезаписывает строку через replace().',
		adapterMethods: ['db.replace'],
		docUrl: docs.mutations,
		sampleCode: `await db.replace(labUsers).values(record).execute();`,
	},
	{
		id: 'updateUser',
		category: 'users',
		mode: 'live',
		title: 'Обновить пользователя',
		description: 'Обновляет поля пользователя через update().returning().',
		adapterMethods: ['db.update', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.update(labUsers).set(patch).where(eq(labUsers.id, id)).returning(userSelection).execute();`,
	},
	{
		id: 'getPreparedUser',
		category: 'users',
		mode: 'live',
		title: 'Prepared get пользователя',
		description: 'Читает пользователя через prepare().get().',
		adapterMethods: ['select', 'prepare', 'get'],
		docUrl: docs.cte,
		sampleCode: `await db.select(userSelection).from(labUsers).where(eq(labUsers.id, id)).prepare().get();`,
	},
	{
		id: 'deleteUser',
		category: 'users',
		mode: 'live',
		title: 'Удалить пользователя',
		description: 'Удаляет пользователя, если на него больше не ссылаются проекты и задачи.',
		adapterMethods: ['db.delete', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.delete(labUsers).where(eq(labUsers.id, id)).returning(userSelection).execute();`,
	},
	{
		id: 'insertProject',
		category: 'projects',
		mode: 'live',
		title: 'Добавить проект',
		description: 'Создает проект и связывает его с owner user.',
		adapterMethods: ['db.insert', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.insert(labProjects).values(record).returning(projectSelection).execute();`,
	},
	{
		id: 'upsertProject',
		category: 'projects',
		mode: 'live',
		title: 'Upsert проекта',
		description: 'Upsert проекта с owner-binding и slug.',
		adapterMethods: ['db.upsert', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.upsert(labProjects).values(record).returning(projectSelection).execute();`,
	},
	{
		id: 'replaceProject',
		category: 'projects',
		mode: 'live',
		title: 'Replace проекта',
		description: 'Полная замена строки проекта и повторная загрузка.',
		adapterMethods: ['db.replace', 'db.select'],
		docUrl: docs.mutations,
		sampleCode: `await db.replace(labProjects).values(record).execute();`,
	},
	{
		id: 'updateProject',
		category: 'projects',
		mode: 'live',
		title: 'Обновить проект',
		description: 'Обновляет поля проекта через update().returning().',
		adapterMethods: ['db.update', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.update(labProjects).set(patch).where(eq(labProjects.id, id)).returning(projectSelection).execute();`,
	},
	{
		id: 'getPreparedProject',
		category: 'projects',
		mode: 'live',
		title: 'Prepared get проекта',
		description: 'Использует prepare().get() для проекта.',
		adapterMethods: ['select', 'prepare', 'get'],
		docUrl: docs.cte,
		sampleCode: `await db.select(projectSelection).from(labProjects).where(eq(labProjects.id, id)).prepare().get();`,
	},
	{
		id: 'deleteProject',
		category: 'projects',
		mode: 'live',
		title: 'Удалить проект',
		description: 'Удаляет проект в transaction() и вручную чистит tasks + copies.',
		adapterMethods: ['db.transaction', 'db.delete'],
		docUrl: docs.relations,
		sampleCode: `await db.transaction(async (tx) => {\n  await tx.delete(labTaskSnapshots).where(eq(labTaskSnapshots.projectId, id)).execute();\n  await tx.delete(labTasks).where(eq(labTasks.projectId, id)).execute();\n  await tx.delete(labProjects).where(eq(labProjects.id, id)).execute();\n});`,
	},
	{
		id: 'insertTask',
		category: 'tasks',
		mode: 'live',
		title: 'Добавить задачу',
		description: 'Создает задачу, связанную с project и assignee.',
		adapterMethods: ['db.insert', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.insert(labTasks).values(record).returning(taskSelection).execute();`,
	},
	{
		id: 'insertTaskWithConflictUpdate',
		category: 'tasks',
		mode: 'live',
		title: 'Добавить задачу с onDuplicateKeyUpdate',
		description: 'Conflict-aware запись задачи через onDuplicateKeyUpdate().',
		adapterMethods: ['db.insert', 'onDuplicateKeyUpdate', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.insert(labTasks).values(record).onDuplicateKeyUpdate({ set: { status: record.status } }).execute();`,
	},
	{
		id: 'upsertTask',
		category: 'tasks',
		mode: 'live',
		title: 'Upsert задачи',
		description: 'Upsert атрибутов задачи и ее связей.',
		adapterMethods: ['db.upsert', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.upsert(labTasks).values(record).returning(taskSelection).execute();`,
	},
	{
		id: 'replaceTask',
		category: 'tasks',
		mode: 'live',
		title: 'Replace задачи',
		description: 'Полная замена строки задачи.',
		adapterMethods: ['db.replace'],
		docUrl: docs.mutations,
		sampleCode: `await db.replace(labTasks).values(record).execute();`,
	},
	{
		id: 'updateTask',
		category: 'tasks',
		mode: 'live',
		title: 'Обновить задачу',
		description: 'Обновляет статус, assignee или estimateHours задачи.',
		adapterMethods: ['db.update', 'returning'],
		docUrl: docs.mutations,
		sampleCode: `await db.update(labTasks).set(patch).where(eq(labTasks.id, id)).returning(taskSelection).execute();`,
	},
	{
		id: 'getPreparedTask',
		category: 'tasks',
		mode: 'live',
		title: 'Prepared get задачи',
		description: 'Подготовленный single-row read по задачам.',
		adapterMethods: ['select', 'prepare', 'get'],
		docUrl: docs.cte,
		sampleCode: `await db.select(taskSelection).from(labTasks).where(eq(labTasks.id, id)).prepare().get();`,
	},
	{
		id: 'deleteTask',
		category: 'tasks',
		mode: 'live',
		title: 'Удалить задачу',
		description: 'Удаляет задачу и ее copy-строки в одной транзакции.',
		adapterMethods: ['db.transaction', 'db.delete'],
		docUrl: docs.relations,
		sampleCode: `await db.transaction(async (tx) => {\n  await tx.delete(labTaskSnapshots).where(eq(labTaskSnapshots.id, id)).execute();\n  await tx.delete(labTasks).where(eq(labTasks.id, id)).execute();\n});`,
	},
	{
		id: 'batchUpdateTasks',
		category: 'tasks',
		mode: 'live',
		title: 'batchUpdate задач',
		description: 'Массово обновляет статусы задач через batchUpdate().',
		adapterMethods: ['db.batchUpdate'],
		docUrl: docs.mutations,
		sampleCode: `await db.batchUpdate(labTasks).set({ status: toStatus }).where(eq(labTasks.status, fromStatus)).execute();`,
	},
	{
		id: 'batchDeleteTasks',
		category: 'tasks',
		mode: 'live',
		title: 'batchDelete задач',
		description: 'Массово удаляет задачи по статусу через batchDelete().',
		adapterMethods: ['db.batchDelete'],
		docUrl: docs.mutations,
		sampleCode: `await db.batchDelete(labTasks).where(eq(labTasks.status, status)).execute();`,
	},
	{
		id: 'runRelationsOverview',
		category: 'explore',
		mode: 'live',
		title: 'Обзор relations',
		description: 'Показывает db.query.* c nested with: owner -> tasks -> assignee.',
		adapterMethods: ['db.query.*', 'findMany', 'columns', 'orderBy', 'with'],
		docUrl: docs.relations,
		sampleCode: `await db.query.labProjects.findMany({ with: { owner: true, tasks: { with: { assignee: true } } } });`,
	},
	{
		id: 'runFindFirstProjectOverview',
		category: 'explore',
		mode: 'live',
		title: 'Обзор findFirst()',
		description: 'Показывает relation API через findFirst() с owner и tasks.',
		adapterMethods: [
			'db.query.*',
			'findFirst',
			'where',
			'orderBy',
			'limit',
			'offset',
			'extras',
			'with',
		],
		docUrl: docs.relations,
		sampleCode: `await db.query.labProjects.findFirst({ orderBy: (projects, { desc }) => [desc(projects.updatedAt)], with: { owner: true, tasks: true } });`,
	},
	{
		id: 'runJoinOverview',
		category: 'explore',
		mode: 'live',
		title: "Обзор join'ов",
		description: 'Строит плоский dataset project-owner-task через innerJoin() и leftJoin().',
		adapterMethods: ['select', 'innerJoin', 'leftJoin'],
		docUrl: docs.joins,
		sampleCode: `await db.select(fields).from(labProjects).innerJoin(labUsers, ...).leftJoin(labTasks, ...).orderBy(...).execute();`,
	},
	{
		id: 'runAdvancedJoinModes',
		category: 'advanced',
		mode: 'live',
		title: 'Продвинутые join modes',
		description:
			'Показывает leftSemi, leftOnly, rightSemi, rightOnly, exclusion и cross join на живых данных.',
		adapterMethods: [
			'leftSemiJoin',
			'leftOnlyJoin',
			'rightSemiJoin',
			'rightOnlyJoin',
			'exclusionJoin',
			'crossJoin',
		],
		docUrl: docs.joins,
		sampleCode: `await db.select({ id: users.id }).from(users).leftSemiJoin(projects, eq(projects.ownerId, users.id)).execute();`,
	},
	{
		id: 'runCteProjectLoad',
		category: 'explore',
		mode: 'live',
		title: 'CTE для project load',
		description: 'Показывает $with()/with() и чтение backlog-задач из CTE.',
		adapterMethods: ['$with', 'with', 'toSQL'],
		docUrl: docs.cte,
		sampleCode: `const backlog = db.$with("task_backlog").as(db.select(...).from(labTasks));\nawait db.with(backlog).select(...).from(backlog).execute();`,
	},
	{
		id: 'runSetOperatorsOverview',
		category: 'explore',
		mode: 'live',
		title: 'Операторы множеств',
		description: 'Сравнивает owners и assignees через union/intersect/except.',
		adapterMethods: ['union', 'intersect', 'except'],
		docUrl: docs.joins,
		sampleCode: `await owners.union(assignees).execute();\nawait owners.intersect(assignees).execute();\nawait owners.except(assignees).execute();`,
	},
	{
		id: 'runUnionAllOverview',
		category: 'advanced',
		mode: 'live',
		title: 'Обзор unionAll()',
		description: 'Склеивает project owners и task assignees без дедупликации.',
		adapterMethods: ['unionAll'],
		docUrl: docs.joins,
		sampleCode: `const rows = await owners.unionAll(assignees).execute();`,
	},
	{
		id: 'runDistinctOverview',
		category: 'explore',
		mode: 'live',
		title: 'Обзор distinct',
		description: 'Показывает distinct(), selectDistinct() и selectDistinctOn() на lab-данных.',
		adapterMethods: ['distinct', 'selectDistinct', 'distinctOn', 'selectDistinctOn'],
		docUrl: docs.methods,
		sampleCode: `await db.selectDistinct({ status: labTasks.status }).from(labTasks).execute();`,
	},
	{
		id: 'runSelectClausesOverview',
		category: 'explore',
		mode: 'live',
		title: 'Обзор where / group / order / pagination',
		description:
			'Показывает where(), groupBy(), having(), orderBy(), limit() и offset() на одной схеме.',
		adapterMethods: [
			'select',
			'from',
			'where',
			'groupBy',
			'having',
			'orderBy',
			'limit',
			'offset',
		],
		docUrl: docs.select,
		sampleCode: `await db.select({ status: labTasks.status, total: sql\`count(*)\` }).from(labTasks).where(sql\`\${labTasks.estimateHours} >= 5\`).groupBy(labTasks.status).having(sql\`count(*) >= 1\`).orderBy(asc(labTasks.status)).execute();`,
	},
	{
		id: 'runFromValuesBuilder',
		category: 'explore',
		mode: 'live',
		title: 'Builder fromValues()',
		description: 'Создает SELECT source прямо из inline object-rows.',
		adapterMethods: ['fromValues'],
		docUrl: docs.select,
		sampleCode: `await db.select({ lane: sql\`lanes.lane\`, weight: sql\`lanes.weight\` }).fromValues([{ lane: "backlog", weight: 1 }], { alias: "lanes", columns: ["lane", "weight"] }).execute();`,
	},
	{
		id: 'runValuesTableOverview',
		category: 'explore',
		mode: 'live',
		title: 'Join через valuesTable()',
		description: 'Создает inline lookup table и джойнит ее к задачам.',
		adapterMethods: ['valuesTable', 'leftJoin', 'toSQL'],
		docUrl: docs.sources,
		sampleCode: `const priorities = valuesTable([{ priority: "high", band: "P1" }], { alias: "priority_map", columns: ["priority", "band"] });\nawait db.select({ taskId: labTasks.id, band: sql\`priority_map.band\` }).from(labTasks).leftJoin(priorities, sql\`\${labTasks.priority} = priority_map.priority\`).execute();`,
	},
	{
		id: 'runRenderingOverview',
		category: 'advanced',
		mode: 'preview',
		title: 'Rendering и standalone builder',
		description:
			'Показывает db.select(), getSelectedFields(), getSQL(), toSQL() и addSetOperators() без live execution.',
		adapterMethods: ['db.select', 'getSelectedFields', 'getSQL', 'toSQL', 'addSetOperators'],
		docUrl: docs.cte,
		sampleCode: `const query = db.select({ id: users.id }).from(users).limit(2);\nquery.getSelectedFields();\nquery.getSQL();\nquery.toSQL();`,
	},
	{
		id: 'runWindowOverview',
		category: 'explore',
		mode: 'live',
		title: 'Оконное ранжирование',
		description:
			'Использует windowDefinition() + window() для ранжирования задач внутри проекта.',
		adapterMethods: ['windowDefinition', 'window'],
		docUrl: docs.analytical,
		sampleCode: `await query.window("task_rank_window", windowDefinition({ partitionBy: [labTasks.projectId], orderBy: [desc(labTasks.estimateHours)] })).execute();`,
	},
	{
		id: 'runGroupCompactOverview',
		category: 'advanced',
		mode: 'live',
		title: 'groupCompactBy() + assumeOrderBy()',
		description: 'Показывает YDB-specific groupCompactBy и assumeOrderBy на живых данных.',
		adapterMethods: ['groupCompactBy', 'assumeOrderBy'],
		docUrl: docs.select,
		sampleCode: `await db.select({ status: labTasks.status, total: sql\`count(*)\` }).from(labTasks).groupCompactBy(labTasks.status).execute();`,
	},
	{
		id: 'runPreparedReadsOverview',
		category: 'advanced',
		mode: 'live',
		title: 'Обзор prepared reads',
		description:
			'Показывает prepare(), getQuery(), execute(), all(), get(), values(), isResponseInArrayMode() и mapResult().',
		adapterMethods: [
			'prepare',
			'getQuery',
			'execute',
			'all',
			'get',
			'values',
			'isResponseInArrayMode',
			'mapResult',
		],
		docUrl: docs.cte,
		sampleCode: `const prepared = db.select({ id: labTasks.id }).from(labTasks).prepare("prepared_tasks");\nprepared.getQuery();\nawait prepared.execute();\nawait prepared.all();\nawait prepared.get();\nawait prepared.values();`,
	},
	{
		id: 'runYdbSpecificSelectPreview',
		category: 'advanced',
		mode: 'preview',
		title: 'Preview YDB-specific SELECT builders',
		description:
			'Показывает generated YQL для without, sample, tableSample, uniqueDistinct, fromAsTable и intoResult.',
		adapterMethods: [
			'without',
			'sample',
			'tableSample',
			'uniqueDistinct',
			'uniqueHint',
			'distinctHint',
			'fromAsTable',
			'asTable',
			'intoResult',
		],
		docUrl: docs.select,
		sampleCode: `await db.select().from(labUsers).without(labUsers.updatedAt).sample(0.5).intoResult("users_result").execute();`,
	},
	{
		id: 'runSelectSyntaxPreview',
		category: 'advanced',
		mode: 'preview',
		title: 'Preview flatten / matchRecognize',
		description:
			'Показывает flattenBy(), flattenListBy(), flattenDictBy(), flattenOptionalBy(), flattenColumns() и matchRecognize().',
		adapterMethods: [
			'flattenBy',
			'flattenListBy',
			'flattenDictBy',
			'flattenOptionalBy',
			'flattenColumns',
			'matchRecognize',
		],
		docUrl: docs.select,
		sampleCode: `await db.select({ item: sql\`ev.item\` }).fromAsTable("$event_rows", "ev").flattenBy(sql\`ev.items\`).execute();`,
	},
	{
		id: 'runSourceHelpersPreview',
		category: 'advanced',
		mode: 'preview',
		title: 'Preview values() и asTable()',
		description: 'Показывает source helpers values() и asTable() как чистый SQL preview.',
		adapterMethods: ['values', 'asTable'],
		docUrl: docs.sources,
		sampleCode: `const source = values([{ id: 1, name: "Ada" }]);\ndb.select({ id: sql\`v.id\`, name: sql\`v.name\` }).from(sql\`\${source} AS v\`).toSQL();\ndb.select({ id: sql\`r.id\`, name: sql\`r.name\` }).from(asTable("$rows", "r")).toSQL();`,
	},
	{
		id: 'runJoinBuildersPreview',
		category: 'advanced',
		mode: 'preview',
		title: 'Preview rightJoin() и fullJoin()',
		description:
			'Выносит оставшиеся join builders в отдельный preview-блок, чтобы каждый join был кликабелен.',
		adapterMethods: ['rightJoin', 'fullJoin'],
		docUrl: docs.joins,
		sampleCode: `await db.select().from(labProjects).rightJoin(labUsers, eq(labProjects.ownerId, labUsers.id)).execute();`,
	},
	{
		id: 'runGroupingPreview',
		category: 'advanced',
		mode: 'preview',
		title: 'Preview grouping helpers',
		description:
			'Показывает builder-preview для rollup, cube, groupingSets, groupKey и grouping.',
		adapterMethods: ['rollup', 'cube', 'groupingSets', 'groupKey', 'grouping'],
		docUrl: docs.analytical,
		sampleCode: `await db.select({...}).from(labTasks).groupBy(rollup(labTasks.projectId, labTasks.status)).execute();`,
	},
	{
		id: 'runTimeWindowPreview',
		category: 'advanced',
		mode: 'preview',
		title: 'Preview session / hop windows',
		description: 'Показывает sessionWindow(), sessionStart(), hop(), hopStart() и hopEnd().',
		adapterMethods: ['sessionWindow', 'sessionStart', 'hop', 'hopStart', 'hopEnd'],
		docUrl: docs.analytical,
		sampleCode: `await db.select({ bucket: sessionWindow(sql\`ev.created_at\`, "PT30M"), startedAt: sessionStart() }).fromAsTable("$event_rows", "ev").execute();`,
	},
	{
		id: 'runKnnPreview',
		category: 'advanced',
		mode: 'preview',
		title: 'Preview KNN helpers',
		description:
			'Показывает все vector-search helpers: cosine/euclidean/manhattan distance, similarity и generic KNN builders.',
		adapterMethods: [
			'knnCosineDistance',
			'knnEuclideanDistance',
			'knnManhattanDistance',
			'knnCosineSimilarity',
			'knnInnerProductSimilarity',
			'knnDistance',
			'knnSimilarity',
		],
		docUrl: docs.analytical,
		sampleCode: `await db.select({ score: knnCosineDistance(sql\`items.embedding\`, sql\`$target\`) }).fromAsTable("$items", "items").execute();`,
	},
	{
		id: 'runInsertSnapshotsFromSelect',
		category: 'explore',
		mode: 'live',
		title: 'insert().select() в task_copies',
		description: 'Копирует отфильтрованные tasks в четвертую таблицу через insert().select().',
		adapterMethods: ['db.insert', 'select'],
		docUrl: docs.mutations,
		sampleCode: `await db.insert(labTaskSnapshots).select(db.select(taskSelection).from(labTasks).where(eq(labTasks.status, "blocked"))).execute();`,
	},
	{
		id: 'runRawAllTasks',
		category: 'raw',
		mode: 'live',
		title: 'Чтение через db.all()',
		description: 'Читает задачи как plain objects через db.all().',
		adapterMethods: ['db.all', 'sql'],
		docUrl: docs.methods,
		sampleCode: `await db.all(sql\`SELECT id, title FROM ${'${labTasks}'}\`);`,
	},
	{
		id: 'runRawGetProject',
		category: 'raw',
		mode: 'live',
		title: 'Чтение через db.get()',
		description: 'Читает одну строку проекта через db.get().',
		adapterMethods: ['db.get', 'sql'],
		docUrl: docs.methods,
		sampleCode: `await db.get(sql\`SELECT id, title FROM ${'${labProjects}'} LIMIT 1\`);`,
	},
	{
		id: 'runRawValuesUsers',
		category: 'raw',
		mode: 'live',
		title: 'Чтение через db.values()',
		description: 'Возвращает пользователей в positional array-mode.',
		adapterMethods: ['db.values', 'sql'],
		docUrl: docs.methods,
		sampleCode: `await db.values(sql\`SELECT id, email FROM ${'${labUsers}'}\`);`,
	},
	{
		id: 'runTransactionCommit',
		category: 'raw',
		mode: 'live',
		title: 'Транзакция с commit',
		description: 'Создает task и copied task row внутри transaction().',
		adapterMethods: ['db.transaction', 'db.insert', 'prepare', 'get'],
		docUrl: docs.relations,
		sampleCode: `await db.transaction(async (tx) => {\n  await tx.insert(labTasks).values(record).execute();\n  return tx.select(taskSelection).from(labTasks).where(eq(labTasks.id, id)).prepare().get();\n});`,
	},
	{
		id: 'runTransactionRollback',
		category: 'raw',
		mode: 'live',
		title: 'Транзакция с rollback',
		description: 'Вставляет task и откатывает ее через rollback().',
		adapterMethods: ['db.transaction', 'rollback'],
		docUrl: docs.relations,
		sampleCode: `await db.transaction(async (tx) => {\n  await tx.insert(labTasks).values(record).execute();\n  tx.rollback();\n});`,
	},
	{
		id: 'runYqlScriptAction',
		category: 'raw',
		mode: 'live',
		title: 'Рабочий YQL script action',
		description:
			'Реально исполняет yqlScript() с pragma(), defineAction() и doAction() в рабочем subset локальной YDB.',
		adapterMethods: ['db.execute', 'yqlScript', 'pragma', 'defineAction', 'doAction'],
		docUrl: docs.scripts,
		sampleCode: `await db.execute(yqlScript(\n  pragma("TablePathPrefix", "/local"),\n  defineAction("$upsert_lab_task", [], ["UPSERT ..."]),\n  doAction("$upsert_lab_task", []),\n));`,
	},
	{
		id: 'runAdvancedScriptPreview',
		category: 'advanced',
		mode: 'preview',
		title: 'Preview script helpers',
		description:
			'Показывает declareParam, doBlock, intoResult, commit и kMeansTreeSearchTopSize в том виде, как их рендерит адаптер.',
		adapterMethods: [
			'yqlScript',
			'pragma',
			'kMeansTreeSearchTopSize',
			'declareParam',
			'doBlock',
			'intoResult',
			'commit',
		],
		docUrl: docs.scripts,
		sampleCode: `const script = yqlScript(\n  pragma("TablePathPrefix", "/local"),\n  declareParam("$userId", "Int32"),\n  doBlock([intoResult(sql\`SELECT * FROM users\`, "picked_user"), commit()]),\n);`,
	},
]
const actionHandlers: Record<string, ActionHandler> = {
	recreateLabSchema,
	seedTutorial: seedTutorialData,
	runRuntimeDdlLifecycle,
	runRuntimeDdlPreview,
	runCountOverview,
	insertUser,
	insertUserWithConflictUpdate,
	upsertUser,
	replaceUser,
	updateUser,
	getPreparedUser,
	deleteUser,
	insertProject,
	upsertProject,
	replaceProject,
	updateProject,
	getPreparedProject,
	deleteProject,
	insertTask,
	insertTaskWithConflictUpdate,
	upsertTask,
	replaceTask,
	updateTask,
	getPreparedTask,
	deleteTask,
	batchUpdateTasks,
	batchDeleteTasks,
	runRelationsOverview,
	runFindFirstProjectOverview,
	runJoinOverview,
	runAdvancedJoinModes,
	runCteProjectLoad,
	runSetOperatorsOverview,
	runUnionAllOverview,
	runDistinctOverview,
	runSelectClausesOverview,
	runFromValuesBuilder,
	runValuesTableOverview,
	runRenderingOverview,
	runWindowOverview,
	runGroupCompactOverview,
	runPreparedReadsOverview,
	runYdbSpecificSelectPreview,
	runSelectSyntaxPreview,
	runSourceHelpersPreview,
	runJoinBuildersPreview,
	runGroupingPreview,
	runTimeWindowPreview,
	runKnnPreview,
	runInsertSnapshotsFromSelect,
	runRawAllTasks,
	runRawGetProject,
	runRawValuesUsers,
	runTransactionCommit,
	runTransactionRollback,
	runYqlScriptAction,
	runAdvancedScriptPreview,
}
const actionMap = new Map(
	actionCatalog.map((action): [string, ActionCatalogEntry] => [action.id, action])
)
function createMethodItem(
	name: string,
	actionId: string,
	description: string,
	docUrl: string | null,
	extra: MethodItemOptions | string = {}
): MethodItem {
	const action = actionMap.get(actionId)
	const options = typeof extra === 'string' ? { availability: extra } : extra
	const availability = options.availability ?? 'available'
	return {
		id: `${actionId}:${name}:${availability}`,
		name,
		actionId,
		description,
		docUrl: docUrl ?? action?.docUrl ?? null,
		mode: action?.mode ?? 'preview',
		availability,
		payload: options.payload ?? {},
	}
}
function createMethodSection(
	id: string,
	title: string,
	eyebrow: string,
	docUrl: string | null,
	items: MethodItem[]
): MethodSection {
	return { id, title, eyebrow, docUrl, items }
}
export const methodCatalog = [
	createMethodSection('database-api', 'Database API', 'База', docs.methods, [
		createMethodItem(
			'execute()',
			'runYqlScriptAction',
			'Выполнение YQL или builder через db.execute().',
			docs.methods
		),
		createMethodItem(
			'all()',
			'runRawAllTasks',
			'Получение всех строк в object-mode.',
			docs.methods
		),
		createMethodItem('get()', 'runRawGetProject', 'Получение одной строки.', docs.methods),
		createMethodItem(
			'values()',
			'runRawValuesUsers',
			'Получение строк в positional array-mode.',
			docs.methods
		),
		createMethodItem(
			'select()',
			'runSelectClausesOverview',
			'Основной entrypoint SELECT builder.',
			docs.methods
		),
		createMethodItem(
			'selectDistinct()',
			'runDistinctOverview',
			'Distinct selection по полям.',
			docs.methods
		),
		createMethodItem(
			'selectDistinctOn()',
			'runDistinctOverview',
			'Distinct-on selection c ключом сортировки.',
			docs.methods
		),
		createMethodItem('$with()', 'runCteProjectLoad', 'Создание CTE binding.', docs.methods),
		createMethodItem(
			'with()',
			'runCteProjectLoad',
			'Подключение CTE к финальному SELECT.',
			docs.methods
		),
		createMethodItem(
			'insert()',
			'insertUser',
			'Mutation entrypoint для вставки.',
			docs.methods
		),
		createMethodItem('upsert()', 'upsertUser', 'Mutation entrypoint для upsert.', docs.methods),
		createMethodItem(
			'replace()',
			'replaceUser',
			'Mutation entrypoint для полной замены строки.',
			docs.methods
		),
		createMethodItem(
			'update()',
			'updateUser',
			'Mutation entrypoint для patch-обновления.',
			docs.methods,
			{
				payload: { id: 1001, name: 'Ada Lovelace', status: 'review' },
			}
		),
		createMethodItem('delete()', 'deleteTask', 'Удаление строки.', docs.methods, {
			payload: { id: 3006 },
		}),
		createMethodItem(
			'$count()',
			'runCountOverview',
			'Подсчет строк и фильтрованных подмножеств.',
			docs.methods
		),
	]),
	createMethodSection(
		'transactions-relations',
		'Transactions & Relations',
		'Relations',
		docs.relations,
		[
			createMethodItem(
				'transaction()',
				'runTransactionCommit',
				'Транзакция с сохранением результата.',
				docs.relations
			),
			createMethodItem(
				'rollback()',
				'runTransactionRollback',
				'Явный rollback внутри транзакции.',
				docs.relations
			),
			createMethodItem(
				'findMany()',
				'runRelationsOverview',
				'Hydrated relation query со связями.',
				docs.relations
			),
			createMethodItem(
				'findFirst()',
				'runFindFirstProjectOverview',
				'Hydrated relation query для одной записи.',
				docs.relations
			),
			createMethodItem(
				'columns',
				'runRelationsOverview',
				'Выбор колонок внутри relation API.',
				docs.relations
			),
			createMethodItem(
				'where',
				'runFindFirstProjectOverview',
				'Фильтрация внутри relation config.',
				docs.relations
			),
			createMethodItem(
				'orderBy',
				'runFindFirstProjectOverview',
				'Сортировка внутри relation config.',
				docs.relations
			),
			createMethodItem(
				'limit',
				'runFindFirstProjectOverview',
				'Ограничение результата relation query.',
				docs.relations
			),
			createMethodItem(
				'offset',
				'runFindFirstProjectOverview',
				'Смещение результата relation query.',
				docs.relations
			),
			createMethodItem(
				'extras',
				'runFindFirstProjectOverview',
				'Дополнительные вычисляемые поля relation query.',
				docs.relations
			),
			createMethodItem(
				'with',
				'runRelationsOverview',
				'Подгрузка связанных сущностей.',
				docs.relations
			),
		]
	),
	createMethodSection('mutations', 'Mutations', 'DML', docs.mutations, [
		createMethodItem('insert()', 'insertUser', 'Обычная вставка строки.', docs.mutations),
		createMethodItem(
			'insert().select()',
			'runInsertSnapshotsFromSelect',
			'Вставка из SELECT в отдельную таблицу.',
			docs.mutations
		),
		createMethodItem(
			'onDuplicateKeyUpdate()',
			'insertUserWithConflictUpdate',
			'Conflict-aware update при insert.',
			docs.mutations
		),
		createMethodItem('upsert()', 'upsertTask', 'Upsert строк с returning.', docs.mutations),
		createMethodItem('replace()', 'replaceTask', 'Полная замена строки.', docs.mutations),
		createMethodItem('update()', 'updateTask', 'Обновление полей с фильтром.', docs.mutations, {
			payload: { id: 3001, status: 'review', estimateHours: 14 },
		}),
		createMethodItem('delete()', 'deleteTask', 'Удаление одной сущности.', docs.mutations, {
			payload: { id: 3006 },
		}),
		createMethodItem(
			'returning()',
			'updateTask',
			'Возврат измененных строк после mutation.',
			docs.mutations,
			{
				payload: { id: 3001, status: 'done', estimateHours: 10 },
			}
		),
	]),
	createMethodSection('batch', 'Batch Methods', 'Batch', docs.mutations, [
		createMethodItem(
			'batchUpdate()',
			'batchUpdateTasks',
			'Массовое обновление записей по условию.',
			docs.mutations
		),
		createMethodItem(
			'batchDelete()',
			'batchDeleteTasks',
			'Массовое удаление записей по условию.',
			docs.mutations
		),
	]),
	createMethodSection('select', 'SELECT Builder', 'Select', docs.select, [
		createMethodItem(
			'from()',
			'runSelectClausesOverview',
			'Источник данных для SELECT.',
			docs.select
		),
		createMethodItem(
			'fromAsTable()',
			'runYdbSpecificSelectPreview',
			'Работа с AS_TABLE(binding).',
			docs.select
		),
		createMethodItem(
			'fromValues()',
			'runFromValuesBuilder',
			'Inline rows как SELECT source.',
			docs.select
		),
		createMethodItem(
			'getSelectedFields()',
			'runRenderingOverview',
			'Получение карты выбранных полей builder-а.',
			docs.select
		),
		createMethodItem('where()', 'runSelectClausesOverview', 'Фильтрация строк.', docs.select),
		createMethodItem(
			'having()',
			'runSelectClausesOverview',
			'Фильтрация агрегатов.',
			docs.select
		),
		createMethodItem(
			'groupBy()',
			'runSelectClausesOverview',
			'Группировка по выражениям.',
			docs.select
		),
		createMethodItem(
			'groupCompactBy()',
			'runGroupCompactOverview',
			'YDB-specific compact grouping.',
			docs.select
		),
		createMethodItem(
			'orderBy()',
			'runSelectClausesOverview',
			'Сортировка результата.',
			docs.select
		),
		createMethodItem(
			'assumeOrderBy()',
			'runGroupCompactOverview',
			'YDB-specific order assumption.',
			docs.select
		),
		createMethodItem(
			'limit()',
			'runSelectClausesOverview',
			'Постраничное ограничение результата.',
			docs.select
		),
		createMethodItem(
			'offset()',
			'runSelectClausesOverview',
			'Постраничное смещение результата.',
			docs.select
		),
		createMethodItem(
			'without()',
			'runYdbSpecificSelectPreview',
			'Удаление колонок из whole-row selection.',
			docs.select
		),
		createMethodItem(
			'flattenBy()',
			'runSelectSyntaxPreview',
			'Общий flatten builder.',
			docs.select
		),
		createMethodItem(
			'flattenListBy()',
			'runSelectSyntaxPreview',
			'Flatten списка.',
			docs.select
		),
		createMethodItem(
			'flattenDictBy()',
			'runSelectSyntaxPreview',
			'Flatten словаря.',
			docs.select
		),
		createMethodItem(
			'flattenOptionalBy()',
			'runSelectSyntaxPreview',
			'Flatten optional значения.',
			docs.select
		),
		createMethodItem(
			'flattenColumns()',
			'runSelectSyntaxPreview',
			'Разворачивание whole-row в колонки.',
			docs.select
		),
		createMethodItem('sample()', 'runYdbSpecificSelectPreview', 'Sampling строк.', docs.select),
		createMethodItem(
			'tableSample()',
			'runYdbSpecificSelectPreview',
			'Sampling таблицы по методу/seed.',
			docs.select
		),
		createMethodItem(
			'matchRecognize()',
			'runSelectSyntaxPreview',
			'Pattern matching по потоку событий.',
			docs.select
		),
		createMethodItem(
			'window()',
			'runWindowOverview',
			'Named windows на SELECT builder.',
			docs.select
		),
		createMethodItem(
			'intoResult()',
			'runYdbSpecificSelectPreview',
			'Рендеринг INTO RESULT для SELECT.',
			docs.select
		),
		createMethodItem(
			'uniqueDistinct()',
			'runYdbSpecificSelectPreview',
			'YDB hints UNIQUE/DISTINCT.',
			docs.select
		),
		createMethodItem(
			'distinct()',
			'runDistinctOverview',
			'Distinct на builder уровне.',
			docs.select
		),
		createMethodItem(
			'distinctOn()',
			'runDistinctOverview',
			'Distinct-on на builder уровне.',
			docs.select
		),
	]),
	createMethodSection('joins', 'Joins & Set Operators', 'Join', docs.joins, [
		createMethodItem('innerJoin()', 'runJoinOverview', 'Внутреннее соединение.', docs.joins),
		createMethodItem('leftJoin()', 'runJoinOverview', 'Левое соединение.', docs.joins),
		createMethodItem('rightJoin()', 'runJoinBuildersPreview', 'Правое соединение.', docs.joins),
		createMethodItem('fullJoin()', 'runJoinBuildersPreview', 'Полное соединение.', docs.joins),
		createMethodItem(
			'crossJoin()',
			'runAdvancedJoinModes',
			'Декартово произведение.',
			docs.joins
		),
		createMethodItem('leftSemiJoin()', 'runAdvancedJoinModes', 'Левый semi join.', docs.joins),
		createMethodItem(
			'rightSemiJoin()',
			'runAdvancedJoinModes',
			'Правый semi join.',
			docs.joins
		),
		createMethodItem('leftOnlyJoin()', 'runAdvancedJoinModes', 'Левый anti join.', docs.joins),
		createMethodItem(
			'rightOnlyJoin()',
			'runAdvancedJoinModes',
			'Правый anti join.',
			docs.joins
		),
		createMethodItem(
			'exclusionJoin()',
			'runAdvancedJoinModes',
			'Симметрическая разность источников.',
			docs.joins
		),
		createMethodItem('union()', 'runSetOperatorsOverview', 'Builder method union.', docs.joins),
		createMethodItem(
			'unionAll()',
			'runUnionAllOverview',
			'Builder method union all.',
			docs.joins
		),
		createMethodItem(
			'intersect()',
			'runSetOperatorsOverview',
			'Builder method intersect.',
			docs.joins
		),
		createMethodItem(
			'except()',
			'runSetOperatorsOverview',
			'Builder method except.',
			docs.joins
		),
		createMethodItem(
			'addSetOperators()',
			'runRenderingOverview',
			'Низкоуровневое добавление set-операторов.',
			docs.joins
		),
		createMethodItem(
			'union() helper',
			'runSetOperatorsOverview',
			'Top-level helper union(left, right).',
			docs.joins
		),
		createMethodItem(
			'unionAll() helper',
			'runUnionAllOverview',
			'Top-level helper unionAll(left, right).',
			docs.joins
		),
		createMethodItem(
			'intersect() helper',
			'runSetOperatorsOverview',
			'Top-level helper intersect(left, right).',
			docs.joins
		),
		createMethodItem(
			'except() helper',
			'runSetOperatorsOverview',
			'Top-level helper except(left, right).',
			docs.joins
		),
	]),
	createMethodSection('cte-rendering', 'CTE & Rendering', 'CTE', docs.cte, [
		createMethodItem(
			'db.select() rendering',
			'runRenderingOverview',
			'Rendering через публичный database builder.',
			docs.cte
		),
		createMethodItem(
			'$with()',
			'runCteProjectLoad',
			'Создание CTE binding через db.$with().',
			docs.cte
		),
		createMethodItem(
			'with()',
			'runCteProjectLoad',
			'Подключение binding-ов к SELECT.',
			docs.cte
		),
		createMethodItem(
			'getSQL()',
			'runRenderingOverview',
			'Доступ к Drizzle SQL object.',
			docs.cte
		),
		createMethodItem(
			'toSQL()',
			'runRenderingOverview',
			'Рендеринг в { sql, params }.',
			docs.cte
		),
		createMethodItem(
			'prepare()',
			'runPreparedReadsOverview',
			'Подготовленный query executor.',
			docs.cte
		),
		createMethodItem(
			'getQuery()',
			'runPreparedReadsOverview',
			'Получение SQL/params prepared query.',
			docs.cte
		),
		createMethodItem(
			'isResponseInArrayMode()',
			'runPreparedReadsOverview',
			'Проверка positional режима ответа.',
			docs.cte
		),
		createMethodItem(
			'mapResult()',
			'runPreparedReadsOverview',
			'Ручной маппинг prepared результата.',
			docs.cte
		),
		createMethodItem(
			'execute()',
			'runPreparedReadsOverview',
			'Низкоуровневое выполнение prepared query.',
			docs.cte
		),
		createMethodItem(
			'all()',
			'runPreparedReadsOverview',
			'Получение массива typed rows.',
			docs.cte
		),
		createMethodItem('get()', 'runPreparedReadsOverview', 'Получение первой строки.', docs.cte),
		createMethodItem(
			'values()',
			'runPreparedReadsOverview',
			'Получение positional rows.',
			docs.cte
		),
	]),
	createMethodSection('sources', 'SELECT Sources', 'Sources', docs.sources, [
		createMethodItem(
			'values()',
			'runSourceHelpersPreview',
			'SQL fragment для inline values.',
			docs.sources
		),
		createMethodItem(
			'valuesTable()',
			'runValuesTableOverview',
			'Table source fragment для JOIN/FROM.',
			docs.sources
		),
		createMethodItem(
			'asTable()',
			'runSourceHelpersPreview',
			'AS_TABLE(binding) helper.',
			docs.sources
		),
		createMethodItem(
			'matchRecognize()',
			'runSelectSyntaxPreview',
			'Pattern recognition clause.',
			docs.sources
		),
	]),
	createMethodSection('analytical', 'Analytical Helpers', 'Analytics', docs.analytical, [
		createMethodItem(
			'uniqueHint()',
			'runYdbSpecificSelectPreview',
			'UNIQUE hint для uniqueDistinct().',
			docs.analytical
		),
		createMethodItem(
			'distinctHint()',
			'runYdbSpecificSelectPreview',
			'DISTINCT hint для uniqueDistinct().',
			docs.analytical
		),
		createMethodItem(
			'windowDefinition()',
			'runWindowOverview',
			'Описание named window.',
			docs.analytical
		),
		createMethodItem(
			'groupKey()',
			'runGroupingPreview',
			'Маркер group key для grouping sets.',
			docs.analytical
		),
		createMethodItem('rollup()', 'runGroupingPreview', 'ROLLUP fragment.', docs.analytical),
		createMethodItem('cube()', 'runGroupingPreview', 'CUBE fragment.', docs.analytical),
		createMethodItem(
			'groupingSets()',
			'runGroupingPreview',
			'GROUPING SETS fragment.',
			docs.analytical
		),
		createMethodItem(
			'grouping()',
			'runGroupingPreview',
			'GROUPING expression.',
			docs.analytical
		),
		createMethodItem(
			'sessionWindow()',
			'runTimeWindowPreview',
			'Session window bucket.',
			docs.analytical
		),
		createMethodItem(
			'sessionStart()',
			'runTimeWindowPreview',
			'Начало session window.',
			docs.analytical
		),
		createMethodItem('hop()', 'runTimeWindowPreview', 'HOP bucket.', docs.analytical),
		createMethodItem(
			'hopStart()',
			'runTimeWindowPreview',
			'Начало hop window.',
			docs.analytical
		),
		createMethodItem('hopEnd()', 'runTimeWindowPreview', 'Конец hop window.', docs.analytical),
		createMethodItem(
			'knnCosineDistance()',
			'runKnnPreview',
			'KNN cosine distance.',
			docs.analytical
		),
		createMethodItem(
			'knnEuclideanDistance()',
			'runKnnPreview',
			'KNN euclidean distance.',
			docs.analytical
		),
		createMethodItem(
			'knnManhattanDistance()',
			'runKnnPreview',
			'KNN manhattan distance.',
			docs.analytical
		),
		createMethodItem(
			'knnCosineSimilarity()',
			'runKnnPreview',
			'KNN cosine similarity.',
			docs.analytical
		),
		createMethodItem(
			'knnInnerProductSimilarity()',
			'runKnnPreview',
			'KNN inner product similarity.',
			docs.analytical
		),
		createMethodItem(
			'knnDistance()',
			'runKnnPreview',
			'Generic KNN distance helper.',
			docs.analytical
		),
		createMethodItem(
			'knnSimilarity()',
			'runKnnPreview',
			'Generic KNN similarity helper.',
			docs.analytical
		),
	]),
	createMethodSection('scripts', 'YQL Scripts', 'Scripts', docs.scripts, [
		createMethodItem(
			'yqlScript()',
			'runYqlScriptAction',
			'Склейка YQL script statements.',
			docs.scripts
		),
		createMethodItem(
			'pragma()',
			'runYqlScriptAction',
			'PRAGMA statements внутри script.',
			docs.scripts
		),
		createMethodItem(
			'kMeansTreeSearchTopSize()',
			'runAdvancedScriptPreview',
			'Helper для ydb KNN pragma.',
			docs.scripts
		),
		createMethodItem(
			'declareParam()',
			'runAdvancedScriptPreview',
			'Объявление параметров script-а.',
			docs.scripts
		),
		createMethodItem(
			'commit()',
			'runAdvancedScriptPreview',
			'Явный COMMIT в script flow.',
			docs.scripts
		),
		createMethodItem(
			'defineAction()',
			'runYqlScriptAction',
			'Определение reusable ACTION.',
			docs.scripts
		),
		createMethodItem(
			'doAction()',
			'runYqlScriptAction',
			'Вызов ACTION с параметрами.',
			docs.scripts
		),
		createMethodItem(
			'doBlock()',
			'runAdvancedScriptPreview',
			'Группировка statements в блок.',
			docs.scripts
		),
		createMethodItem(
			'intoResult()',
			'runAdvancedScriptPreview',
			'Маркировка statement как named result set.',
			docs.scripts
		),
	]),
	createMethodSection('schema', 'Schema & DDL', 'DDL', docs.tableDdl, [
		createMethodItem(
			'relations()',
			'runRelationsOverview',
			'Описание relation metadata в schema.',
			docs.schemaOverview
		),
		createMethodItem(
			'one()',
			'runRelationsOverview',
			'One relation helper.',
			docs.schemaOverview
		),
		createMethodItem(
			'many()',
			'runRelationsOverview',
			'Many relation helper.',
			docs.schemaOverview
		),
		createMethodItem(
			'primaryKey()',
			'runRuntimeDdlPreview',
			'Описание PK в schema metadata.',
			docs.schemaConstraints
		),
		createMethodItem(
			'unique()',
			'runRuntimeDdlPreview',
			'Уникальные ограничения в schema metadata.',
			docs.schemaConstraints
		),
		createMethodItem(
			'index()',
			'runRuntimeDdlPreview',
			'Индексы в schema metadata.',
			docs.schemaConstraints
		),
		createMethodItem(
			'partitionByHash()',
			'runRuntimeDdlPreview',
			'Hash partitioning table option.',
			docs.schemaOptions
		),
		createMethodItem(
			'ttl()',
			'runRuntimeDdlPreview',
			'TTL метаданные таблицы.',
			docs.schemaOptions
		),
		createMethodItem(
			'columnFamily()',
			'runRuntimeDdlPreview',
			'Column family metadata.',
			docs.schemaOptions
		),
		createMethodItem(
			'tableOptions()',
			'runRuntimeDdlPreview',
			'Опции таблицы на уровне schema.',
			docs.schemaOptions
		),
		createMethodItem(
			'rawTableOption()',
			'runRuntimeDdlPreview',
			'Raw option значения для tableOptions.',
			docs.schemaOptions
		),
		createMethodItem(
			'migrate()',
			'recreateLabSchema',
			'Запуск inline migrations против YDB.',
			docs.migrate
		),
		createMethodItem(
			'buildCreateTableSql()',
			'runRuntimeDdlPreview',
			'Рендеринг CREATE TABLE по schema metadata.',
			docs.tableDdl
		),
		createMethodItem(
			'buildDropTableSql()',
			'runRuntimeDdlLifecycle',
			'Рендеринг DROP TABLE.',
			docs.tableDdl
		),
		createMethodItem(
			'buildAnalyzeSql()',
			'runRuntimeDdlPreview',
			'ANALYZE statement builder.',
			docs.tableDdl
		),
		createMethodItem(
			'buildRenameTableSql()',
			'runRuntimeDdlLifecycle',
			'RENAME TABLE builder.',
			docs.tableDdl
		),
		createMethodItem(
			'buildAddColumnsSql()',
			'runRuntimeDdlPreview',
			'ADD COLUMN statements.',
			docs.tableDdl
		),
		createMethodItem(
			'buildDropColumnsSql()',
			'runRuntimeDdlPreview',
			'DROP COLUMN statements.',
			docs.tableDdl
		),
		createMethodItem(
			'buildAddIndexSql()',
			'runRuntimeDdlPreview',
			'ADD INDEX builder.',
			docs.tableDdl
		),
		createMethodItem(
			'buildDropIndexSql()',
			'runRuntimeDdlPreview',
			'DROP INDEX builder.',
			docs.tableDdl
		),
		createMethodItem(
			'buildAlterTableSetOptionsSql()',
			'runRuntimeDdlPreview',
			'SET TABLE OPTIONS builder.',
			docs.tableDdl
		),
		createMethodItem(
			'buildAlterTableResetOptionsSql()',
			'runRuntimeDdlPreview',
			'RESET TABLE OPTIONS builder.',
			docs.tableDdl
		),
		createMethodItem(
			'buildAlterTableSql()',
			'runRuntimeDdlPreview',
			'Multi-action ALTER TABLE builder.',
			docs.tableDdl
		),
		createMethodItem(
			'buildAddChangefeedSql()',
			'runRuntimeDdlPreview',
			'ADD CHANGEFEED builder.',
			docs.tableDdl
		),
		createMethodItem(
			'buildDropChangefeedSql()',
			'runRuntimeDdlPreview',
			'DROP CHANGEFEED builder.',
			docs.tableDdl
		),
	]),
]
export const mutatingActionIds = [
	'recreateLabSchema',
	'seedTutorial',
	'insertUser',
	'insertUserWithConflictUpdate',
	'upsertUser',
	'replaceUser',
	'updateUser',
	'deleteUser',
	'insertProject',
	'upsertProject',
	'replaceProject',
	'updateProject',
	'deleteProject',
	'insertTask',
	'insertTaskWithConflictUpdate',
	'upsertTask',
	'replaceTask',
	'updateTask',
	'deleteTask',
	'batchUpdateTasks',
	'batchDeleteTasks',
	'runInsertSnapshotsFromSelect',
	'runTransactionCommit',
	'runYqlScriptAction',
]
export async function executeAction(actionId: string, payload: Record<string, unknown> = {}) {
	const action = actionCatalog.find((entry) => entry.id === actionId)
	if (!action) {
		throw new Error(`Unknown action: ${actionId}`)
	}
	const handler = actionHandlers[actionId]
	if (!handler) {
		throw new Error(`Missing handler for action: ${actionId}`)
	}
	return runWithTrace(action, async () => handler(payload))
}
export async function loadBootstrap() {
	await ensureDemoData()
	return {
		state: await getStateSnapshot(),
		actionCatalog,
		methodCatalog,
		mutatingActionIds,
	}
}
