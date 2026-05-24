const elements = {
	connectionString: document.querySelector('#connectionString'),
	methodSummary: document.querySelector('#methodSummary'),
	metricUsers: document.querySelector('#metricUsers'),
	metricProjects: document.querySelector('#metricProjects'),
	metricTasks: document.querySelector('#metricTasks'),
	metricTodoTasks: document.querySelector('#metricTodoTasks'),
	metricBlockedTasks: document.querySelector('#metricBlockedTasks'),
	metricDoneTasks: document.querySelector('#metricDoneTasks'),
	metricSnapshots: document.querySelector('#metricSnapshots'),
	metricMigrations: document.querySelector('#metricMigrations'),
	workspaceUsersCount: document.querySelector('#workspaceUsersCount'),
	workspaceProjectsCount: document.querySelector('#workspaceProjectsCount'),
	workspaceTasksCount: document.querySelector('#workspaceTasksCount'),
	usersTableBody: document.querySelector('#usersTableBody'),
	projectsTableBody: document.querySelector('#projectsTableBody'),
	tasksTableBody: document.querySelector('#tasksTableBody'),
	snapshotsTableBody: document.querySelector('#snapshotsTableBody'),
	migrationHistoryBody: document.querySelector('#migrationHistoryBody'),
	migrationLocksPreview: document.querySelector('#migrationLocksPreview'),
	schemaCreatePreview: document.querySelector('#schemaCreatePreview'),
	schemaMigrationPreview: document.querySelector('#schemaMigrationPreview'),
	schemaServicePreview: document.querySelector('#schemaServicePreview'),
	schemaAdvancedPreview: document.querySelector('#schemaAdvancedPreview'),
	schemaRuntimeGroups: document.querySelector('#schemaRuntimeGroups'),
	scenarioList: document.querySelector('#scenarioList'),
	scenarioFilters: document.querySelector('#scenarioFilters'),
	methodCatalog: document.querySelector('#methodCatalog'),
	methodSectionFilters: document.querySelector('#methodSectionFilters'),
	methodSearch: document.querySelector('#methodSearch'),
	actionTitle: document.querySelector('#actionTitle'),
	actionDescription: document.querySelector('#actionDescription'),
	actionMethodName: document.querySelector('#actionMethodName'),
	actionMode: document.querySelector('#actionMode'),
	actionDocLink: document.querySelector('#actionDocLink'),
	actionMethods: document.querySelector('#actionMethods'),
	actionCode: document.querySelector('#actionCode'),
	actionSqlBlocks: document.querySelector('#actionSqlBlocks'),
	actionResult: document.querySelector('#actionResult'),
	actionTrace: document.querySelector('#actionTrace'),
	queryLog: document.querySelector('#queryLog'),
	refreshStateButton: document.querySelector('#refreshStateButton'),
	batchUpdateButton: document.querySelector('#batchUpdateButton'),
	batchDeleteButton: document.querySelector('#batchDeleteButton'),
	batchFromStatus: document.querySelector('#batchFromStatus'),
	batchToStatus: document.querySelector('#batchToStatus'),
	batchDeleteStatus: document.querySelector('#batchDeleteStatus'),
	snapshotStatusSelect: document.querySelector('#snapshotStatusSelect'),
	rawProjectId: document.querySelector('#rawProjectId'),
	rawGetProjectButton: document.querySelector('#rawGetProjectButton'),
	insertSnapshotsButton: document.querySelector('#insertSnapshotsButton'),
	scriptTaskId: document.querySelector('#scriptTaskId'),
	scriptTaskTitle: document.querySelector('#scriptTaskTitle'),
	runScriptButton: document.querySelector('#runScriptButton'),
	userForm: document.querySelector('#userForm'),
	projectForm: document.querySelector('#projectForm'),
	taskForm: document.querySelector('#taskForm'),
	projectOwnerSelect: document.querySelector('#projectOwnerSelect'),
	taskProjectSelect: document.querySelector('#taskProjectSelect'),
	taskAssigneeSelect: document.querySelector('#taskAssigneeSelect'),
	inspectorSection: document.querySelector('#inspector-section'),
	toast: document.querySelector('#toast'),
}

const state = {
	users: [],
	projects: [],
	tasks: [],
	taskSnapshots: [],
	actionCatalog: [],
	actionMap: new Map(),
	methodCatalog: [],
	methodMap: new Map(),
	mutatingActionIds: new Set(),
	lastSelectedMethodId: null,
	activeView: 'crud',
	activeEntity: 'users',
	activeExplorer: 'scenarios',
	activeScenarioCategory: 'all',
	activeMethodSection: 'all',
}

const scenarioCategoryOrder = ['explore', 'advanced', 'raw']
const scenarioCategoryLabels = {
	explore: 'Базовые запросы',
	advanced: 'Предпросмотр и сложные builders',
	raw: 'Raw SQL, транзакции и YQL script',
}

const roleLabels = {
	architect: 'Архитектор',
	lead: 'Лид',
	reviewer: 'Ревьюер',
	delivery: 'Координатор',
	engineer: 'Инженер',
}

