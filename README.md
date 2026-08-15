# eDMS

**eDMS** is an internal enterprise document management system — the key functions of SharePoint Online (sites, libraries, folders, documents, versioning, check-out/check-in, permissions, search, recycle bin, audit trail), for internal use only. No anonymous or external sharing.

**Status:** specifications and clickable prototypes are complete. The production `server/` (ASP.NET Core + PostgreSQL) and `client/` (React/Vite) are not built yet — see `doc/ImplementationPlan.md` for the sequenced task list.

## Repository layout

| Path | What it is |
|---|---|
| `doc/` | [Functional spec](doc/functional-spec.md), [technical design spec](doc/technical-design-spec.md) (HTML versions for humans), [implementation plan](doc/ImplementationPlan.md) |
| `prototype(html)/` | Clickable vanilla HTML/CSS/JS prototype — open `prototype(html)/index.html` in a browser |
| `Prototype(React)/` | Clickable React prototype using the real stack (Vite 6, React 19, TypeScript, shadcn/ui, Tailwind v4) |
| `server/`, `client/` | Production implementation — not started yet |

## Running the React prototype

Requires Node.js 20+.

```bash
cd Prototype(React)
npm install
npm run dev        # development server
npm run build      # typecheck + production build
npm run preview    # serve the production build
```

The app opens on the sign-in page. Any email/password combination signs you in as *Jordan Reyes* (System Administrator) — it runs entirely on dummy data, there is no backend.

Smoke test (headless Edge, expects `npm run preview` on port 4173):

```bash
npm run smoke
```

## Documentation

- `doc/functional-spec.md` — requirements, data model, API surface, roadmap
- `doc/technical-design-spec.md` — architecture, schema DDL, class-level design, deployment
- `doc/ImplementationPlan.md` — sequenced, dependency-ordered implementation tasks (M0–M9)
- `AGENTS.md` — guidance for AI coding agents working in this repository

## Tech stack (production)

| Layer | Choice |
|---|---|
| Frontend | React, Vite, strict TypeScript, React Router, shadcn/ui, Tailwind CSS 4 |
| Backend | .NET 10, ASP.NET Core Web API, Entity Framework Core |
| Database | PostgreSQL |
| Auth | Database (local) auth now; SAML2/OIDC federation later |
