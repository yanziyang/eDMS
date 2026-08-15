# AGENTS.md

Instructions for AI coding agents (OpenCode, Claude Code, Cursor, or any other agent that reads this file) working in this repository. Keep this file itself short — it's a map, not the territory. Detail lives in `doc/` and is loaded on demand per the table in [§2](#2-progressive-disclosure--where-to-look).

## 1. Project Snapshot

**eDMS** is an internal enterprise document management system — SharePoint Online's key functions (sites, libraries, folders, documents, versioning, check-out/check-in, permissions, search, recycle bin, audit trail), for internal use only, no anonymous/external sharing. Full context: [`doc/functional-spec.md`](doc/functional-spec.md) §1–§2.

**Repository state — read before doing anything else:** the production `server/` (.NET 10) and `client/` (React/Vite) now exist. Phase 1 (M0–M9) is substantially built but **not fully done** — several BE endpoints and a number of FE detail-panels/dialogs/admin pages are still open. Pick up at the first remaining `Not Started`/`In Progress` task in **`doc/ImplementationPlan V1.1.md`** (the active plan — it starts with an M10/M11 close-out of everything Phase 1 left unfinished, then Phase 2). `doc/ImplementationPlan V1.0.md` is the archived original Phase 1 plan — historical reference only, do not work from it.

| Path | What it is | Status |
|---|---|---|
| `doc/functional-spec.md` / `.html` | Requirements, data model, API surface, roadmap | Source of truth — done |
| `doc/technical-design-spec.md` / `.html` | Architecture, schema DDL, class-level design, deployment | Source of truth — done |
| `doc/ImplementationPlan V1.1.md` | **Active** sequenced, dependency-ordered task list (M10+: Phase 1 close-out, then Phase 2) with a live Status column | **Read this to find your next task** |
| `doc/ImplementationPlan V1.0.md` | Archived Phase 1 (M0–M9) plan, frozen at handoff | Historical reference only — superseded |
| `prototype(html)/` | Clickable UX/IA reference (vanilla HTML/CSS/JS mimicking shadcn) | Reference only — **see §8, do not port its code** |
| `server/` | .NET solution (Domain/Application/Infrastructure/Api + tests) | Exists — EF Core migrations apply against local Postgres |
| `client/` | React/Vite app | Exists — auth, sites, libraries, documents, search wired to the real API |

**Your very next action, every session:** open `doc/ImplementationPlan V1.1.md`, find the first task whose Status isn't `Done` and whose dependencies are, and do that.

## 2. Progressive Disclosure — Where to Look

Don't load the full specs into context speculatively. Look up the row that matches what you're doing, then read *only* that section.

| Before you... | Read |
|---|---|
| Pick your next task | **`doc/ImplementationPlan V1.1.md`** — find the first `Not Started` task whose dependencies are `Done` |
| Touch scope, add/remove a feature | FS §2 (Goals/Non-Goals), the relevant `FR-*` group in FS §6 |
| Design or migrate the data model | FS §8 (logical model), **TDS §6** (physical DDL, indexes) |
| Implement any authorization check | FS §9 (algorithm), **TDS §5.3, §5.6, §6.3** (implementation + the recursive CTE) |
| Add/change an API endpoint | FS §10 (surface + conventions), **TDS §8** (DTO shapes) |
| Build a frontend route/page | FS §11, **TDS §7**, and `prototype(html)/` for the intended UX flow |
| Implement login, tokens, or SSO | FS §6.1 (`AUTH` requirements), **TDS §5.5** (JWT/refresh-rotation design) |
| Implement upload, versioning, or storage | FS §13, **TDS §5.4** |
| Touch CI/CD, Docker, or environments | **TDS §11** |
| Write any test | **TDS §12** |
| Unsure if something is MVP or later | FS §15 (Phase 1/2/3 roadmap) — **default to Phase 1 unless told otherwise** |
| A decision seems missing | FS §16 (Assumptions) and TDS §2.4 (ADR log) — it may already be answered there |

`FR-XXXX-##` (e.g. `FR-VER-05`) and `ADR-#` are the stable IDs used across both specs and should be referenced in commits/PRs/comments — see §7.

## 3. Tech Stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Frontend | React + Vite, strict TypeScript, React Router |
| Design system | shadcn/ui |
| Styling | Tailwind CSS 4 |
| Backend | .NET 10, ASP.NET Core Web API (controllers, not Minimal APIs — ADR-3), Entity Framework Core |
| Database | PostgreSQL |
| Auth | Database (local) auth now; SAML2/OIDC federation later (FR-AUTH-09/10) |