const userStatusLabels = {
	active: 'Активен',
	review: 'На ревью',
	paused: 'Пауза',
}

const projectStatusLabels = {
	active: 'Активен',
	planning: 'Планирование',
	review: 'Ревью',
	done: 'Готово',
}

const taskStatusLabels = {
	todo: 'К выполнению',
	'in-progress': 'В работе',
	review: 'Ревью',
	blocked: 'Заблокирована',
	done: 'Готово',
	scripted: 'Через script',
	'tx-committed': 'Транзакция commit',
	'tx-rollback': 'Транзакция rollback',
}

const modeLabels = {
	live: 'выполнение',
	preview: 'предпросмотр',
	mixed: 'смешанный режим',
}

const priorityLabels = {
	high: 'Высокий',
	medium: 'Средний',
	low: 'Низкий',
}

function serialize(value) {
	return JSON.stringify(
		value,
		(_, entry) => {
			if (typeof entry === 'bigint') {
				return entry.toString()
			}

			if (entry instanceof Date) {
				return entry.toISOString()
			}

			return entry
		},
		2
	)
}

function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

function compactFormData(form) {
	return Object.fromEntries([...new FormData(form).entries()].filter(([, value]) => value !== ''))
}

function formatDate(value) {
	if (!value) {
		return '-'
	}

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		return String(value)
	}

	return date.toLocaleString('ru-RU')
}

function formatRole(value) {
	return roleLabels[value] ?? value ?? '-'
}

function formatUserStatus(value) {
	return userStatusLabels[value] ?? value ?? '-'
}

function formatProjectStatus(value) {
	return projectStatusLabels[value] ?? value ?? '-'
}

function formatTaskStatus(value) {
	return taskStatusLabels[value] ?? value ?? '-'
}

function formatPriority(value) {
	return priorityLabels[value] ?? value ?? '-'
}

function normalizeMethodName(value) {
	return String(value ?? '')
		.replace(/[()]/g, '')
		.toLowerCase()
}

function formatModeLabel(value) {
	return modeLabels[value] ?? value ?? '-'
}

function statusMeta(modeOrAvailability) {
	if (modeOrAvailability === 'preview') {
		return { label: formatModeLabel('preview'), className: 'status-preview' }
	}

	return { label: formatModeLabel('live'), className: 'status-live' }
}

function showToast(message, isError = false) {
	elements.toast.textContent = message
	elements.toast.classList.remove('hidden')
	elements.toast.classList.toggle('toast-error', isError)
	clearTimeout(showToast.timer)
	showToast.timer = setTimeout(() => elements.toast.classList.add('hidden'), 3200)
}

async function request(url, options = {}) {
	const response = await fetch(url, {
		headers: { 'Content-Type': 'application/json' },
		...options,
	})
	const payload = await response.json()

	if (!payload.ok) {
		const error = new Error(payload.error?.message || 'Request failed')
		error.payload = payload
		throw error
	}

	return payload
}

function fireAndForget(promise) {
	promise.catch(() => {})
}

function renderStatusPill(label, tone = 'cyan') {
	return `<span class="pill pill-${tone}">${escapeHtml(label)}</span>`
}

