# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start with nodemon (auto-reload)
npm start            # Production start

# Database
docker compose up -d          # Start PostgreSQL + Adminer (localhost:8080)
npm run db:setup              # Run migrations + seeds in order
docker compose exec db psql -U dental_user -d dental_day_db  # psql shell
```

No test runner is configured yet — the `tests/` directory exists but has no framework or scripts.

## Environment setup

Copy `.env` from `.env.example` (not yet committed). Required variables validated on startup via `src/config/env.js`:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql://dental_user:dental_pass@localhost:5432/dental_day_db` for local Docker |
| `JWT_SECRET` | min 32 chars |
| `JWT_REFRESH_SECRET` | min 32 chars |
| `JWT_EXPIRES_IN` | default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | default `7d` |
| `PORT` | default `4000` |
| `CORS_ORIGIN` | default `http://localhost:5173` |

The app refuses to start if required env vars are missing or invalid.

## Architecture

**Modular monolith** — each business domain lives in `src/modules/<name>/` with four files following the same pattern:

```
auth.routes.js       → Express router, middleware wiring
auth.controller.js   → HTTP layer only (parse req, call service, send res)
auth.service.js      → Business logic, orchestrates repository + utils
auth.repository.js   → All SQL queries for this module, no business logic
auth.validation.js   → Joi schemas for request body validation
```

**Shared infrastructure** (`src/shared/`):
- `errors/app-error.js` — `AppError` base class + typed subclasses (`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `BadRequestError`). Throw these from services; the global error handler in `app.js` translates them to HTTP responses.
- `shared/utils/token.util.js` — `generateAccessToken`, `generateRefreshToken`, `verifyAccessToken`
- `shared/utils/password.util.js` — `hashPassword`, `comparePassword` (bcryptjs)

**Middleware** (`src/middlewares/`):
- `auth.middleware.js` — verifies Bearer JWT, loads `req.user = { id, email, role }`
- `rbac.middleware.js` — `authorize(...roles)` factory, checks `req.user.role` against allowed roles (must run after `authenticate`)
- `validate.middleware.js` — wraps a Joi schema into Express middleware

**Database** (`src/config/database.js`): single `pg.Pool` instance. Use `db.query(sql, params)` for regular queries; `db.getClient()` for transactions. Always use parameterized queries (`$1`, `$2`) — never string-concatenate user input into SQL.

**Route mounting**: all modules mount at `/api/v1/<module>` in `app.js`.

## Database schema domains

The PostgreSQL schema (migration `001_initial_schema.sql`) covers 7 domains:
1. **Auth** — `roles`, `users`, `staff`
2. **Patients** — `patients` (with soft delete in migration 002)
3. **Appointments** — `appointments`, `appointment_statuses`. Has a `btree_gist` EXCLUDE constraint enforcing no overlapping appointments per staff member.
4. **Clinical records** — `clinical_records`, `dental_chart_entries`
5. **Billing** — `invoices`, `invoice_items`, `treatment_catalog`. `invoices.final_amount` and `invoice_items.subtotal` are PostgreSQL generated columns.
6. **Notifications** — `notifications`
7. **Audit** — `audit_logs`

All PKs are UUIDs (`gen_random_uuid()`). Tables with mutable data have `updated_at` maintained by the `fn_set_updated_at()` trigger.

## Adding a new module

Follow the `auth` module as the reference. Create `src/modules/<name>/` with the four-file pattern, mount the router in `app.js` under `/api/v1/<name>`, and add the SQL migration as `migrations/00N_<description>.sql`.