Supporting libraries and the rationale for each are in FS §3 and TDS §2.4 (ADR table) — don't swap MediatR, Mapster, TanStack Query, Zustand, etc. for alternatives without a good reason recorded as a new ADR in TDS §2.4.

## 4. Repository Layout (target)

```
eDMS/
  doc/                    # specs — read, don't edit unless the spec itself is wrong
  prototype(html)/        # UX reference — read, don't port
  server/
    eDMS.sln
    src/eDMS.Domain/          # zero project references
    src/eDMS.Application/     # -> Domain only
    src/eDMS.Infrastructure/  # -> Application, Domain
    src/eDMS.Api/             # -> all three
    tests/eDMS.Domain.UnitTests/
    tests/eDMS.Application.UnitTests/
    tests/eDMS.IntegrationTests/
  client/
    src/app/  src/components/  src/features/  src/lib/  src/stores/  src/types/
  .github/workflows/
  docker-compose.yml
```

Full rationale: TDS §3. The dependency direction above is **load-bearing** (TDS §2.3) — a CI architecture test should fail the build if `Domain` ever references outward.

## 5. Bootstrapping the Solution (do this once, first)

Verify exact flags against your installed SDK/CLI versions — these are the target shapes per TDS §3, not guaranteed-current copy-paste:

```bash
# --- Backend (TDS §3.1) ---
cd server
dotnet new sln -n eDMS
dotnet new classlib -n eDMS.Domain -o src/eDMS.Domain
dotnet new classlib -n eDMS.Application -o src/eDMS.Application
dotnet new classlib -n eDMS.Infrastructure -o src/eDMS.Infrastructure
dotnet new webapi -n eDMS.Api -o src/eDMS.Api --use-controllers   # ADR-3
dotnet new xunit -n eDMS.Domain.UnitTests -o tests/eDMS.Domain.UnitTests
dotnet new xunit -n eDMS.Application.UnitTests -o tests/eDMS.Application.UnitTests
dotnet new xunit -n eDMS.IntegrationTests -o tests/eDMS.IntegrationTests
dotnet sln add src/**/*.csproj tests/**/*.csproj

dotnet add src/eDMS.Application reference src/eDMS.Domain
dotnet add src/eDMS.Infrastructure reference src/eDMS.Application src/eDMS.Domain
dotnet add src/eDMS.Api reference src/eDMS.Application src/eDMS.Infrastructure src/eDMS.Domain

# --- Frontend (TDS §7.1) ---
npm create vite@latest client -- --template react-ts
cd client
npx shadcn@latest init
npm install tailwindcss @tailwindcss/vite
npm install react-router-dom @tanstack/react-query zustand react-hook-form zod
```

## 6. Everyday Commands (once scaffolded)

```bash
# Backend
dotnet build server/eDMS.sln
dotnet test server/eDMS.sln
dotnet ef migrations add <Name> -p server/src/eDMS.Infrastructure -s server/src/eDMS.Api   # TDS §6.4
dotnet ef database update  -p server/src/eDMS.Infrastructure -s server/src/eDMS.Api

# Frontend
cd client && npm run dev
cd client && npm run build
cd client && npm run lint
cd client && npm test              # Vitest — TDS §12.2
cd client && npx playwright test   # E2E — TDS §12.2

# Full local stack (Postgres + API + Web + Mailhog) — TDS §11.2
docker compose up -d
```

Never run migrations from application startup outside local dev — see §7, rule 3.

## 7. Non-Negotiable Rules

These are the things most likely to be silently violated by an agent working section-by-section without the full spec loaded. They are restated here because getting them wrong is expensive to unwind later.

