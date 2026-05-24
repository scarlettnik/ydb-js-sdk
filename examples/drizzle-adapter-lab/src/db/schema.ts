import { index, integer, relations, text, timestamp, ydbTable } from '@ydbjs/drizzle-adapter'

export const labUsers = ydbTable(
	'adapter_lab_users',
	{
		id: integer('id').primaryKey(),
		email: text('email').notNull().unique('adapter_lab_users_email_unique'),
		name: text('name').notNull(),
		role: text('role').notNull(),
		status: text('status').notNull(),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull(),
	},
	(table) => [
		index('adapter_lab_users_status_idx')
			.on(table.status)
			.global()
			.sync()
			.cover(table.name, table.role),
	]
)

export const labProjects = ydbTable(
	'adapter_lab_projects',
	{
		id: integer('id').primaryKey(),
		ownerId: integer('owner_id').notNull(),
		slug: text('slug').unique('adapter_lab_projects_slug_unique'),
		title: text('title').notNull(),
		status: text('status').notNull(),
		budget: integer('budget').notNull(),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull(),
	},
	(table) => [
		index('adapter_lab_projects_owner_idx')
			.on(table.ownerId)
			.global()
			.sync()
			.cover(table.title, table.status),
		index('adapter_lab_projects_status_idx')
			.on(table.status)
			.global()
			.sync()
			.cover(table.ownerId, table.title),
	]
)

export const labTasks = ydbTable(
	'adapter_lab_tasks',
	{
		id: integer('id').primaryKey(),
		projectId: integer('project_id').notNull(),
		assigneeId: integer('assignee_id').notNull(),
		title: text('title').notNull(),
		status: text('status').notNull(),
		priority: text('priority').notNull(),
		estimateHours: integer('estimate_hours').notNull(),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull(),
	},
	(table) => [
		index('adapter_lab_tasks_project_idx')
			.on(table.projectId)
			.global()
			.sync()
			.cover(table.status, table.assigneeId, table.title),
		index('adapter_lab_tasks_assignee_idx')
			.on(table.assigneeId)
			.global()
			.sync()
			.cover(table.status, table.priority, table.projectId),
	]
)

export const labTaskSnapshots = ydbTable(
	'adapter_lab_task_copies',
	{
		id: integer('id').primaryKey(),
		projectId: integer('project_id').notNull(),
		assigneeId: integer('assignee_id').notNull(),
		title: text('title').notNull(),
		status: text('status').notNull(),
		priority: text('priority').notNull(),
		estimateHours: integer('estimate_hours').notNull(),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull(),
	},
	(table) => [
		index('adapter_lab_task_copies_project_idx')
			.on(table.projectId)
			.global()
			.sync()
			.cover(table.status, table.assigneeId, table.priority),
	]
)

export const labUsersRelations = relations(labUsers, ({ many }) => ({
	ownedProjects: many(labProjects),
	assignedTasks: many(labTasks),
	taskSnapshots: many(labTaskSnapshots),
}))

export const labProjectsRelations = relations(labProjects, ({ one, many }) => ({
	owner: one(labUsers, {
		fields: [labProjects.ownerId],
		references: [labUsers.id],
	}),
	tasks: many(labTasks),
	taskSnapshots: many(labTaskSnapshots),
}))

export const labTasksRelations = relations(labTasks, ({ one, many }) => ({
	project: one(labProjects, {
		fields: [labTasks.projectId],
		references: [labProjects.id],
	}),
	assignee: one(labUsers, {
		fields: [labTasks.assigneeId],
		references: [labUsers.id],
	}),
	snapshots: many(labTaskSnapshots),
}))

export const labTaskSnapshotsRelations = relations(labTaskSnapshots, ({ one }) => ({
	project: one(labProjects, {
		fields: [labTaskSnapshots.projectId],
		references: [labProjects.id],
	}),
	assignee: one(labUsers, {
		fields: [labTaskSnapshots.assigneeId],
		references: [labUsers.id],
	}),
}))

export const schema = {
	labUsers,
	labProjects,
	labTasks,
	labTaskSnapshots,
	labUsersRelations,
	labProjectsRelations,
	labTasksRelations,
	labTaskSnapshotsRelations,
}