function syncSelectOptions(select, options, selectedValue) {
	const currentValue = selectedValue ?? select.value
	select.innerHTML = options
		.map(
			(option) =>
				`<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
		)
		.join('')

	if (options.some((option) => String(option.value) === String(currentValue))) {
		select.value = String(currentValue)
	}
}

function renderRelationSelects() {
	const userOptions = state.users.map((user) => ({
		value: user.id,
		label: `${user.id} - ${user.name} (${formatRole(user.role)})`,
	}))
	const projectOptions = state.projects.map((project) => ({
		value: project.id,
		label: `${project.id} - ${project.title}`,
	}))

	syncSelectOptions(elements.projectOwnerSelect, userOptions, elements.projectOwnerSelect.value)
	syncSelectOptions(elements.taskAssigneeSelect, userOptions, elements.taskAssigneeSelect.value)
	syncSelectOptions(elements.taskProjectSelect, projectOptions, elements.taskProjectSelect.value)
}

function fillForm(form, values) {
	Object.entries(values).forEach(([key, value]) => {
		const field = form.elements.namedItem(key)
		if (field) {
			field.value = value ?? ''
		}
	})
}

function setMetrics(counts, migrationCount) {
	elements.metricUsers.textContent = counts.users
	elements.metricProjects.textContent = counts.projects
	elements.metricTasks.textContent = counts.tasks
	elements.metricTodoTasks.textContent = counts.todoTasks
	elements.metricBlockedTasks.textContent = counts.blockedTasks
	elements.metricDoneTasks.textContent = counts.doneTasks
	elements.metricSnapshots.textContent = counts.snapshots
	elements.metricMigrations.textContent = migrationCount
}

function updateWorkspaceCounts(counts) {
	elements.workspaceUsersCount.textContent = counts.users
	elements.workspaceProjectsCount.textContent = counts.projects
	elements.workspaceTasksCount.textContent = counts.tasks
}

function setActiveView(viewId) {
	state.activeView = viewId

	document.querySelectorAll('[data-view-target]').forEach((button) => {
		button.classList.toggle('is-active', button.dataset.viewTarget === viewId)
	})

	document.querySelectorAll('[data-view-panel]').forEach((panel) => {
		panel.classList.toggle('hidden', panel.dataset.viewPanel !== viewId)
	})
}

function setActiveEntity(entityId) {
	state.activeEntity = entityId

	document.querySelectorAll('[data-entity-target]').forEach((button) => {
		button.classList.toggle('is-active', button.dataset.entityTarget === entityId)
	})

	document.querySelectorAll('[data-entity-panel]').forEach((panel) => {
		panel.classList.toggle('hidden', panel.dataset.entityPanel !== entityId)
		panel.classList.toggle('is-active', panel.dataset.entityPanel === entityId)
	})
}

function setActiveExplorer(explorerId) {
	state.activeExplorer = explorerId

	document.querySelectorAll('[data-explorer-target]').forEach((button) => {
		button.classList.toggle('is-active', button.dataset.explorerTarget === explorerId)
	})

	document.querySelectorAll('[data-explorer-panel]').forEach((panel) => {
		panel.classList.toggle('hidden', panel.dataset.explorerPanel !== explorerId)
		panel.classList.toggle('is-active', panel.dataset.explorerPanel === explorerId)
	})
}

function renderUsers(users) {
	elements.usersTableBody.innerHTML = users
		.map(
			(user) => `
      <tr>
        <td><strong>${escapeHtml(user.id)}</strong></td>
        <td>${escapeHtml(user.name)}</td>
        <td>${renderStatusPill(formatRole(user.role), 'lime')}</td>
        <td>${renderStatusPill(formatUserStatus(user.status), 'cyan')}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>
          <div class="inline-actions">
            <button type="button" data-load-user="${escapeHtml(user.id)}">В форму</button>
            <button type="button" data-prepared-user="${escapeHtml(user.id)}">В инспектор</button>
            <button type="button" data-delete-user="${escapeHtml(user.id)}" class="danger-button">Удалить</button>
          </div>
        </td>
      </tr>
    `
		)
		.join('')
}

function renderProjects(projects) {
	elements.projectsTableBody.innerHTML = projects
		.map(
			(project) => `
      <tr>
        <td><strong>${escapeHtml(project.id)}</strong></td>
        <td>${escapeHtml(project.title)}</td>
        <td>${escapeHtml(project.ownerName)}</td>
        <td>${renderStatusPill(formatProjectStatus(project.status), 'orange')}</td>
        <td>${escapeHtml(project.slug)}</td>
        <td>
          <div class="inline-actions">
            <button type="button" data-load-project="${escapeHtml(project.id)}">В форму</button>
            <button type="button" data-prepared-project="${escapeHtml(project.id)}">В инспектор</button>
            <button type="button" data-delete-project="${escapeHtml(project.id)}" class="danger-button">Удалить</button>
          </div>
        </td>
      </tr>
    `
		)
		.join('')
}

function renderTasks(tasks) {
	elements.tasksTableBody.innerHTML = tasks
		.map(
			(task) => `
      <tr>
        <td><strong>${escapeHtml(task.id)}</strong></td>
        <td>${escapeHtml(task.title)}</td>
        <td>${escapeHtml(task.projectTitle)}</td>
        <td>${escapeHtml(task.assigneeName)}</td>
        <td>${renderStatusPill(formatTaskStatus(task.status), task.status === 'blocked' ? 'danger' : 'cyan')}</td>
        <td>
          <div class="inline-actions">
            <button type="button" data-load-task="${escapeHtml(task.id)}">В форму</button>
            <button type="button" data-prepared-task="${escapeHtml(task.id)}">В инспектор</button>
            <button type="button" data-delete-task="${escapeHtml(task.id)}" class="danger-button">Удалить</button>
          </div>
        </td>
      </tr>
    `
		)
		.join('')
}

function renderSnapshots(taskSnapshots) {
	elements.snapshotsTableBody.innerHTML = taskSnapshots
		.map(
			(snapshot) => `
      <tr>
        <td><strong>${escapeHtml(snapshot.id)}</strong></td>
        <td>${escapeHtml(snapshot.title)}</td>
        <td>${renderStatusPill(formatTaskStatus(snapshot.status), 'cyan')}</td>
        <td>${renderStatusPill(formatPriority(snapshot.priority), 'lime')}</td>
        <td>${escapeHtml(formatDate(snapshot.updatedAt))}</td>
      </tr>
    `
		)
		.join('')
}

function renderMigrationHistory(history) {
	elements.migrationHistoryBody.innerHTML = history.length
		? history
				.map(
					(row) => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(`${row.statements_applied ?? 0}/${row.statements_total ?? 0}`)}</td>
            <td>${escapeHtml(row.owner_id ?? '-')}</td>
          </tr>
        `
				)
				.join('')
		: `<tr><td colspan="4">Строк миграций пока нет.</td></tr>`
}