1. **Authorization is server-authoritative.** Every mutating request goes through `AuthorizationBehavior` → `IPermissionResolver` (TDS §5.2, §5.3, §5.6). Hiding a button in the frontend is UX polish, never the security boundary (FS §9 closing bullet, TDS §10.1).
2. **The audit log is immutable.** No `UPDATE`/`DELETE` on `audit_log_entries`, ever — enforced at the DB grant level too (TDS §6.2, FR-AUDIT-04), not just by omitting it from the API.
3. **Never auto-migrate a non-dev database from application startup.** Migrations run as an explicit CI/CD step before the new API version deploys (TDS §6.4, §11.3).
4. **Refresh tokens are stored only as a hash**, delivered only via an httpOnly/Secure/SameSite=Strict cookie. Access tokens live in frontend memory only — never `localStorage` (TDS §5.5, §7.3).
5. **Soft delete goes through the EF Core global query filter.** Don't hand-roll `WHERE is_deleted = false` in ad hoc queries (§4 cross-cutting conventions in TDS).
6. **File content-type is sniffed server-side from magic bytes.** Never trust the client's `Content-Type` header (TDS §5.4, §10.2).
7. **Every command/query has a validator.** Don't skip it because "the frontend already checks this" (TDS §5.2 pipeline behaviors).
8. **No anonymous or external sharing, ever.** Every principal is an internal `User` or `Group` (FS §2.2). This is a scope boundary, not an oversight — don't add a public-link feature without an explicit spec change.
9. **Don't build ahead of the roadmap.** Check FS §15 before implementing something — Phase 2/3 items (content types, SSO, org-wide links, etc.) aren't needed for a working Phase 1 system.

## 8. The `prototype(html)/` Folder

This is a **hand-built vanilla HTML/CSS/JS mockup**, not real shadcn/React/Tailwind code — it exists so stakeholders could click through the intended UX before any real code was written. Use it to understand:

- Information architecture and navigation shape (mirror its route structure — TDS §7.2 does this deliberately)
- Interaction patterns (the document details panel's tabs, the permission "break inheritance" flow, the upload dialog, the 4-theme switcher)
- Sample data shapes (`prototype(html)/assets/data.js` is a reasonable model for seed/demo data — TDS §6.5)

Do **not** copy its CSS, its DOM-templating JS, or its component structure into `client/` — that code deliberately avoids a build step and doesn't use React, shadcn, or Tailwind at all. Rebuild the same UX with the real stack.

## 9. Working Process / Definition of Done

- Reference `FR-XXXX-##` IDs and `ADR-#` numbers in commits and PR descriptions where applicable (e.g. `feat: implement check-out/check-in (FR-VER-05..08)`).
- Conventional Commits style (`feat:`, `fix:`, `refactor:`, …) — TDS §13.3.
- Before calling a change done:
  - [ ] Respects the layering/dependency rules (§4 / TDS §2.3) — no inward-only project referencing an outward layer.
  - [ ] New/changed use case has a validator, and is authorized via the pipeline if it mutates state (TDS §5.2).
  - [ ] Tests added per TDS §12 (unit for Domain/Application logic, integration for anything touching the DB or an HTTP round-trip).
  - [ ] `dotnet build` + `dotnet test`, and `npm run build` + `npm test` + `npm run lint`, all pass locally.
  - [ ] No secrets committed — new config values go in `.env.example` with a placeholder, real values stay out of source control (TDS §11.4).

## 10. Explicitly Out of Scope

Real-time co-authoring, desktop sync client, mobile apps, workflow/approval engine, e-signature, retention/legal hold/eDiscovery, anonymous or external sharing, wiki/lists/news/Teams integration, multi-tenant SaaS concerns. Full list with reasoning: FS §2.2. If a request seems to need one of these, flag it rather than quietly building it.

## 11. When the Spec Is Silent or Conflicting

1. Check FS §16 (Assumptions) and TDS §2.4 (ADR log) first — many "missing" decisions are already answered there.
2. For a small, local implementation detail with no real behavioral ambiguity: make the smallest reasonable decision consistent with the existing ADRs and this file's rules, and note what you decided and why in the PR description.
3. For anything touching scope, security, or the data model: don't guess — surface the gap instead of resolving it silently.
4. If you add a new architecturally significant decision, add it to TDS §2.4 as the next `ADR-#` rather than leaving it undocumented in code alone.

## 12. Supplementary Reference Material

`.agents/skills/shadcn/` and `.agents/skills/migrate-radix-to-base/` (mirrored under `.claude/skills/`) contain detailed shadcn/ui usage documentation installed for Claude Code's Skill mechanism. If your tool doesn't support Skill invocation, the markdown files under those directories are still plain, useful reading on shadcn conventions, composition patterns, and styling rules.

If a `CLAUDE.md` or other tool-specific instruction file is ever added to this repo, it should point back to this file rather than duplicate it — this file is the tool-agnostic source of truth for repo-level agent guidance.
