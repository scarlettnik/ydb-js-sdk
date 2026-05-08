import { asc, desc, eq, sql } from 'drizzle-orm'
import {
	asTable,
	commit,
	cube,
	declareParam,
	defineAction,
	distinctHint,
	doAction,
	doBlock,
	groupKey,
	grouping,
	groupingSets,
	hop,
	hopEnd,
	hopStart,
	intoResult,
	kMeansTreeSearchTopSize,
	knnCosineDistance,
	knnCosineSimilarity,
	knnDistance,
	knnEuclideanDistance,
	knnInnerProductSimilarity,
	knnManhattanDistance,
	knnSimilarity,
	matchRecognize,
	pragma,
	rollup,
	sessionStart,
	sessionWindow,
	uniqueHint,
	values,
	valuesTable,
	windowDefinition,
	yqlScript,
} from '@ydbjs/drizzle-adapter'
import { connectionString, db } from './client.js'
import {
	LAB_MIGRATIONS_LOCK_TABLE,
	LAB_MIGRATIONS_TABLE,
	RUNTIME_DDL_ARCHIVE_TABLE,
	RUNTIME_DDL_TABLE,
	ensureSchema,
	executeDdlStatementsInOrder,
	getAdvancedDdlStatements,
	getCreateSchemaStatements,
	getMigrationStatements,
	getRecreateSchemaStatements,
	getRuntimeDdlLifecycleStatements,
	getRuntimeDdlPreviewStatements,
	getServiceStatements,
	recreateSchema,
} from './setup.js'
import { labProjects, labTaskSnapshots, labTasks, labUsers } from './schema.js'
import { getRecentQueries } from '../server/trace.js'

const userSelection = {
	id: labUsers.id,
	email: labUsers.email,
	name: labUsers.name,
	role: labUsers.role,
	status: labUsers.status,
	createdAt: labUsers.createdAt,
	updatedAt: labUsers.updatedAt,
}

const projectSelection = {
	id: labProjects.id,
	ownerId: labProjects.ownerId,
	slug: labProjects.slug,
	title: labProjects.title,
	status: labProjects.status,
	budget: labProjects.budget,
	createdAt: labProjects.createdAt,
	updatedAt: labProjects.updatedAt,
}

const taskSelection = {
	id: labTasks.id,
	projectId: labTasks.projectId,
	assigneeId: labTasks.assigneeId,
	title: labTasks.title,
	status: labTasks.status,
	priority: labTasks.priority,
	estimateHours: labTasks.estimateHours,
	createdAt: labTasks.createdAt,
	updatedAt: labTasks.updatedAt,
}

const snapshotSelection = {
	id: labTaskSnapshots.id,
	projectId: labTaskSnapshots.projectId,
	assigneeId: labTaskSnapshots.assigneeId,
	title: labTaskSnapshots.title,
	status: labTaskSnapshots.status,
	priority: labTaskSnapshots.priority,
	estimateHours: labTaskSnapshots.estimateHours,
	createdAt: labTaskSnapshots.createdAt,
	updatedAt: labTaskSnapshots.updatedAt,
}

function createSqlPreview(title: any, rendered: any) {
	return {
		title,
		sql: rendered.sql,
		params: rendered.params ?? [],
	}
}

function createStatementPreview(title: any, statement: any, params: any = []) {
	return {
		title,
		sql: statement,
		params,
	}
}

function createPreviewOnlyResult({ note, sqlPreview, ...rest }: any) {
	return {
		mode: 'preview',
		note,
		sqlPreview,
		...rest,
	}
}

function renderScriptText(script: any) {
	if (typeof script === 'string') {
		return script
	}

	if (script?.queryChunks) {
		return script.queryChunks.map((chunk: any) => String(chunk)).join('')
	}

	return String(script)
}

const tutorialUsers = [
	{
		id: 1001,
		email: 'ada@adapter.lab',
		name: 'Ada Lovelace',
		role: 'architect',
		status: 'active',
		createdAt: new Date('2026-02-01T09:00:00.000Z'),
		updatedAt: new Date('2026-02-01T09:00:00.000Z'),
	},
	{
		id: 1002,
		email: 'grace@adapter.lab',
		name: 'Grace Hopper',
		role: 'lead',
		status: 'active',
		createdAt: new Date('2026-02-02T09:00:00.000Z'),
		updatedAt: new Date('2026-02-02T09:00:00.000Z'),
	},
	{
		id: 1003,
		email: 'linus@adapter.lab',
		name: 'Linus Torvalds',
		role: 'reviewer',
		status: 'review',
		createdAt: new Date('2026-02-03T09:00:00.000Z'),
		updatedAt: new Date('2026-02-03T09:00:00.000Z'),
	},
	{
		id: 1004,
		email: 'margaret@adapter.lab',
		name: 'Margaret Hamilton',
		role: 'delivery',
		status: 'active',
		createdAt: new Date('2026-02-04T09:00:00.000Z'),
		updatedAt: new Date('2026-02-04T09:00:00.000Z'),
	},
]

const tutorialProjects = [
	{
		id: 2001,
		ownerId: 1001,
		slug: 'adapter-lab-ui',
		title: 'Adapter UI Lab',
		status: 'active',
		budget: 120,
		createdAt: new Date('2026-03-01T09:00:00.000Z'),
		updatedAt: new Date('2026-03-01T09:00:00.000Z'),
	},
	{
		id: 2002,
		ownerId: 1002,
		slug: 'migration-trainer',
		title: 'Migration Trainer',
		status: 'planning',
		budget: 80,
		createdAt: new Date('2026-03-02T09:00:00.000Z'),
		updatedAt: new Date('2026-03-02T09:00:00.000Z'),
	},
	{
		id: 2003,
		ownerId: 1004,
		slug: 'trace-theater',
		title: 'Trace Theater',
		status: 'review',
		budget: 60,
		createdAt: new Date('2026-03-03T09:00:00.000Z'),
		updatedAt: new Date('2026-03-03T09:00:00.000Z'),
	},
]

const tutorialTasks = [
	{
		id: 3001,
		projectId: 2001,
		assigneeId: 1002,
		title: 'Design multi-table dashboard',
		status: 'todo',
		priority: 'high',
		estimateHours: 18,
		createdAt: new Date('2026-03-05T09:00:00.000Z'),
		updatedAt: new Date('2026-03-05T09:00:00.000Z'),
	},
	{
		id: 3002,
		projectId: 2001,
		assigneeId: 1001,
		title: 'Add action catalog with doc links',
		status: 'in-progress',
		priority: 'medium',
		estimateHours: 8,
		createdAt: new Date('2026-03-06T09:00:00.000Z'),
		updatedAt: new Date('2026-03-06T09:00:00.000Z'),
	},
	{
		id: 3003,
		projectId: 2002,
		assigneeId: 1003,
		title: 'Implement recreate schema flow',
		status: 'blocked',
		priority: 'high',
		estimateHours: 13,
		createdAt: new Date('2026-03-07T09:00:00.000Z'),
		updatedAt: new Date('2026-03-07T09:00:00.000Z'),
	},
	{
		id: 3004,
		projectId: 2002,
		assigneeId: 1002,
		title: 'Query migration history',
		status: 'review',
		priority: 'medium',
		estimateHours: 5,
		createdAt: new Date('2026-03-08T09:00:00.000Z'),
		updatedAt: new Date('2026-03-08T09:00:00.000Z'),
	},
	{
		id: 3005,
		projectId: 2003,
		assigneeId: 1004,
		title: 'Render last trace and result code',
		status: 'done',
		priority: 'low',
		estimateHours: 3,
		createdAt: new Date('2026-03-09T09:00:00.000Z'),
		updatedAt: new Date('2026-03-09T09:00:00.000Z'),
	},
	{
		id: 3006,
		projectId: 2003,
		assigneeId: 1001,
		title: 'Prepare relations demo',
		status: 'todo',
		priority: 'high',
		estimateHours: 11,
		createdAt: new Date('2026-03-10T09:00:00.000Z'),
		updatedAt: new Date('2026-03-10T09:00:00.000Z'),
	},
]