function renderRuntimeDdlGroups(groups) {
	elements.schemaRuntimeGroups.innerHTML = groups
		.map((group) => {
			const mode = statusMeta(group.mode === 'mixed' ? 'preview' : group.mode)
			return `
        <article class="card runtime-card">
          <div class="card-head spread-head">
            <div>
              <p class="eyebrow">${escapeHtml(formatModeLabel(group.mode))}</p>
              <h3>${escapeHtml(group.title)}</h3>
            </div>
            <span class="status-badge ${mode.className}">${escapeHtml(mode.label)}</span>
          </div>
          <pre>${escapeHtml(group.statements.join('\n\n'))}</pre>
        </article>
      `
		})
		.join('')
}

function renderSchema(schemaSql) {
	elements.schemaCreatePreview.textContent = schemaSql.create.join('\n\n')
	elements.schemaMigrationPreview.textContent = [
		...schemaSql.migration,
		'',
		'-- Recreate flow --',
		...schemaSql.recreate,
	].join('\n\n')
	elements.schemaServicePreview.textContent = schemaSql.service.join('\n\n')
	elements.schemaAdvancedPreview.textContent = schemaSql.advanced.join('\n\n')
	renderRuntimeDdlGroups(schemaSql.runtimeDdl || [])
}

function renderQueryLog(recentQueries) {
	elements.queryLog.innerHTML = recentQueries.length
		? recentQueries
				.map(
					(query) => `
          <article class="query-item">
            <div class="query-meta">
              <strong>${escapeHtml(query.actionTitle ?? 'фоновый запрос')}</strong>
              <span>${escapeHtml(new Date(query.at).toLocaleTimeString('ru-RU'))}</span>
            </div>
            <pre>${escapeHtml(query.sql)}</pre>
            ${query.params?.length ? `<pre class="query-params">${escapeHtml(serialize(query.params))}</pre>` : ''}
          </article>
        `
				)
				.join('')
		: `<article class="query-item"><p>Запросов пока нет.</p></article>`
}

function normalizeSqlBlocks(result, trace) {
	const fromResult = result?.sqlPreview

	if (Array.isArray(fromResult)) {
		return fromResult
	}

	if (fromResult && typeof fromResult === 'object') {
		return [fromResult]
	}

	if (trace?.queries?.length) {
		return trace.queries.map((query, index) => ({
			title: `Запрос ${index + 1}`,
			sql: query.sql,
			params: query.params,
		}))
	}

	return []
}

function renderSqlBlocks(result, trace) {
	const blocks = normalizeSqlBlocks(result, trace)

	if (!blocks.length) {
		elements.actionSqlBlocks.innerHTML = `
      <article class="sql-block empty-state">
        <h4>Нет отдельного SQL-предпросмотра</h4>
        <pre>У этого действия пока нет предпросмотра и trace-запросов.</pre>
      </article>
    `
		return
	}

	elements.actionSqlBlocks.innerHTML = blocks
		.map(
			(block) => `
      <article class="sql-block">
        <div class="sql-head">
          <h4>${escapeHtml(block.title || 'YQL')}</h4>
          <span>${block.params?.length ? escapeHtml(`${block.params.length} параметров`) : 'без параметров'}</span>
        </div>
        <pre>${escapeHtml(block.sql || '')}</pre>
        ${block.params?.length ? `<pre class="query-params">${escapeHtml(serialize(block.params))}</pre>` : ''}
      </article>
    `
		)
		.join('')
}

function renderAction(result, trace, selectedMethod = null) {
	const action = state.actionMap.get(result?.actionId) ?? state.actionMap.get(trace?.id) ?? null
	const activeMethod = selectedMethod ?? state.methodMap.get(state.lastSelectedMethodId) ?? null
	const status = statusMeta(
		activeMethod?.availability === 'docs-only'
			? 'docs-only'
			: activeMethod?.mode || trace?.mode || action?.mode || result?.mode || 'live'
	)
	const methodTokens = trace?.adapterMethods || action?.adapterMethods || []
	const activeToken = normalizeMethodName(activeMethod?.name)

	elements.actionTitle.textContent =
		activeMethod?.name || trace?.title || 'Выбери метод или сценарий'
	elements.actionDescription.textContent =
		activeMethod?.description ||
		trace?.description ||
		result?.note ||
		'Здесь будет краткое описание последнего действия.'
	elements.actionMethodName.textContent = activeMethod
		? `Сценарий: ${trace?.title || action?.title || activeMethod.actionId}`
		: trace?.title || 'Метод еще не выбран'
	elements.actionMode.textContent = status.label
	elements.actionMode.className = `status-badge ${status.className}`
	elements.actionCode.textContent =
		trace?.sampleCode || action?.sampleCode || 'Выбери метод, чтобы открыть пример вызова.'
	elements.actionResult.textContent = serialize(result)
	elements.actionTrace.textContent = serialize(trace || { mode: status.label, queries: [] })
	elements.actionMethods.innerHTML = methodTokens
		.map((method) => {
			const isActive = activeToken && normalizeMethodName(method) === activeToken
			return `<span class="chip${isActive ? ' active-chip' : ''}">${escapeHtml(method)}</span>`
		})
		.join('')
	renderSqlBlocks(result, trace)

	const docUrl = activeMethod?.docUrl || trace?.docUrl || action?.docUrl
	if (docUrl) {
		elements.actionDocLink.classList.remove('hidden')
		elements.actionDocLink.href = docUrl
	} else {
		elements.actionDocLink.classList.add('hidden')
		elements.actionDocLink.href = '#'
	}
}

