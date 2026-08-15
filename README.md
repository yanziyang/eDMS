# eDMS

**eDMS** is an internal enterprise document management system implementing the key functions of SharePoint Online: sites, libraries, folders, documents, versioning, check-out/check-in, granular permissions, full-text search, recycle bin, and an immutable audit trail. It is for internal use only; there is no anonymous or external sharing.

## Status

Phase 1 (MVP, milestones M0-M9) is substantially implemented. The backend, frontend, and end-to-end test suite are in place and green. A few M9 hardening tasks remain open (validator-coverage audit, load test, accessibility pass, responsive verification, staging dry run); the live checklist is in [doc/ImplementationPlan.md](doc/ImplementationPlan.md).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React, Vite, strict TypeScript, React Router, shadcn/ui, Tailwind CSS 4, TanStack Query |
| Backend | .NET 10, ASP.NET Core Web API (controllers), MediatR, FluentValidation, Mapster, Serilog |
| Data access | Entity Framework Core with Npgsql and `EFCore.NamingConventions` |
| Database | PostgreSQL |
| Auth | Local database auth now; SAML2/OIDC federation planned later |

## Repository layout

| Path | What it is |
|---|---|
| `doc/` | [Functional spec](doc/functional-spec.md), [technical design spec](doc/technical-design-spec.md), [implementation plan](doc/ImplementationPlan.md) |
| `prototype(html)/` | Clickable vanilla HTML/CSS/JS prototype (reference only) |
| `Prototype(React)/` | Clickable React prototype using the real stack |
| `server/` | .NET solution (Domain, Application, Infrastructure, Api, tests) |
| `client/` | React/Vite app (auth, sites, libraries, documents, search) |
| `.github/workflows/` | CI pipeline |
| `docker-compose.yml` | Local Postgres + Mailhog + API + web stack |

## Getting started

### Docker Compose (one command)

```bash
docker compose up -d
```

This starts PostgreSQL, Mailhog, the API (http://localhost:5080), and the web app (http://localhost:5173). A System Administrator is seeded from the Compose environment:

- Email: `admin@edms.local`
- Password: `ChangeMe123!`

The API migrates the database on startup in Development and forces a password reset on first login.

### Bare metal

Requirements: .NET 10 SDK, Node.js 20+, and a local PostgreSQL instance.

1. Set the connection string and seed credentials as environment variables (see [.env.example](.env.example)).
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

`dotnet run` serves the API on port 5188, so point `VITE_API_BASE_URL` at it (the Compose path above uses 5080). The API reads `ConnectionStrings__Default`, `Seed__AdminEmail`, `Seed__AdminTempPassword`, `Jwt__PrivateKey`, `Jwt__PublicKey`, and `Smtp__*` from environment variables. No real secrets are committed.

## Testing

```bash
# Backend unit + integration tests
dotnet test server/eDMS.sln

# Frontend unit tests (Vitest)
cd client && npm test

# Production build + typecheck
cd client && npm run build

# End-to-end tests (Playwright, headless Edge, real API + PostgreSQL)
cd client && npx playwright test
```

The Playwright suite resets a dedicated `edms_e2e` database, seeds a System Administrator, and covers login, browse, upload, download, check-out/in, share, and permission-filtered search.

## Documentation

- [Functional spec](doc/functional-spec.md) - requirements, data model, API surface, roadmap
- [Technical design spec](doc/technical-design-spec.md) - architecture, schema DDL, class design, deployment
- [Implementation plan](doc/ImplementationPlan.md) - sequenced tasks with live status
- [AGENTS.md](AGENTS.md) - guidance for coding agents working in this repository

## Out of scope

Real-time co-authoring, desktop sync, mobile apps, workflow/approval engine, e-signature, retention/legal hold, anonymous or external sharing, and multi-tenant SaaS concerns are explicitly out of scope. See the functional spec for the full list and the Phase 2/3 backlog.