const tutorialSnapshots = [
	{
		id: 3003,
		projectId: 2002,
		assigneeId: 1003,
		title: 'Implement recreate schema flow',
		status: 'blocked',
		priority: 'high',
		estimateHours: 13,
		createdAt: new Date('2026-03-11T09:00:00.000Z'),
		updatedAt: new Date('2026-03-11T09:00:00.000Z'),
	},
	{
		id: 3005,
		projectId: 2003,
		assigneeId: 1004,
		title: 'Render last trace and result code',
		status: 'done',
		priority: 'low',
		estimateHours: 3,
		createdAt: new Date('2026-03-11T12:00:00.000Z'),
		updatedAt: new Date('2026-03-11T12:00:00.000Z'),
	},
]

const firstTutorialUser = tutorialUsers[0]!
const secondTutorialUser = tutorialUsers[1]!
const firstTutorialProject = tutorialProjects[0]!
const secondTutorialProject = tutorialProjects[1]!

function normalizeText(value: any, fallback = '') {
	return String(value ?? fallback).trim()
}

function normalizeInt(value: any, fallback?: any) {
	const parsed = Number(value ?? fallback)

	if (!Number.isInteger(parsed)) {
		throw new Error('Expected an integer value.')
	}

	return parsed
}

async function nextId(table: any, column: any) {
	const latest: any = await db
		.select({ id: column })
		.from(table)
		.orderBy(desc(column))
		.limit(1)
		.prepare()
		.get()

	return Number(latest?.id ?? 0) + 1
}

async function getUserById(id: any) {
	return db.select(userSelection).from(labUsers).where(eq(labUsers.id, id)).prepare().get()
}

async function getProjectById(id: any) {
	return db
		.select(projectSelection)
		.from(labProjects)
		.where(eq(labProjects.id, id))
		.prepare()
		.get()
}

async function getTaskById(id: any) {
	return db.select(taskSelection).from(labTasks).where(eq(labTasks.id, id)).prepare().get()
}

async function assertUserExists(id: any) {
	const row = await getUserById(id)

	if (!row) {
		throw new Error(`User ${id} was not found.`)
	}

	return row
}

async function assertProjectExists(id: any) {
	const row = await getProjectById(id)

	if (!row) {
		throw new Error(`Project ${id} was not found.`)
	}

	return row
}

async function assertTaskExists(id: any) {
	const row = await getTaskById(id)

	if (!row) {
		throw new Error(`Task ${id} was not found.`)
	}

	return row
}

function buildUserRecord(payload: any, existing?: any) {
	const now = new Date()

	return {
		id: normalizeInt(payload.id, existing?.id ?? 0),
		email: normalizeText(payload.email, existing?.email || `user-${now.getTime()}@adapter.lab`),
		name: normalizeText(payload.name, existing?.name || 'Adapter User'),
		role: normalizeText(payload.role, existing?.role || 'engineer'),
		status: normalizeText(payload.status, existing?.status || 'active'),
		createdAt: payload.createdAt ? new Date(payload.createdAt) : (existing?.createdAt ?? now),
		updatedAt: now,
	}
}

async function buildProjectRecord(payload: any, existing?: any) {
	const now = new Date()
	const ownerId = normalizeInt(payload.ownerId, existing?.ownerId ?? firstTutorialUser.id)
	await assertUserExists(ownerId)

	return {
		id: normalizeInt(payload.id, existing?.id ?? 0),
		ownerId,
		slug: normalizeText(payload.slug, existing?.slug || `project-${now.getTime()}`),
		title: normalizeText(payload.title, existing?.title || 'Adapter Project'),
		status: normalizeText(payload.status, existing?.status || 'active'),
		budget: normalizeInt(payload.budget, existing?.budget ?? 40),
		createdAt: payload.createdAt ? new Date(payload.createdAt) : (existing?.createdAt ?? now),
		updatedAt: now,
	}
}

async function buildTaskRecord(payload: any, existing?: any) {
	const now = new Date()
	const projectId = normalizeInt(
		payload.projectId,
		existing?.projectId ?? firstTutorialProject.id
	)
	const assigneeId = normalizeInt(
		payload.assigneeId,
		existing?.assigneeId ?? firstTutorialUser.id
	)
	await Promise.all([assertProjectExists(projectId), assertUserExists(assigneeId)])

	return {
		id: normalizeInt(payload.id, existing?.id ?? 0),
		projectId,
		assigneeId,
		title: normalizeText(payload.title, existing?.title || 'Adapter Task'),
		status: normalizeText(payload.status, existing?.status || 'todo'),
		priority: normalizeText(payload.priority, existing?.priority || 'medium'),
		estimateHours: normalizeInt(payload.estimateHours, existing?.estimateHours ?? 4),
		createdAt: payload.createdAt ? new Date(payload.createdAt) : (existing?.createdAt ?? now),
		updatedAt: now,
	}
}

async function getUsersState() {
	return db.select(userSelection).from(labUsers).orderBy(desc(labUsers.updatedAt)).execute()
}

async function getProjectsState() {
	return db
		.select({
			...projectSelection,
			ownerName: labUsers.name,
			ownerEmail: labUsers.email,
		})
		.from(labProjects)
		.innerJoin(labUsers, eq(labProjects.ownerId, labUsers.id))
		.orderBy(desc(labProjects.updatedAt), asc(labProjects.id))
		.execute()
}

async function getTasksState() {
	return db
		.select({
			...taskSelection,
			projectTitle: labProjects.title,
			assigneeName: labUsers.name,
		})
		.from(labTasks)
		.innerJoin(labProjects, eq(labTasks.projectId, labProjects.id))
		.innerJoin(labUsers, eq(labTasks.assigneeId, labUsers.id))
		.orderBy(desc(labTasks.updatedAt), asc(labTasks.id))
		.execute()
}

async function getSnapshotsState() {
	return db
		.select({
			...snapshotSelection,
			projectTitle: labProjects.title,
			assigneeName: labUsers.name,
		})
		.from(labTaskSnapshots)
		.innerJoin(labProjects, eq(labTaskSnapshots.projectId, labProjects.id))
		.innerJoin(labUsers, eq(labTaskSnapshots.assigneeId, labUsers.id))
		.orderBy(desc(labTaskSnapshots.updatedAt), desc(labTaskSnapshots.id))
		.limit(12)
		.execute()
}

async function getMigrationHistory() {
	return db.all(
		sql.raw(`
    SELECT hash, name, status, started_at, finished_at, error, owner_id, statements_total, statements_applied
    FROM \`${LAB_MIGRATIONS_TABLE}\`
    ORDER BY started_at DESC, name DESC
    LIMIT 20
  `)
	)
}

