# Neon database setup and migration

The application uses Neon Postgres over HTTPS through `@neondatabase/serverless`.
`lib/db.ts` is server-only. Public pages use ISR; the deck builder requests the
same-origin `/api/tier-entries` endpoint. All writes require the existing Hive
admin JWT and use parameterized SQL. Replacing an edition's rankings happens in
one transaction, with a parent-row lock to serialize concurrent saves.

## Development

Copy `.env.example` to `.env.local`, supply `DATABASE_URL` and `JWT_SECRET`, then:

```sh
npm ci
npm run db:migrate
npm run dev
```

Keep the existing `JWT_SECRET` when cutting over so existing admin sessions work.
`OPENSEA_API_KEY`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT`
retain their existing meanings. No Supabase keys are needed by the application.
Never prefix `DATABASE_URL` or `JWT_SECRET` with `NEXT_PUBLIC_`.

In the managed cloud environment, enable `NODE_USE_ENV_PROXY=1` and use a writable
npm/config cache (`npm_config_cache=/tmp/spltiers-npm-cache`,
`XDG_CONFIG_HOME=/tmp/spltiers-next-config`). `NEXT_TELEMETRY_DISABLED=1` disables
Next.js telemetry. The driver uses the configured database hostname's `/sql`
endpoint, so no native Postgres TCP access is needed. Outside that environment,
normal Node/Next.js commands work without these cloud-specific settings.

## One-time import from Supabase

Use the destination's connection string. Development and production can point to
different databases; migrate each intended destination separately. Keep admin
editing paused until the production cutover is verified.

1. Run `npm run db:migrate`.
2. Temporarily supply source `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` alongside the destination connection string.
3. Run `npm run db:import-supabase -- --once`.
4. Run `npm run db:import-supabase -- --verify` before cutover if editing could
   have continued on the source.
5. Build and test, then remove Supabase variables from hosting settings.

The importer paginates source tables, checks exact counts, saves a local backup
under gitignored `.migration-backups/`, and imports both tables atomically.
It preserves IDs, all values and timestamp precision; it compares every row
before marking the import complete. It refuses to overwrite a nonempty target.
`--once` skips a completed import without needing source credentials, so a failed
build can be retried safely. Supabase is never modified by the importer.

For a Vercel cutover, temporarily use this build command with production-scoped
source keys and the production Neon URL already configured:

```sh
npm run db:migrate && npm run db:import-supabase -- --once && npm run build
```

After confirming the import and deployment, restore the regular build command
and remove the three Supabase environment variables. Future schema changes
should be applied using `db:migrate` before deploying code that needs them.
Keep the old Supabase project until the live site and admin saves are verified;
project deletion is a separate, irreversible step.

## Verification

```sh
npm run typecheck
npm run lint
npm run build
npm run test:db
```

`test:db` uses a running local server (`TEST_BASE_URL`, default
`http://localhost:3000`) and the configured Neon database. It creates a temporary
edition, tests authenticated/unauthenticated API requests, saves/reloads/clears
rankings, verifies rollback on a database error, toggles publication, checks the
sitemap, and removes its test edition in a `finally` block. Run it against a
development database.

`docs/kickoff-prompts.md` and binary specifications describe the original project
and are historical; the current database setup is documented here.