function splitIntoBalancedColumns(items, getWeight) {
	if (items.length <= 1) {
		return [items.slice(), []]
	}

	const weights = items.map((item) => getWeight(item))
	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
	const maxMask = 1 << items.length
	let bestMask = 1
	let bestDiff = Number.POSITIVE_INFINITY

	for (let mask = 1; mask < maxMask - 1; mask += 2) {
		let leftWeight = 0

		for (let index = 0; index < items.length; index += 1) {
			if (mask & (1 << index)) {
				leftWeight += weights[index]
			}
		}

		const diff = Math.abs(totalWeight - leftWeight * 2)
		if (diff < bestDiff) {
			bestDiff = diff
			bestMask = mask
		}
	}

	const columns = [[], []]
	items.forEach((item, index) => {
		columns[bestMask & (1 << index) ? 0 : 1].push(item)
	})

	return columns
}

function renderScenarioList() {
	const sections = scenarioCategoryOrder
		.map((category) => {
			if (
				state.activeScenarioCategory !== 'all' &&
				state.activeScenarioCategory !== category
			) {
				return null
			}

			const items = state.actionCatalog.filter((action) => action.category === category)
			if (!items.length) {
				return null
			}

			return {
				weight: items.length,
				html: `
          <section class="scenario-group">
          <div class="scenario-group-head">
            <p class="eyebrow">${escapeHtml(scenarioCategoryLabels[category])}</p>
            <h3>${escapeHtml(scenarioCategoryLabels[category])}</h3>
          </div>
          <div class="scenario-stack">
            ${items
				.map((item) => {
					const status = statusMeta(item.mode)
					return `
                  <article class="card scenario-card">
                    <div class="card-head spread-head">
                      <div>
                        <p class="eyebrow">${escapeHtml(scenarioCategoryLabels[category])}</p>
                        <h4>${escapeHtml(item.title)}</h4>
                      </div>
                      <span class="status-badge ${status.className}">${escapeHtml(status.label)}</span>
                    </div>
                    <p class="scenario-copy">${escapeHtml(item.description)}</p>
                    <div class="chip-row compact-row">
                      ${item.adapterMethods.map((method) => `<span class="chip">${escapeHtml(method)}</span>`).join('')}
                    </div>
                    <div class="button-row wrap compact-buttons">
                      <button type="button" data-action="${escapeHtml(item.id)}">Запустить</button>
                      <a class="ghost-link" href="${escapeHtml(item.docUrl)}" target="_blank" rel="noreferrer">Документация</a>
                    </div>
                  </article>
                `
				})
				.join('')}
          </div>
          </section>
        `,
			}
		})
		.filter(Boolean)

	if (!sections.length) {
		elements.scenarioList.innerHTML = ''
		return
	}

	if (sections.length === 1) {
		;[elements.scenarioList.innerHTML] = sections.map((section) => section.html)
		return
	}

	const [leftColumn, rightColumn] = splitIntoBalancedColumns(
		sections,
		(section) => section.weight
	)
	elements.scenarioList.innerHTML = `
    <div class="scenario-columns">
      <div class="scenario-column">${leftColumn.map((section) => section.html).join('')}</div>
      <div class="scenario-column">${rightColumn.map((section) => section.html).join('')}</div>
    </div>
  `
}

function renderScenarioFilters() {
	const counts = scenarioCategoryOrder.reduce((accumulator, category) => {
		accumulator[category] = state.actionCatalog.filter(
			(action) => action.category === category
		).length
		return accumulator
	}, {})
	const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

	elements.scenarioFilters.innerHTML = [
		{ id: 'all', label: 'Все сценарии', count: total },
		...scenarioCategoryOrder.map((category) => ({
			id: category,
			label: scenarioCategoryLabels[category],
			count: counts[category],
		})),
	]
		.map(
			(filter) => `
      <button type="button" class="filter-chip${state.activeScenarioCategory === filter.id ? ' is-active' : ''}" data-scenario-filter="${escapeHtml(filter.id)}">
        ${escapeHtml(filter.label)}
        <span class="tab-count">${escapeHtml(filter.count)}</span>
      </button>
    `
		)
		.join('')
}