async function getMigrationLockRows() {
	return db.all(
		sql.raw(`
    SELECT lock_key, owner_id, acquired_at, heartbeat_at, expires_at
    FROM \`${LAB_MIGRATIONS_LOCK_TABLE}\`
    ORDER BY heartbeat_at DESC
    LIMIT 5
  `)
	)
}

export async function ensureDemoData() {
	await ensureSchema()
	const [totalUsers, totalProjects, totalTasks, totalCopies] = await Promise.all([
		db.$count(labUsers),
		db.$count(labProjects),
		db.$count(labTasks),
		db.$count(labTaskSnapshots),
	])

	if (Number(totalUsers) === 0 || Number(totalProjects) === 0 || Number(totalTasks) === 0) {
		await seedTutorialData()
		return
	}

	if (Number(totalCopies) === 0) {
		await db.insert(labTaskSnapshots).values(tutorialSnapshots).execute()
	}
}

export async function getStateSnapshot() {
	await ensureSchema()

	const [
		users,
		projects,
		tasks,
		taskSnapshots,
		totalUsers,
		totalProjects,
		totalTasks,
		todoTasks,
		blockedTasks,
		doneTasks,
		totalSnapshots,
		migrationHistory,
		migrationLocks,
	] = await Promise.all([
		getUsersState(),
		getProjectsState(),
		getTasksState(),
		getSnapshotsState(),
		db.$count(labUsers),
		db.$count(labProjects),
		db.$count(labTasks),
		db.$count(labTasks, eq(labTasks.status, 'todo')),
		db.$count(labTasks, eq(labTasks.status, 'blocked')),
		db.$count(labTasks, eq(labTasks.status, 'done')),
		db.$count(labTaskSnapshots),
		getMigrationHistory(),
		getMigrationLockRows(),
	])

	return {
		connectionString,
		counts: {
			users: Number(totalUsers),
			projects: Number(totalProjects),
			tasks: Number(totalTasks),
			todoTasks: Number(todoTasks),
			blockedTasks: Number(blockedTasks),
			doneTasks: Number(doneTasks),
			snapshots: Number(totalSnapshots),
		},
		users,
		projects,
		tasks,
		taskSnapshots,
		migrations: {
			history: migrationHistory,
			locks: migrationLocks,
		},
		schemaSql: {
			create: getCreateSchemaStatements(),
			migration: getMigrationStatements(),
			service: getServiceStatements(),
			advanced: getAdvancedDdlStatements(),
			runtimeDdl: getRuntimeDdlPreviewStatements(),
			recreate: getRecreateSchemaStatements(),
		},
		recentQueries: getRecentQueries(),
	}
}

export async function recreateLabSchema() {
	await recreateSchema()
	return { recreated: true }
}

export async function seedTutorialData() {
	await recreateSchema()

	await db.transaction(
		async (tx) => {
			await tx.insert(labUsers).values(tutorialUsers).execute()
			await tx.insert(labProjects).values(tutorialProjects).execute()
			await tx.insert(labTasks).values(tutorialTasks).execute()
			await tx.insert(labTaskSnapshots).values(tutorialSnapshots).execute()
		},
		{
			accessMode: 'read write',
			isolationLevel: 'serializableReadWrite',
			idempotent: true,
		}
	)

	return {
		users: tutorialUsers.length,
		projects: tutorialProjects.length,
		tasks: tutorialTasks.length,
		taskSnapshots: tutorialSnapshots.length,
	}
}

export async function insertUser(payload: any) {
	await ensureSchema()
	const record = buildUserRecord({
		...payload,
		id: payload.id || (await nextId(labUsers, labUsers.id)),
	})
	const rows: any = await db.insert(labUsers).values(record).returning(userSelection).execute()
	return { row: rows[0] }
}

export async function insertUserWithConflictUpdate(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id, await nextId(labUsers, labUsers.id))
	const existing = await getUserById(id)
	const record = buildUserRecord({ ...payload, id }, existing)
	const rows: any = await db
		.insert(labUsers)
		.values(record)
		.onDuplicateKeyUpdate({
			set: {
				email: record.email,
				name: record.name,
				role: record.role,
				status: record.status,
				updatedAt: record.updatedAt,
			},
		})
		.returning(userSelection)
		.execute()

	return { row: rows[0] }
}

export async function upsertUser(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id, await nextId(labUsers, labUsers.id))
	const existing = await getUserById(id)
	const record = buildUserRecord({ ...payload, id }, existing)
	const rows: any = await db.upsert(labUsers).values(record).returning(userSelection).execute()
	return { row: rows[0] }
}

export async function replaceUser(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id, await nextId(labUsers, labUsers.id))
	const existing = await getUserById(id)
	const record = buildUserRecord({ ...payload, id }, existing)
	await db.replace(labUsers).values(record).execute()
	return { row: await getUserById(id) }
}

export async function updateUser(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id)
	const existing = await assertUserExists(id)
	const rows: any = await db
		.update(labUsers)
		.set(buildUserRecord(payload, existing))
		.where(eq(labUsers.id, id))
		.returning(userSelection)
		.execute()

	return { row: rows[0] }
}

export async function getPreparedUser(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id)
	return { row: await getUserById(id) }
}

export async function deleteUser(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id)
	const [ownedProjects, assignedTasks] = await Promise.all([
		db.$count(labProjects, eq(labProjects.ownerId, id)),
		db.$count(labTasks, eq(labTasks.assigneeId, id)),
	])

	if (Number(ownedProjects) > 0 || Number(assignedTasks) > 0) {
		throw new Error(
			`User ${id} is still referenced by projects or tasks. Reassign related rows first.`
		)
	}

	const rows: any = await db
		.delete(labUsers)
		.where(eq(labUsers.id, id))
		.returning(userSelection)
		.execute()
	return { row: rows[0] ?? null }
}

export async function insertProject(payload: any) {
	await ensureSchema()
	const record = await buildProjectRecord({
		...payload,
		id: payload.id || (await nextId(labProjects, labProjects.id)),
	})
	const rows: any = await db
		.insert(labProjects)
		.values(record)
		.returning(projectSelection)
		.execute()
	return { row: rows[0] }
}

export async function upsertProject(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id, await nextId(labProjects, labProjects.id))
	const existing = await getProjectById(id)
	const record = await buildProjectRecord({ ...payload, id }, existing)
	const rows: any = await db
		.upsert(labProjects)
		.values(record)
		.returning(projectSelection)
		.execute()
	return { row: rows[0] }
}

export async function replaceProject(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id, await nextId(labProjects, labProjects.id))
	const existing = await getProjectById(id)
	const record = await buildProjectRecord({ ...payload, id }, existing)
	await db.replace(labProjects).values(record).execute()
	return { row: await getProjectById(id) }
}

export async function updateProject(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id)
	const existing = await assertProjectExists(id)
	const rows: any = await db
		.update(labProjects)
		.set(await buildProjectRecord(payload, existing))
		.where(eq(labProjects.id, id))
		.returning(projectSelection)
		.execute()

	return { row: rows[0] }
}

export async function getPreparedProject(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id)
	return { row: await getProjectById(id) }
}

export async function deleteProject(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id)
	const existing = await assertProjectExists(id)

	await db.transaction(
		async (tx) => {
			await tx.delete(labTaskSnapshots).where(eq(labTaskSnapshots.projectId, id)).execute()
			await tx.delete(labTasks).where(eq(labTasks.projectId, id)).execute()
			await tx.delete(labProjects).where(eq(labProjects.id, id)).execute()
		},
		{
			accessMode: 'read write',
			isolationLevel: 'serializableReadWrite',
			idempotent: true,
		}
	)

	return { row: existing, cascaded: ['adapter_lab_task_copies', 'adapter_lab_tasks'] }
}

