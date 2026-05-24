# YDB Drizzle Adapter Lab

Interactive advanced TypeScript lab for `@ydbjs/drizzle-adapter` and `drizzle-orm`.

This lab is intentionally larger than a starter example: it is a small local web app with TypeScript server/database code that shows generated YQL, executed operations, results, and recent query traces. For a compact CLI example, use [`examples/drizzle-adapter`](../drizzle-adapter/).

## What It Demonstrates

- Schema declarations with `ydbTable()`, indexes, relations, table options, TTL, partitions, and column families.
- Schema bootstrap through `migrate()` and inline migration operations.
- CRUD for several related tables: `insert`, `onDuplicateKeyUpdate`, `upsert`, `replace`, `update`, `delete`.
- Batch mutations: `batchUpdate` and `batchDelete`.
- Reads through `select`, `prepare().get()`, `prepare().all()`, `prepare().values()`, `$count`, and `db.query.*`.
- Joins, YDB semi/only/exclusion joins, CTEs, set operators, `selectDistinct`, and `selectDistinctOn`.
- YDB-specific SELECT helpers: `fromValues`, `valuesTable`, `fromAsTable`, `without`, `sample`, `tableSample`, `windowDefinition`, `groupCompactBy`, `assumeOrderBy`, and `intoResult`.
- Raw execution helpers: `db.execute`, `db.all`, `db.get`, `db.values`, `transaction`, and `yqlScript`.
- DDL builders for create/drop/rename table, columns, indexes, table options, changefeeds, `SHOW CREATE`, and `ANALYZE`.

Preview-only scenarios are marked in the UI. They render valid adapter calls and YQL, but are not executed by default because local YDB versions can differ in support for some YQL features.

## Run

```bash
cd examples/drizzle-adapter-lab
npm install
npm run db:up
npm start
```

Open:

```text
http://localhost:3000
```

YDB UI:

```text
http://localhost:8765
```

By default the app uses:

```text
grpc://127.0.0.1:2136/local
```

Override it with `YDB_CONNECTION_STRING` if needed.

## First Steps

1. Open `http://localhost:3000`.
2. In `Схема и DDL`, click `Пересоздать схему`.
3. Click `Засеять данные`.
4. Use the CRUD workspace for users, projects, tasks, and batch actions.
5. Open `Сценарии и методы` to run relations, joins, CTEs, set operators, raw SQL, transactions, scripts, and DDL previews.
6. Check `Инспектор` after each operation: it shows the adapter call, generated YQL, result, and trace.

## Scripts

```bash
npm run db:up
npm run db:setup
npm run db:demo
npm run check
npm run db:down
```

## Documentation

- https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/
- https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/examples
- https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/database-api
- https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/query-builders
- https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/yql-helpers
- https://ydb-platform.github.io/ydb-js-sdk/guide/drizzle-adapter/migrations-ddl