function renderMethodSectionFilters() {
	const sections = state.methodCatalog.map((section) => ({
		id: section.id,
		label: section.eyebrow || section.title,
		count: section.items.length,
	}))
	const total = sections.reduce((sum, section) => sum + section.count, 0)

	elements.methodSectionFilters.innerHTML = [
		{ id: 'all', label: 'Все методы', count: total },
		...sections,
	]
		.map(
			(filter) => `
      <button type="button" class="filter-chip${state.activeMethodSection === filter.id ? ' is-active' : ''}" data-method-section="${escapeHtml(filter.id)}">
        ${escapeHtml(filter.label)}
        <span class="tab-count">${escapeHtml(filter.count)}</span>
      </button>
    `
		)
		.join('')
}

function renderMethodCatalog() {
	const query = elements.methodSearch.value.trim().toLowerCase()
	const flatItems = state.methodCatalog.flatMap((section) => section.items)
	const counts = flatItems.reduce(
		(accumulator, item) => {
			accumulator.all += 1
			if (item.availability === 'docs-only') {
				accumulator.docsOnly += 1
			} else if (item.mode === 'preview') {
				accumulator.preview += 1
			} else {
				accumulator.live += 1
			}
			return accumulator
		},
		{ all: 0, live: 0, preview: 0, docsOnly: 0 }
	)

	let matched = 0
	const sections = state.methodCatalog
		.map((section) => {
			if (state.activeMethodSection !== 'all' && state.activeMethodSection !== section.id) {
				return null
			}

			const items = section.items.filter((item) => {
				if (!query) {
					return true
				}

				const haystack = `${section.title} ${item.name} ${item.description}`.toLowerCase()
				return haystack.includes(query)
			})

			matched += items.length

			if (!items.length) {
				return null
			}

			return {
				id: section.id,
				weight: items.length,
				html: `
          <section class="method-section">
          <div class="method-section-head">
            <div>
              <p class="eyebrow">${escapeHtml(section.eyebrow)}</p>
              <h3>${escapeHtml(section.title)}</h3>
            </div>
            <a class="ghost-link" href="${escapeHtml(section.docUrl)}" target="_blank" rel="noreferrer">Раздел документации</a>
          </div>
          <div class="method-grid">
            ${items
				.map((item) => {
					const status = statusMeta(
						item.availability === 'docs-only' ? 'docs-only' : item.mode
					)
					const isActive = state.lastSelectedMethodId === item.id
					return `
                  <button type="button" class="method-card${isActive ? ' method-card-active' : ''}" data-method-id="${escapeHtml(item.id)}">
                    <span class="method-card-head">
                      <strong>${escapeHtml(item.name)}</strong>
                      <span class="status-badge ${status.className}">${escapeHtml(status.label)}</span>
                    </span>
                    <span class="method-card-body">${escapeHtml(item.description)}</span>
                  </button>
                `
				})
				.join('')}
          </div>
          </section>
        `,
			}
		})
		.filter(Boolean)

	const pinnedSections = []
	let columnSections = sections

	if (state.activeMethodSection === 'all') {
		const batchSection = sections.find((section) => section.id === 'batch')
		if (batchSection) {
			pinnedSections.push(batchSection)
			columnSections = sections.filter((section) => section.id !== 'batch')
		}
	}

	if (!pinnedSections.length && !columnSections.length) {
		elements.methodCatalog.innerHTML = `
      <article class="card unavailable-item">
        <p>По текущему фильтру методы не найдены.</p>
      </article>
    `
	} else if (!columnSections.length) {
		elements.methodCatalog.innerHTML = pinnedSections.map((section) => section.html).join('')
	} else if (!pinnedSections.length && columnSections.length === 1) {
		;[elements.methodCatalog.innerHTML] = columnSections.map((section) => section.html)
	} else {
		const [leftColumn, rightColumn] = splitIntoBalancedColumns(
			columnSections,
			(section) => section.weight
		)
		elements.methodCatalog.innerHTML = `
      ${pinnedSections.map((section) => section.html).join('')}
      <div class="method-catalog-columns">
        <div class="method-catalog-column">${leftColumn.map((section) => section.html).join('')}</div>
        <div class="method-catalog-column">${rightColumn.map((section) => section.html).join('')}</div>
      </div>
    `
	}

	const visible = query || state.activeMethodSection !== 'all' ? matched : counts.all
	elements.methodSummary.textContent = `${visible} из ${counts.all} методов • ${counts.live} выполнение • ${counts.preview} предпросмотр`
}

function updateStateFromSnapshot(snapshot) {
	state.users = snapshot.users
	state.projects = snapshot.projects
	state.tasks = snapshot.tasks
	state.taskSnapshots = snapshot.taskSnapshots

	elements.connectionString.textContent = snapshot.connectionString
	setMetrics(snapshot.counts, snapshot.migrations.history.length)
	updateWorkspaceCounts(snapshot.counts)
	renderUsers(snapshot.users)
	renderProjects(snapshot.projects)
	renderTasks(snapshot.tasks)
	renderSnapshots(snapshot.taskSnapshots)
	renderMigrationHistory(snapshot.migrations.history)
	elements.migrationLocksPreview.textContent = serialize(snapshot.migrations.locks)
	renderSchema(snapshot.schemaSql)
	renderQueryLog(snapshot.recentQueries)
	renderRelationSelects()
}