export async function insertTask(payload: any) {
	await ensureSchema()
	const record = await buildTaskRecord({
		...payload,
		id: payload.id || (await nextId(labTasks, labTasks.id)),
	})
	const rows: any = await db.insert(labTasks).values(record).returning(taskSelection).execute()
	return { row: rows[0] }
}

export async function insertTaskWithConflictUpdate(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id, await nextId(labTasks, labTasks.id))
	const existing = await getTaskById(id)
	const record = await buildTaskRecord({ ...payload, id }, existing)
	const rows: any = await db
		.insert(labTasks)
		.values(record)
		.onDuplicateKeyUpdate({
			set: {
				projectId: record.projectId,
				assigneeId: record.assigneeId,
				title: record.title,
				status: record.status,
				priority: record.priority,
				estimateHours: record.estimateHours,
				updatedAt: record.updatedAt,
			},
		})
		.returning(taskSelection)
		.execute()

	return { row: rows[0] }
}

export async function upsertTask(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id, await nextId(labTasks, labTasks.id))
	const existing = await getTaskById(id)
	const record = await buildTaskRecord({ ...payload, id }, existing)
	const rows: any = await db.upsert(labTasks).values(record).returning(taskSelection).execute()
	return { row: rows[0] }
}

export async function replaceTask(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id, await nextId(labTasks, labTasks.id))
	const existing = await getTaskById(id)
	const record = await buildTaskRecord({ ...payload, id }, existing)
	await db.replace(labTasks).values(record).execute()
	return { row: await getTaskById(id) }
}

export async function updateTask(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id)
	const existing = await assertTaskExists(id)
	const rows: any = await db
		.update(labTasks)
		.set(await buildTaskRecord(payload, existing))
		.where(eq(labTasks.id, id))
		.returning(taskSelection)
		.execute()

	return { row: rows[0] }
}

export async function getPreparedTask(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id)
	return { row: await getTaskById(id) }
}

export async function deleteTask(payload: any) {
	await ensureSchema()
	const id = normalizeInt(payload.id)
	const existing = await assertTaskExists(id)

	await db.transaction(
		async (tx) => {
			await tx.delete(labTaskSnapshots).where(eq(labTaskSnapshots.id, id)).execute()
			await tx.delete(labTasks).where(eq(labTasks.id, id)).execute()
		},
		{
			accessMode: 'read write',
			isolationLevel: 'serializableReadWrite',
			idempotent: true,
		}
	)

	return { row: existing, cascaded: ['adapter_lab_task_copies'] }
}

export async function batchUpdateTasks(payload: any) {
	await ensureSchema()
	const fromStatus = normalizeText(payload.fromStatus, 'blocked')
	const toStatus = normalizeText(payload.toStatus, 'review')

	await db
		.batchUpdate(labTasks)
		.set({
			status: toStatus,
			updatedAt: new Date(),
		})
		.where(eq(labTasks.status, fromStatus))
		.execute()

	const rows: any = await db
		.select(taskSelection)
		.from(labTasks)
		.where(eq(labTasks.status, toStatus))
		.orderBy(desc(labTasks.updatedAt))
		.execute()

	return { rows, fromStatus, toStatus }
}

export async function batchDeleteTasks(payload: any) {
	await ensureSchema()
	const status = normalizeText(payload.status, 'done')
	await db.batchDelete(labTasks).where(eq(labTasks.status, status)).execute()
	return { deletedStatus: status, remainingTasks: Number(await db.$count(labTasks)) }
}

export async function runCountOverview() {
	await ensureSchema()
	return {
		totals: {
			users: Number(await db.$count(labUsers)),
			projects: Number(await db.$count(labProjects)),
			tasks: Number(await db.$count(labTasks)),
			todoTasks: Number(await db.$count(labTasks, eq(labTasks.status, 'todo'))),
			blockedTasks: Number(await db.$count(labTasks, eq(labTasks.status, 'blocked'))),
			snapshots: Number(await db.$count(labTaskSnapshots)),
		},
	}
}

export async function runRelationsOverview() {
	await ensureSchema()

	const rows = await db.query.labProjects.findMany({
		columns: {
			id: true,
			slug: true,
			title: true,
			status: true,
			budget: true,
		},
		orderBy: (projects, { asc }) => [asc(projects.id)],
		with: {
			owner: {
				columns: {
					id: true,
					name: true,
					email: true,
				},
			},
			tasks: {
				columns: {
					id: true,
					title: true,
					status: true,
					priority: true,
					estimateHours: true,
				},
				orderBy: (tasks, { asc }) => [asc(tasks.id)],
				with: {
					assignee: {
						columns: {
							id: true,
							name: true,
							role: true,
						},
					},
				},
			},
		},
	})

	return { rows }
}

export async function runJoinOverview() {
	await ensureSchema()

	const query = db
		.select({
			projectId: labProjects.id,
			projectTitle: labProjects.title,
			ownerName: labUsers.name,
			projectStatus: labProjects.status,
			taskId: labTasks.id,
			taskTitle: labTasks.title,
			taskStatus: labTasks.status,
			estimateHours: labTasks.estimateHours,
		})
		.from(labProjects)
		.innerJoin(labUsers, eq(labProjects.ownerId, labUsers.id))
		.leftJoin(labTasks, eq(labTasks.projectId, labProjects.id))
		.orderBy(asc(labProjects.id), asc(labTasks.id))

	return {
		sqlPreview: query.toSQL(),
		rows: await query.execute(),
	}
}

export async function runCteProjectLoad() {
	await ensureSchema()

	const taskBacklog = db.$with('task_backlog').as(
		db
			.select({
				projectId: labTasks.projectId,
				taskId: labTasks.id,
				taskTitle: labTasks.title,
				taskStatus: labTasks.status,
			})
			.from(labTasks)
			.where(eq(labTasks.status, 'todo'))
	)

	const query = db
		.with(taskBacklog)
		.select({
			backlogTaskId: (taskBacklog as any).taskId,
			projectId: (taskBacklog as any).projectId,
			backlogTaskTitle: (taskBacklog as any).taskTitle,
			backlogTaskStatus: (taskBacklog as any).taskStatus,
		})
		.from(taskBacklog)
		.orderBy(asc((taskBacklog as any).projectId), asc((taskBacklog as any).taskId))

	return {
		sqlPreview: query.toSQL(),
		rows: await query.execute(),
	}
}

export async function runSetOperatorsOverview() {
	await ensureSchema()

	const owners = db.selectDistinct({ userId: labProjects.ownerId }).from(labProjects)
	const assignees = db.selectDistinct({ userId: labTasks.assigneeId }).from(labTasks)

	return {
		union: await owners.union(assignees).execute(),
		intersect: await owners.intersect(assignees).execute(),
		except: await owners.except(assignees).execute(),
	}
}

