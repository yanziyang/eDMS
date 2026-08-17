# eDMS

**eDMS** is an internal enterprise document management system implementing the key functions of SharePoint Online: sites, libraries, folders, documents, versioning, check-out/check-in, granular permissions, full-text search, recycle bin, and an immutable audit trail. It is for internal use only; there is no anonymous or external sharing.

## Status

**Phase 2 (M0–M19) is complete.** The Phase 1 SharePoint-style core is joined by content types and required metadata, Office preview, resumable chunked uploads, notifications and alert preferences, authenticated organization-wide share links, PDF/Office content indexing, and persisted light/dark theme selection. Quality gates: backend and frontend builds/tests pass, validator coverage is enforced by the application test suite, axe scans are clean across the Phase 2 surfaces, responsive mobile/tablet flows are verified, and the Playwright suite covers the Phase 2 acceptance paths against the real API. See [doc/ImplementationPlan V1.1.md](doc/ImplementationPlan%20V1.1.md) (superseded, historical) for the completed milestone record.

**Phase 3 (SAML2/OIDC federation) is complete.** M20–M23 delivered signed OIDC and SAML flows, just-in-time provisioning, one-time handoff exchange, SSO enforcement, and the dedicated security/accessibility/responsive hardening passes. See [doc/ImplementationPlan V1.2.md](doc/ImplementationPlan%20V1.2.md) for the milestone record. [doc/ImplementationPlan V1.0.md](doc/ImplementationPlan%20V1.0.md) is the archived original Phase 1 plan.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React, Vite, strict TypeScript, React Router, shadcn/ui, Tailwind CSS 4, TanStack Query |
| Backend | .NET 10, ASP.NET Core Web API (controllers), MediatR, FluentValidation, Mapster, Serilog |
| Data access | Entity Framework Core with provider packages for PostgreSQL, SQL Server, MySQL, and SQLite; `EFCore.NamingConventions` |
| Database | Switched via `Database:Provider` — PostgreSQL (production), SQL Server, MySQL, SQLite (local dev default) |
| Auth | Local database auth plus completed SAML2/OIDC federation (FR-AUTH-09/10/11) |

## Repository layout

| Path | What it is |
|---|---|
| `doc/` | [Functional spec](doc/functional-spec.md), [technical design spec](doc/technical-design-spec.md), [implementation plan](doc/ImplementationPlan%20V1.2.md) |
| `prototype(html)/` | Clickable vanilla HTML/CSS/JS prototype (reference only) |
| `Prototype(React)/` | Clickable React prototype using the real stack |
| `server/` | .NET solution (Domain, Application, Infrastructure, one migrations project per database provider, Api, tests) |
| `client/` | React/Vite app (auth, sites, libraries, documents, search) |
| `.github/workflows/` | CI pipeline |
| `docker-compose.yml` | Local Postgres + Mailhog + LibreOffice preview + Apache Tika extraction + API + web stack |

## Getting started

### Docker Compose (one command)

```bash
docker compose up -d
```

This starts PostgreSQL, Mailhog, the LibreOffice preview converter, Apache Tika text extractor, the API (http://localhost:5080), and the web app (http://localhost:5173). The Compose stack runs the API against PostgreSQL (`Database__Provider: Postgres`); the converter and extractor have bounded resources and health checks, and the API waits for them before starting. A System Administrator is seeded from the Compose environment:

- Email: `admin@edms.local`
- Password: `ChangeMe123!`

The API migrates the database on startup in Development and forces a password reset on first login.

### Bare metal

Requirements: .NET 10 SDK, Node.js 20+. **No database install needed** — local Development defaults to SQLite (`edms-dev.db` is created in `server/src/eDMS.Api/`, gitignored).

1. Optionally set seed credentials and JWT keys as environment variables (see [.env.example](.env.example)).
2. Run the API (migrates and seeds on startup):

   ```bash
   cd server
   dotnet run --project src/eDMS.Api
   ```

3. Run the web app in another terminal:

   ```bash
   cd client
   npm install
   export VITE_API_BASE_URL=http://localhost:5188/api/v1
   npm run dev
   ```

4. Open the Vite URL (default http://localhost:5173) and sign in with the seeded administrator.

`dotnet run` serves the API on port 5188, so point `VITE_API_BASE_URL` at it (the Compose path above uses 5080). To use another database, set `Database__Provider` (`Postgres`, `SqlServer`, `MySql`, or `Sqlite`) and `ConnectionStrings__Default` for it. The API also reads `Seed__AdminEmail`, `Seed__AdminTempPassword`, `Jwt__PrivateKey`, `Jwt__PublicKey`, and `Smtp__*` from environment variables. No real secrets are committed.

## Testing

```bash
# Backend unit + integration tests
dotnet test server/eDMS.sln

# Backend coverage gate (fails below 90% real-code line coverage)
dotnet test server/eDMS.sln --collect:"XPlat Code Coverage" --settings server/coverlet.runsettings

# Frontend unit tests (Vitest)
cd client && npm test

# Frontend coverage gate (fails below 90% lines/statements/functions/branches)
cd client && npm run test:coverage

# Production build + typecheck
cd client && npm run build

# End-to-end tests (Playwright, headless Edge, real API)
# Defaults to PostgreSQL; set E2E_DATABASE_PROVIDER=Sqlite to run with no database server.
cd client && npx playwright test
cd client && E2E_DATABASE_PROVIDER=Sqlite npx playwright test   # PowerShell: $env:E2E_DATABASE_PROVIDER='Sqlite'; npx playwright test
```

The Playwright suite resets the E2E database (a dedicated `edms_e2e` Postgres database, or a fresh `e2e.db` SQLite file), seeds a System Administrator, and covers 33 scenarios: login, browse, upload, download, check-out/in, move/copy, share, permission-filtered search, document details (rename/versions/restore), recycle-bin restore, admin pages, accessibility (axe), and responsive layouts.

## Documentation

- [Functional spec](doc/functional-spec.md) - requirements, data model, API surface, roadmap
- [Technical design spec](doc/technical-design-spec.md) - architecture, schema DDL, class design, deployment
- [Implementation plan](doc/ImplementationPlan%20V1.2.md) - sequenced tasks with live status ([V1.1](doc/ImplementationPlan%20V1.1.md), [V1.0](doc/ImplementationPlan%20V1.0.md) superseded/archived)
- [AGENTS.md](AGENTS.md) - guidance for coding agents working in this repository

## Out of scope

Real-time co-authoring, desktop sync, mobile apps, workflow/approval engine, e-signature, retention/legal hold, anonymous or external sharing, and multi-tenant SaaS concerns are explicitly out of scope. See the functional spec for the full list and the Phase 2/3 backlog.