async function refreshState(showMessage = false) {
	const payload = await request('/api/state')
	updateStateFromSnapshot(payload.data)
	renderMethodCatalog()

	if (showMessage) {
		showToast('Данные обновлены.')
	}
}

async function runAction(actionId, body = {}, options = {}) {
	const selectedMethod = options.selectedMethod ?? null

	if (selectedMethod) {
		state.lastSelectedMethodId = selectedMethod.id
		renderMethodCatalog()
	} else if (options.clearMethodSelection !== false) {
		state.lastSelectedMethodId = null
		renderMethodCatalog()
	}

	try {
		const payload = await request(`/api/actions/${actionId}`, {
			method: 'POST',
			body: JSON.stringify(body),
		})

		const data = {
			...payload.data,
			actionId,
		}

		renderAction(data, payload.action, selectedMethod)
		renderQueryLog(payload.recentQueries)

		const shouldRefresh = options.refresh ?? state.mutatingActionIds.has(actionId)
		if (shouldRefresh) {
			await refreshState()
		}

		if (options.scrollToInspector !== false) {
			setActiveView('inspector')
			elements.inspectorSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}

		showToast(
			selectedMethod
				? `${selectedMethod.name} выполнен.`
				: `${payload.action.title} выполнено.`
		)
		return payload
	} catch (error) {
		if (error.payload?.recentQueries) {
			renderQueryLog(error.payload.recentQueries)
		}

		const action = state.actionMap.get(actionId)
		renderAction(
			{ actionId, error: error.message },
			error.payload?.error?.trace || {
				title: action?.title || 'Операция завершилась ошибкой',
				description: error.message,
				mode: action?.mode || 'live',
				sampleCode: action?.sampleCode || null,
				adapterMethods: action?.adapterMethods || [],
				docUrl: action?.docUrl || null,
				queries: [],
			},
			selectedMethod
		)

		if (options.scrollToInspector !== false) {
			setActiveView('inspector')
			elements.inspectorSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}

		showToast(error.message, true)
		throw error
	}
}

function handleMethodClick(methodId) {
	const method = state.methodMap.get(methodId)
	if (!method) {
		return
	}

	fireAndForget(
		runAction(method.actionId, method.payload || {}, {
			selectedMethod: method,
			refresh: method.availability === 'docs-only' ? false : undefined,
			scrollToInspector: true,
			clearMethodSelection: false,
		})
	)
}

function handleLoadUser(id) {
	const user = state.users.find((entry) => String(entry.id) === String(id))
	if (!user) {
		return
	}

	fillForm(elements.userForm, user)
	showToast(`Пользователь ${user.id} загружен в форму.`)
}

function handleLoadProject(id) {
	const project = state.projects.find((entry) => String(entry.id) === String(id))
	if (!project) {
		return
	}

	fillForm(elements.projectForm, project)
	showToast(`Проект ${project.id} загружен в форму.`)
}

function handleLoadTask(id) {
	const task = state.tasks.find((entry) => String(entry.id) === String(id))
	if (!task) {
		return
	}

	fillForm(elements.taskForm, task)
	showToast(`Задача ${task.id} загружена в форму.`)
}