export async function runDistinctOverview() {
	await ensureSchema()

	const distinctStatuses = db
		.select({
			status: labTasks.status,
		})
		.from(labTasks)
		.distinct()
		.orderBy(asc(labTasks.status))

	const statuses = await db
		.selectDistinct({ status: labTasks.status })
		.from(labTasks)
		.orderBy(asc(labTasks.status))
		.execute()

	const newestProjectPerOwner = await db
		.selectDistinctOn([labProjects.ownerId], {
			ownerId: labProjects.ownerId,
			projectId: labProjects.id,
			title: labProjects.title,
			updatedAt: labProjects.updatedAt,
		})
		.from(labProjects)
		.orderBy(asc(labProjects.ownerId), desc(labProjects.updatedAt))
		.execute()

	return {
		sqlPreview: [createSqlPreview('distinct()', distinctStatuses.toSQL())],
		distinctStatuses: await distinctStatuses.execute(),
		statuses,
		newestProjectPerOwner,
	}
}

export async function runSelectClausesOverview() {
	await ensureSchema()

	const groupedQuery = db
		.select({
			status: labTasks.status,
			total: sql`count(*)`,
			totalEstimate: sql`sum(${labTasks.estimateHours})`,
		})
		.from(labTasks)
		.where(sql`${labTasks.estimateHours} >= 5`)
		.groupBy(labTasks.status)
		.having(sql`count(*) >= 1`)
		.orderBy(asc(labTasks.status))

	const pagedQuery = db
		.select({
			id: labTasks.id,
			title: labTasks.title,
			status: labTasks.status,
		})
		.from(labTasks)
		.orderBy(asc(labTasks.id))
		.limit(2)
		.offset(1)

	return {
		sqlPreview: [
			createSqlPreview('where() + groupBy() + having() + orderBy()', groupedQuery.toSQL()),
			createSqlPreview('orderBy() + limit() + offset()', pagedQuery.toSQL()),
		],
		groupedRows: await groupedQuery.execute(),
		pagedRows: await pagedQuery.execute(),
	}
}

export async function runFromValuesBuilder() {
	await ensureSchema()

	const query = db
		.select({
			lane: sql`lanes.lane`,
			weight: sql`lanes.weight`,
		})
		.fromValues(
			[
				{ lane: 'backlog', weight: 1 },
				{ lane: 'active', weight: 2 },
				{ lane: 'done', weight: 3 },
			],
			{
				alias: 'lanes',
				columns: ['lane', 'weight'],
			}
		)

	return {
		sqlPreview: query.toSQL(),
		rows: await query.execute(),
	}
}

export async function runValuesTableOverview() {
	await ensureSchema()

	const priorities = valuesTable(
		[
			{ priority: 'high', band: 'P1', rank: 3 },
			{ priority: 'medium', band: 'P2', rank: 2 },
			{ priority: 'low', band: 'P3', rank: 1 },
		],
		{
			alias: 'priority_map',
			columns: ['priority', 'band', 'rank'],
		}
	)

	const query = db
		.select({
			taskId: labTasks.id,
			title: labTasks.title,
			priority: labTasks.priority,
			band: sql`priority_map.band`,
			rank: sql`priority_map.rank`,
		})
		.from(labTasks)
		.leftJoin(priorities, sql`${labTasks.priority} = priority_map.priority`)
		.orderBy(desc(sql`priority_map.rank`), asc(labTasks.id))

	return {
		sqlPreview: query.toSQL(),
		rows: await query.execute(),
	}
}

export async function runWindowOverview() {
	await ensureSchema()

	const query = db
		.select({
			projectId: labTasks.projectId,
			taskId: labTasks.id,
			title: labTasks.title,
			estimateHours: labTasks.estimateHours,
			rankInProject: sql`row_number() over task_rank_window`,
		})
		.from(labTasks)
		.window(
			'task_rank_window',
			windowDefinition({
				partitionBy: [labTasks.projectId],
				orderBy: [desc(labTasks.estimateHours), asc(labTasks.id)],
			})
		)
		.orderBy(asc(labTasks.projectId), desc(labTasks.estimateHours), asc(labTasks.id))

	return {
		sqlPreview: query.toSQL(),
		rows: await query.execute(),
	}
}

export async function runFindFirstProjectOverview() {
	await ensureSchema()

	const row = await db.query.labProjects.findFirst({
		columns: {
			id: true,
			slug: true,
			title: true,
			status: true,
			budget: true,
		},
		orderBy: (projects, { desc }) => [desc(projects.updatedAt)],
		with: {
			owner: {
				columns: {
					id: true,
					name: true,
					email: true,
				},
			},
			tasks: {
				columns: {
					id: true,
					title: true,
					status: true,
				},
				orderBy: (tasks, { asc }) => [asc(tasks.id)],
			},
		},
	})

	return { row }
}

export async function runPreparedReadsOverview() {
	await ensureSchema()

	const allBuilder = db
		.select({
			id: labTasks.id,
			title: labTasks.title,
			status: labTasks.status,
		})
		.from(labTasks)
		.orderBy(asc(labTasks.id))
		.limit(3)

	const getBuilder = db
		.select({
			id: labTasks.id,
			title: labTasks.title,
		})
		.from(labTasks)
		.orderBy(asc(labTasks.id))
		.limit(1)

	const valuesBuilder = db
		.select({
			id: labUsers.id,
			email: labUsers.email,
		})
		.from(labUsers)
		.orderBy(asc(labUsers.id))
		.limit(3)

	const preparedAll = allBuilder.prepare('prepared_tasks_all')
	const preparedGet = getBuilder.prepare('prepared_tasks_get')
	const preparedValues = valuesBuilder.prepare('prepared_users_values')
	const executedRows = await preparedAll.execute()

	return {
		sqlPreview: [
			createSqlPreview('prepare().all()', allBuilder.toSQL()),
			createSqlPreview('prepare().get()', getBuilder.toSQL()),
			createSqlPreview('prepare().values()', valuesBuilder.toSQL()),
		],
		preparedMeta: {
			getQuery: preparedAll.getQuery(),
			isResponseInArrayMode: preparedAll.isResponseInArrayMode(),
			mappedRows: preparedAll.mapResult(executedRows),
		},
		executedRows,
		allRows: await preparedAll.all(),
		firstRow: await preparedGet.get(),
		valueRows: await preparedValues.values(),
	}
}

export async function runAdvancedJoinModes() {
	await ensureSchema()

	const leftSemiQuery = db
		.select({
			id: labUsers.id,
			name: labUsers.name,
		})
		.from(labUsers)
		.leftSemiJoin(labProjects, eq(labProjects.ownerId, labUsers.id))
		.orderBy(asc(labUsers.id))

	const leftOnlyQuery = db
		.select({
			id: labUsers.id,
			name: labUsers.name,
		})
		.from(labUsers)
		.leftOnlyJoin(labProjects, eq(labProjects.ownerId, labUsers.id))
		.orderBy(asc(labUsers.id))

	const rightSemiQuery = db
		.select({
			projectId: labProjects.id,
			title: labProjects.title,
		})
		.from(labUsers)
		.rightSemiJoin(labProjects, eq(labProjects.ownerId, labUsers.id))
		.orderBy(asc(labProjects.id))

	const rightOnlyQuery = db
		.select({
			projectId: labProjects.id,
			title: labProjects.title,
		})
		.from(labUsers)
		.rightOnlyJoin(labProjects, eq(labProjects.ownerId, labUsers.id))
		.orderBy(asc(labProjects.id))

	const exclusionQuery = db
		.select({
			userId: labUsers.id,
			name: labUsers.name,
			projectId: labProjects.id,
		})
		.from(labUsers)
		.exclusionJoin(labProjects, eq(labProjects.ownerId, labUsers.id))
		.orderBy(asc(labUsers.id), asc(labProjects.id))

	const crossQuery = db
		.select({
			userId: labUsers.id,
			projectId: labProjects.id,
		})
		.from(labUsers)
		.crossJoin(labProjects)
		.limit(6)

	return {
		sqlPreview: [
			createSqlPreview('leftSemiJoin()', leftSemiQuery.toSQL()),
			createSqlPreview('leftOnlyJoin()', leftOnlyQuery.toSQL()),
			createSqlPreview('rightSemiJoin()', rightSemiQuery.toSQL()),
			createSqlPreview('rightOnlyJoin()', rightOnlyQuery.toSQL()),
			createSqlPreview('exclusionJoin()', exclusionQuery.toSQL()),
			createSqlPreview('crossJoin()', crossQuery.toSQL()),
		],
		leftSemiRows: await leftSemiQuery.execute(),
		leftOnlyRows: await leftOnlyQuery.execute(),
		rightSemiRows: await rightSemiQuery.execute(),
		rightOnlyRows: await rightOnlyQuery.execute(),
		exclusionRows: await exclusionQuery.execute(),
		crossRows: await crossQuery.execute(),
	}
}

