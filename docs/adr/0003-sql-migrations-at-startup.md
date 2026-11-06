# 0003: Plain SQL migrations applied at startup under an advisory lock

Status: accepted

## Context

The schema will grow to include time-partitioned event tables and rollup tables, which ORMs generally express as raw SQL anyway. Deployment platforms also differ in how they start the app. The first production deploy ran the container with its own start command, skipped the migration step in the Dockerfile and left the database empty.

## Decision

- Keep the schema as numbered `.sql` files in `services/api/migrations`, applied in filename order. Applied names are recorded in a `migrations` table.
- Run the migrations from the application's own startup code, before it starts listening. Starting the API is therefore always enough to bring the schema up to date, whatever launches it.
- Apply all pending files in **one transaction** and take a `pg_advisory_xact_lock` first, so instances that start at the same time run the migrations one after another, and a failure leaves nothing half applied.
- No ORM. Queries use the `postgres` driver with tagged templates, which parameterize values automatically.
- Tests use a separate `crowd_pulse_test` database that runs the same migrations, and they refuse to run against any database whose name does not end in `_test`.

## Consequences

Good:

- The deployed schema always matches the deployed code, with no separate release step.
- If a migration fails, the app does not start and the error shows up in the deploy logs.

Costs and limits:

- There are no down migrations. Mistakes are fixed by a new migration, so changes should be additive first (add a column, deploy, then remove the old one later).
- A slow migration delays startup. Long running changes would need a separate job.
- Hand-written SQL means no generated types. Row shapes are described where the queries are used.

## Alternatives considered

- **Prisma or Drizzle**: type generation and migrations are convenient, but partitioning and rollups would still need raw SQL, and the SQL experience is part of the point of this project.
- **A separate migration job or release phase**: cleaner for large teams, but easy to forget or misconfigure on small platforms, which is exactly what went wrong once.