function bindEvents() {
	document.body.addEventListener('click', (event) => {
		const target = event.target instanceof Element ? event.target.closest('button') : null
		if (!target) {
			return
		}

		if (target.dataset.viewTarget) {
			setActiveView(target.dataset.viewTarget)
			return
		}

		if (target.dataset.entityTarget) {
			setActiveEntity(target.dataset.entityTarget)
			return
		}

		if (target.dataset.explorerTarget) {
			setActiveExplorer(target.dataset.explorerTarget)
			return
		}

		if (target.dataset.scenarioFilter) {
			state.activeScenarioCategory = target.dataset.scenarioFilter
			renderScenarioFilters()
			renderScenarioList()
			return
		}

		if (target.dataset.methodSection) {
			state.activeMethodSection = target.dataset.methodSection
			renderMethodSectionFilters()
			renderMethodCatalog()
			return
		}

		if (target.dataset.methodId) {
			handleMethodClick(target.dataset.methodId)
			return
		}

		if (target.dataset.action) {
			fireAndForget(runAction(target.dataset.action, {}, { scrollToInspector: true }))
			return
		}

		if (target.dataset.formAction) {
			const form = document.querySelector(`#${target.dataset.formId}`)
			fireAndForget(
				runAction(target.dataset.formAction, compactFormData(form), {
					scrollToInspector: true,
				})
			)
			return
		}

		if (target.dataset.loadUser) {
			handleLoadUser(target.dataset.loadUser)
			return
		}

		if (target.dataset.preparedUser) {
			fireAndForget(
				runAction(
					'getPreparedUser',
					{ id: target.dataset.preparedUser },
					{ scrollToInspector: true }
				)
			)
			return
		}

		if (target.dataset.deleteUser) {
			fireAndForget(
				runAction(
					'deleteUser',
					{ id: target.dataset.deleteUser },
					{ scrollToInspector: true }
				)
			)
			return
		}

		if (target.dataset.loadProject) {
			handleLoadProject(target.dataset.loadProject)
			return
		}

		if (target.dataset.preparedProject) {
			fireAndForget(
				runAction(
					'getPreparedProject',
					{ id: target.dataset.preparedProject },
					{ scrollToInspector: true }
				)
			)
			return
		}

		if (target.dataset.deleteProject) {
			fireAndForget(
				runAction(
					'deleteProject',
					{ id: target.dataset.deleteProject },
					{ scrollToInspector: true }
				)
			)
			return
		}

		if (target.dataset.loadTask) {
			handleLoadTask(target.dataset.loadTask)
			return
		}

		if (target.dataset.preparedTask) {
			fireAndForget(
				runAction(
					'getPreparedTask',
					{ id: target.dataset.preparedTask },
					{ scrollToInspector: true }
				)
			)
			return
		}

		if (target.dataset.deleteTask) {
			fireAndForget(
				runAction(
					'deleteTask',
					{ id: target.dataset.deleteTask },
					{ scrollToInspector: true }
				)
			)
			return
		}

		if (
			target === elements.refreshStateButton ||
			Object.prototype.hasOwnProperty.call(target.dataset, 'refreshState')
		) {
			fireAndForget(refreshState(true))
			return
		}

		if (target === elements.batchUpdateButton) {
			fireAndForget(
				runAction(
					'batchUpdateTasks',
					{
						fromStatus: elements.batchFromStatus.value,
						toStatus: elements.batchToStatus.value,
					},
					{ scrollToInspector: true }
				)
			)
			return
		}

		if (target === elements.batchDeleteButton) {
			fireAndForget(
				runAction(
					'batchDeleteTasks',
					{
						status: elements.batchDeleteStatus.value,
					},
					{ scrollToInspector: true }
				)
			)
			return
		}

		if (target === elements.insertSnapshotsButton) {
			fireAndForget(
				runAction(
					'runInsertSnapshotsFromSelect',
					{
						status: elements.snapshotStatusSelect.value,
					},
					{ scrollToInspector: true }
				)
			)
			return
		}

		if (target === elements.rawGetProjectButton) {
			fireAndForget(
				runAction(
					'runRawGetProject',
					{
						id: elements.rawProjectId.value,
					},
					{ scrollToInspector: true, refresh: false }
				)
			)
			return
		}

		if (target === elements.runScriptButton) {
			fireAndForget(
				runAction(
					'runYqlScriptAction',
					{
						id: elements.scriptTaskId.value,
						title: elements.scriptTaskTitle.value,
					},
					{ scrollToInspector: true }
				)
			)
		}
	})

	elements.methodSearch.addEventListener('input', () => renderMethodCatalog())
}

async function bootstrap() {
	try {
		const payload = await request('/api/bootstrap')
		state.actionCatalog = payload.data.actionCatalog
		state.actionMap = new Map(state.actionCatalog.map((action) => [action.id, action]))
		state.methodCatalog = payload.data.methodCatalog
		state.methodMap = new Map(
			state.methodCatalog.flatMap((section) => section.items.map((item) => [item.id, item]))
		)
		state.mutatingActionIds = new Set(payload.data.mutatingActionIds || [])

		renderScenarioFilters()
		renderScenarioList()
		renderMethodSectionFilters()
		renderMethodCatalog()
		updateStateFromSnapshot(payload.data.state)
		renderAction(
			{ note: 'Проект готов. Начни с любого метода справа или с готовых сценариев слева.' },
			{
				title: 'Проект готов',
				description:
					'Каталог методов справа открывает каждый документированный вызов через сценарий выполнения или предпросмотра. Инспектор сверху всегда показывает пример вызова, YQL и ответ API.',
				mode: 'live',
				sampleCode: `await migrate(db, { migrationsTable: "__adapter_lab_migrations", migrations: [...] });`,
				adapterMethods: [
					'migrate',
					'db.query.*',
					'prepare',
					'yqlScript',
					'buildCreateTableSql',
				],
				docUrl: 'https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/',
				queries: [],
			},
			null
		)
		bindEvents()
		setActiveView(state.activeView)
		setActiveEntity(state.activeEntity)
		setActiveExplorer(state.activeExplorer)
		window.__adapterExample = { runAction, refreshState, state }
		document.body.dataset.labReady = '1'
		showToast('Проект загружен.')
	} catch (error) {
		renderAction(
			{ error: error.message },
			{
				title: 'Ошибка инициализации',
				description: error.message,
				mode: 'live',
				queries: [],
			},
			null
		)
		document.body.dataset.labReady = 'error'
		document.body.dataset.labError = error.message
		showToast(error.message, true)
	}
}

bootstrap()