export async function runUnionAllOverview() {
	await ensureSchema()

	const owners = db
		.select({
			userId: labProjects.ownerId,
			source: sql`CAST('project_owner' AS Utf8)`,
		})
		.from(labProjects)

	const assignees = db
		.select({
			userId: labTasks.assigneeId,
			source: sql`CAST('task_assignee' AS Utf8)`,
		})
		.from(labTasks)

	const query = owners.unionAll(assignees)

	return {
		sqlPreview: query.toSQL(),
		rows: await query.execute(),
	}
}

export async function runGroupCompactOverview() {
	await ensureSchema()

	const compactQuery = db
		.select({
			status: labTasks.status,
			total: sql`count(*)`,
		})
		.from(labTasks)
		.groupCompactBy(labTasks.status)
		.orderBy(asc(labTasks.status))

	const assumeOrderQuery = db
		.select({
			id: labTasks.id,
			title: labTasks.title,
		})
		.from(labTasks)
		.assumeOrderBy(labTasks.updatedAt)
		.limit(4)

	return {
		sqlPreview: [
			createSqlPreview('groupCompactBy()', compactQuery.toSQL()),
			createSqlPreview('assumeOrderBy()', assumeOrderQuery.toSQL()),
		],
		groupedRows: await compactQuery.execute(),
		assumedRows: await assumeOrderQuery.execute(),
	}
}

export async function runYdbSpecificSelectPreview() {
	await ensureSchema()

	const withoutQuery = db.select().from(labUsers).without(labUsers.updatedAt).limit(3)

	const sampleQuery = db
		.select({
			id: labTasks.id,
			title: labTasks.title,
		})
		.from(labTasks)
		.sample(0.5)
		.limit(3)

	const tableSampleQuery = db
		.select({
			id: labTasks.id,
			title: labTasks.title,
		})
		.from(labTasks)
		.tableSample('bernoulli', 50, 42)
		.limit(3)

	const uniqueDistinctQuery = db
		.select()
		.from(labUsers)
		.uniqueDistinct(uniqueHint('id'), distinctHint('email'))
		.limit(3)

	const fromAsTableQuery = db
		.select({
			id: sql`r.id`,
			title: sql`r.title`,
		})
		.from(asTable('$rows', 'r'))

	const intoResultQuery = db
		.select({
			id: labUsers.id,
			email: labUsers.email,
		})
		.from(labUsers)
		.limit(2)
		.intoResult('users_result')

	return createPreviewOnlyResult({
		note: 'Эти YDB-specific SELECT helpers показаны как preview-only: локальная YDB в этом окружении либо ломает маппинг whole-source select, либо не принимает исполнение таких запросов стабильно.',
		sqlPreview: [
			createSqlPreview('without()', withoutQuery.toSQL()),
			createSqlPreview('sample()', sampleQuery.toSQL()),
			createSqlPreview('tableSample()', tableSampleQuery.toSQL()),
			createSqlPreview('uniqueDistinct()', uniqueDistinctQuery.toSQL()),
			createSqlPreview('fromAsTable()', fromAsTableQuery.toSQL()),
			createSqlPreview('intoResult()', intoResultQuery.toSQL()),
		],
	})
}

export async function runRenderingOverview() {
	await ensureSchema()

	const standaloneQuery = db
		.select({
			id: labUsers.id,
			email: labUsers.email,
			status: labUsers.status,
		})
		.from(labUsers)
		.where(eq(labUsers.status, 'active'))
		.orderBy(asc(labUsers.id))
		.limit(2)

	const standaloneCte = db.$with('active_users').as(
		db
			.select({
				id: labUsers.id,
				email: labUsers.email,
			})
			.from(labUsers)
			.where(eq(labUsers.status, 'active'))
	)

	const cteQuery = db
		.with(standaloneCte)
		.select({
			id: (standaloneCte as any).id,
			email: (standaloneCte as any).email,
		})
		.from(standaloneCte)
		.orderBy(asc((standaloneCte as any).id))

	const left = db.select({ id: labUsers.id }).from(labUsers)
	const right = db.select({ id: labTasks.assigneeId }).from(labTasks)

	return createPreviewOnlyResult({
		note: 'Этот блок покрывает rendering API через публичный database builder. Он нужен для unit-style проверки SQL и отдельных фрагментов, не требуя live execution.',
		sqlPreview: [
			createSqlPreview('db.select() + toSQL()', standaloneQuery.toSQL()),
			createSqlPreview('$with() + with() via db builder', cteQuery.toSQL()),
			createSqlPreview(
				'addSetOperators()',
				left
					.addSetOperators([{ type: 'union', rightSelect: right, isAll: false } as any])
					.toSQL()
			),
		],
		selectedFields: Object.keys(standaloneQuery.getSelectedFields()),
		getSqlShape: {
			queryChunks: (standaloneQuery.getSQL() as any).queryChunks.length,
			usedTables: (standaloneQuery.getSQL() as any).usedTables.length,
		},
	})
}

export async function runSelectSyntaxPreview() {
	await ensureSchema()

	const flattenQuery = db
		.select({
			item: sql`ev.item`,
		})
		.fromAsTable('$event_rows', 'ev')
		.flattenBy(sql`ev.items`)

	const flattenListQuery = db
		.select({
			item: sql`ev.item`,
		})
		.fromAsTable('$event_rows', 'ev')
		.flattenListBy(sql`ev.items`)

	const flattenDictQuery = db
		.select({
			pair: sql`ev.attr`,
		})
		.fromAsTable('$event_rows', 'ev')
		.flattenDictBy(sql`ev.attrs`)

	const flattenOptionalQuery = db
		.select({
			maybeItem: sql`ev.maybe_item`,
		})
		.fromAsTable('$event_rows', 'ev')
		.flattenOptionalBy(sql`ev.maybe_item`)

	const flattenColumnsQuery = db
		.select({
			row: sql`ev`,
		})
		.fromAsTable('$event_rows', 'ev')
		.flattenColumns()

	const matchRecognizeQuery = db
		.select({
			userId: sql`ev.user_id`,
			createdAt: sql`ev.created_at`,
		})
		.fromAsTable('$event_rows', 'ev')
		.matchRecognize(
			matchRecognize({
				partitionBy: [sql`ev.user_id`],
				orderBy: [sql`ev.created_at`],
				pattern: '(A B+)',
				define: {
					A: sql`ev.kind = "start"`,
					B: sql`ev.kind = "step"`,
				},
			})
		)

	return createPreviewOnlyResult({
		note: 'flatten* и matchRecognize показаны как preview-only. Адаптер корректно рендерит YQL, но для живого запуска этим helpers нужен отдельный событийный dataset со списками, словарями и pattern-stream данными.',
		sqlPreview: [
			createSqlPreview('flattenBy()', flattenQuery.toSQL()),
			createSqlPreview('flattenListBy()', flattenListQuery.toSQL()),
			createSqlPreview('flattenDictBy()', flattenDictQuery.toSQL()),
			createSqlPreview('flattenOptionalBy()', flattenOptionalQuery.toSQL()),
			createSqlPreview('flattenColumns()', flattenColumnsQuery.toSQL()),
			createSqlPreview('matchRecognize()', matchRecognizeQuery.toSQL()),
		],
	})
}

export async function runSourceHelpersPreview() {
	await ensureSchema()

	const valuesQuery = db
		.select({
			id: sql`v.id`,
			name: sql`v.name`,
		})
		.from(
			sql`${values([
				{ id: 1, name: 'Ada' },
				{ id: 2, name: 'Grace' },
			])} AS v`
		)

	const asTableQuery = db
		.select({
			id: sql`r.id`,
			title: sql`r.title`,
		})
		.from(asTable('$rows', 'r'))

	return createPreviewOnlyResult({
		note: 'Source helpers values() и asTable() показаны как preview-only builders. valuesTable() и fromValues() в приложении есть отдельно как live-сценарии.',
		sqlPreview: [
			createSqlPreview('values()', valuesQuery.toSQL()),
			createSqlPreview('asTable()', asTableQuery.toSQL()),
		],
	})
}

export async function runJoinBuildersPreview() {
	await ensureSchema()

	const rightJoinQuery = db
		.select({
			projectId: labProjects.id,
			ownerName: labUsers.name,
		})
		.from(labProjects)
		.rightJoin(labUsers, eq(labProjects.ownerId, labUsers.id))

	const fullJoinQuery = db
		.select({
			projectId: labProjects.id,
			ownerName: labUsers.name,
		})
		.from(labProjects)
		.fullJoin(labUsers, eq(labProjects.ownerId, labUsers.id))

	return createPreviewOnlyResult({
		note: 'rightJoin() и fullJoin() показаны отдельным preview, чтобы все join builders были кликабельны из интерфейса без перегрузки основного live-сценария.',
		sqlPreview: [
			createSqlPreview('rightJoin()', rightJoinQuery.toSQL()),
			createSqlPreview('fullJoin()', fullJoinQuery.toSQL()),
		],
	})
}

export async function runGroupingPreview() {
	await ensureSchema()

	const rollupQuery = db
		.select({
			projectId: labTasks.projectId,
			status: labTasks.status,
			total: sql`count(*)`,
		})
		.from(labTasks)
		.groupBy(rollup(labTasks.projectId, labTasks.status))
		.orderBy(asc(labTasks.projectId), asc(labTasks.status))

	const groupingSetsQuery = db
		.select({
			projectId: labTasks.projectId,
			status: labTasks.status,
			total: sql`count(*)`,
			projectKey: groupKey(labTasks.projectId, 'project_key'),
			groupingStatus: grouping(labTasks.status),
		})
		.from(labTasks)
		.groupBy(groupingSets([labTasks.projectId, labTasks.status], [labTasks.projectId], []))
		.orderBy(asc(labTasks.projectId), asc(labTasks.status))

	const cubeQuery = db
		.select({
			projectId: labTasks.projectId,
			status: labTasks.status,
			total: sql`count(*)`,
		})
		.from(labTasks)
		.groupBy(cube(labTasks.projectId, labTasks.status))
		.orderBy(asc(labTasks.projectId), asc(labTasks.status))

	return createPreviewOnlyResult({
		note: 'ROLLUP / GROUPING SETS корректно рендерятся адаптером, но текущая локальная YDB не исполняет такие запросы на этой схеме без ошибок корреляции. Поэтому здесь это builder-preview.',
		sqlPreview: [
			createSqlPreview('rollup()', rollupQuery.toSQL()),
			createSqlPreview('groupingSets() + groupKey() + grouping()', groupingSetsQuery.toSQL()),
			createSqlPreview('cube()', cubeQuery.toSQL()),
		],
	})
}

export async function runTimeWindowPreview() {
	await ensureSchema()

	const sessionWindowQuery = db
		.select({
			bucket: sessionWindow(sql`ev.created_at`, 'PT30M'),
			startedAt: sessionStart(),
			total: sql`count(*)`,
		})
		.fromAsTable('$event_rows', 'ev')
		.groupBy(sessionWindow(sql`ev.created_at`, 'PT30M'))

	const hopQuery = db
		.select({
			bucket: hop(sql`ev.created_at`, 'PT1M', 'PT5M', 'PT0S'),
			hopStartedAt: hopStart(),
			hopFinishedAt: hopEnd(),
			total: sql`count(*)`,
		})
		.fromAsTable('$event_rows', 'ev')
		.groupBy(hop(sql`ev.created_at`, 'PT1M', 'PT5M', 'PT0S'))

	return createPreviewOnlyResult({
		note: 'sessionWindow()/hop() и связанные helpers показаны как preview-only. Адаптер рендерит их корректно, но текущая локальная YDB не дает стабильный live-run на нашей учебной схеме.',
		sqlPreview: [
			createSqlPreview('sessionWindow() + sessionStart()', sessionWindowQuery.toSQL()),
			createSqlPreview('hop() + hopStart() + hopEnd()', hopQuery.toSQL()),
		],
	})
}

export async function runKnnPreview() {
	await ensureSchema()

	const cosineDistanceQuery = db
		.select({
			score: knnCosineDistance(sql`items.embedding`, sql`$target`),
		})
		.fromAsTable('$items', 'items')

	const euclideanDistanceQuery = db
		.select({
			score: knnEuclideanDistance(sql`items.embedding`, sql`$target`),
		})
		.fromAsTable('$items', 'items')

	const manhattanDistanceQuery = db
		.select({
			score: knnManhattanDistance(sql`items.embedding`, sql`$target`),
		})
		.fromAsTable('$items', 'items')

	const cosineSimilarityQuery = db
		.select({
			score: knnCosineSimilarity(sql`items.embedding`, sql`$target`),
		})
		.fromAsTable('$items', 'items')

	const innerProductQuery = db
		.select({
			score: knnInnerProductSimilarity(sql`items.embedding`, sql`$target`),
		})
		.fromAsTable('$items', 'items')

	const genericDistanceQuery = db
		.select({
			score: knnDistance('CosineDistance', sql`items.embedding`, sql`$target`),
		})
		.fromAsTable('$items', 'items')

	const genericSimilarityQuery = db
		.select({
			score: knnSimilarity('InnerProductSimilarity', sql`items.embedding`, sql`$target`),
		})
		.fromAsTable('$items', 'items')

	return createPreviewOnlyResult({
		note: 'KNN helpers показаны как preview-only. Для live execution нужен отдельный vector dataset, но адаптер уже на этом экране рендерит финальный YQL для каждой функции.',
		sqlPreview: [
			createSqlPreview('knnCosineDistance()', cosineDistanceQuery.toSQL()),
			createSqlPreview('knnEuclideanDistance()', euclideanDistanceQuery.toSQL()),
			createSqlPreview('knnManhattanDistance()', manhattanDistanceQuery.toSQL()),
			createSqlPreview('knnCosineSimilarity()', cosineSimilarityQuery.toSQL()),
			createSqlPreview('knnInnerProductSimilarity()', innerProductQuery.toSQL()),
			createSqlPreview('knnDistance()', genericDistanceQuery.toSQL()),
			createSqlPreview('knnSimilarity()', genericSimilarityQuery.toSQL()),
		],
	})
}

export async function runAdvancedScriptPreview() {
	await ensureSchema()

	const previewScript = yqlScript(
		pragma('TablePathPrefix', '/local'),
		kMeansTreeSearchTopSize(100),
		declareParam('$userId', 'Int32'),
		doBlock([
			intoResult(sql`SELECT id, email FROM ${labUsers} WHERE id = $userId`, 'picked_user'),
			commit(),
		])
	)

	return createPreviewOnlyResult({
		note: 'declareParam(), doBlock(), intoResult() и commit() показаны как preview-only: локальная YDB в этом окружении отвечает ошибкой type annotation при live execution такого script flow.',
		sqlPreview: [
			createStatementPreview('yqlScript() advanced helpers', renderScriptText(previewScript)),
		],
	})
}

export async function runRuntimeDdlLifecycle() {
	await ensureSchema()

	const steps: Array<{ statement: string; status: 'applied' }> = []
	await executeDdlStatementsInOrder(getRuntimeDdlLifecycleStatements(), (statement) => {
		steps.push({ statement, status: 'applied' })
	})

	return {
		mode: 'live',
		sqlPreview: getRuntimeDdlLifecycleStatements().map((statement, index) =>
			createStatementPreview(`DDL step ${index + 1}`, statement)
		),
		runtimeTable: {
			active: RUNTIME_DDL_TABLE,
			archive: RUNTIME_DDL_ARCHIVE_TABLE,
		},
		steps,
	}
}

export async function runRuntimeDdlPreview() {
	await ensureSchema()

	return createPreviewOnlyResult({
		note: 'Этот блок показывает расширенный DDL toolkit адаптера. CREATE / RENAME / DROP выполняются live в отдельном сценарии, а ALTER/INDEX/CHANGEFEED/SHOW CREATE здесь отданы как безопасный preview, потому что локальная YDB принимает их неполно и нестабильно.',
		sqlPreview: getRuntimeDdlPreviewStatements().flatMap((group) =>
			group.statements.map((statement, index) =>
				createStatementPreview(
					`${group.title}${group.statements.length > 1 ? ` / ${index + 1}` : ''}`,
					statement
				)
			)
		),
	})
}

export async function runInsertSnapshotsFromSelect(payload: any) {
	await ensureSchema()
	const sourceStatus = normalizeText(payload.status, 'blocked')

	await db.transaction(
		async (tx) => {
			await tx.delete(labTaskSnapshots).execute()
			await tx
				.insert(labTaskSnapshots)
				.select(
					tx.select(taskSelection).from(labTasks).where(eq(labTasks.status, sourceStatus))
				)
				.execute()
		},
		{
			accessMode: 'read write',
			isolationLevel: 'serializableReadWrite',
			idempotent: true,
		}
	)

	return {
		sourceStatus,
		insertedRows: await db
			.select(snapshotSelection)
			.from(labTaskSnapshots)
			.orderBy(desc(labTaskSnapshots.updatedAt), desc(labTaskSnapshots.id))
			.limit(10)
			.execute(),
	}
}

export async function runRawAllTasks() {
	await ensureSchema()
	const rows = await db.all(sql`
    SELECT id, project_id, assignee_id, title, status, priority, estimate_hours
    FROM ${labTasks}
    ORDER BY updated_at DESC, id DESC
  `)
	return { rows }
}

export async function runRawGetProject(payload: any) {
	await ensureSchema()
	const id = payload.id ? normalizeInt(payload.id) : undefined
	const row = id
		? await db.get(sql`
        SELECT id, owner_id, slug, title, status, budget, created_at, updated_at
        FROM ${labProjects}
        WHERE id = ${id}
        LIMIT 1
      `)
		: await db.get(sql`
        SELECT id, owner_id, slug, title, status, budget, created_at, updated_at
        FROM ${labProjects}
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `)

	return { row }
}

export async function runRawValuesUsers() {
	await ensureSchema()
	const rows = await db.values(sql`
    SELECT id, email, role
    FROM ${labUsers}
    ORDER BY id ASC
    LIMIT 5
  `)
	return { rows }
}

export async function runTransactionCommit() {
	await ensureSchema()
	const id = await nextId(labTasks, labTasks.id)

	const row = await db.transaction(
		async (tx) => {
			await tx
				.insert(labTasks)
				.values({
					id,
					projectId: firstTutorialProject.id,
					assigneeId: firstTutorialUser.id,
					title: `Committed task ${id}`,
					status: 'tx-committed',
					priority: 'medium',
					estimateHours: 6,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.execute()

			await tx
				.insert(labTaskSnapshots)
				.values({
					id: await nextId(labTaskSnapshots, labTaskSnapshots.id),
					projectId: firstTutorialProject.id,
					assigneeId: firstTutorialUser.id,
					title: `Committed task ${id}`,
					status: 'tx-committed',
					priority: 'medium',
					estimateHours: 6,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.execute()

			return tx
				.select(taskSelection)
				.from(labTasks)
				.where(eq(labTasks.id, id))
				.prepare()
				.get()
		},
		{
			accessMode: 'read write',
			isolationLevel: 'serializableReadWrite',
			idempotent: true,
		}
	)

	return { row }
}

export async function runTransactionRollback() {
	await ensureSchema()
	const id = await nextId(labTasks, labTasks.id)
	let rolledBack = false

	try {
		await db.transaction(
			async (tx) => {
				await tx
					.insert(labTasks)
					.values({
						id,
						projectId: secondTutorialProject.id,
						assigneeId: secondTutorialUser.id,
						title: `Rolled back task ${id}`,
						status: 'tx-rollback',
						priority: 'low',
						estimateHours: 2,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.execute()

				tx.rollback()
			},
			{
				accessMode: 'read write',
				isolationLevel: 'serializableReadWrite',
				idempotent: false,
			}
		)
	} catch {
		rolledBack = true
	}

	return {
		rolledBack,
		rowAfterRollback: await getTaskById(id),
	}
}

export async function runYqlScriptAction(payload: any) {
	await ensureSchema()
	const id = payload.id ? normalizeInt(payload.id) : await nextId(labTasks, labTasks.id)
	const title = normalizeText(payload.title, `Scripted task ${id}`)
	const projectId = firstTutorialProject.id
	const assigneeId = secondTutorialUser.id
	const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

	const script: any = yqlScript(
		pragma('TablePathPrefix', '/local'),
		defineAction(
			'$upsert_lab_task',
			[],
			[
				`UPSERT INTO adapter_lab_tasks (id, project_id, assignee_id, title, status, priority, estimate_hours, created_at, updated_at) VALUES (${id}, ${projectId}, ${assigneeId}, "${escapedTitle}", "scripted", "high", 7, CurrentUtcTimestamp(), CurrentUtcTimestamp());`,
			]
		),
		doAction('$upsert_lab_task', [])
	)

	await db.execute(script)

	return {
		sqlPreview: [createStatementPreview('yqlScript()', renderScriptText(script))],
		row: await getTaskById(id),
	}
}
