---
name: cosoremi-portal
description: Develop, review, debug, test, secure, or operate the COSOREMI institutional portal and CMS while preserving its verified Express/EJS, PostgreSQL, Prisma 6, upload, authorization, privacy, Docker, and CI constraints.
---

# COSOREMI Portal

Use this skill for work in this repository. Repository-specific rules here take precedence over generic installed skills. Read the relevant implementation and documentation before changing behavior; useful starting points are `README.md`, `docs/tecnica/`, `app.js`, `routes/`, `services/`, `middleware/`, `prisma/schema.prisma`, and `.github/workflows/docker.yml`.

## Architecture

This is a server-rendered institutional website and CMS:

- Node.js 22.12 or newer, with Node 24 used by Docker and CI
- Express 4 and EJS
- PostgreSQL 15 or newer; Docker currently uses PostgreSQL 17
- Prisma ORM 6.19.x with the `prisma-client-js` generator
- CommonJS application code
- vanilla CSS and JavaScript
- Node's built-in test runner and Supertest

Keep controllers, services, middleware, validators, routes, views, and tests in their existing roles. Do not introduce React, Vue, Angular, Next.js, Tailwind, another frontend framework, or a client-side application architecture unless explicitly requested.

Important public routes are:

- `/`
- `/sobre-nos`
- `/linhas-de-trabalho`
- `/linhas-de-trabalho/:slug`
- `/blog`
- `/blog/:slug`
- `/galeria`
- `/doar`
- `/emergencia`
- `/contato`
- `/paginas/:slug`

The CMS is under `/admin`; login is `/admin/login`.

## Authorization and content

Roles are `SUPER_ADMIN`, `ADMIN`, and `EDITOR`. Preserve the resource permissions in `services/content.service.js` and the route checks in `routes/admin.routes.js`. Enforce authorization on the backend; hiding links or buttons is not an authorization control. Preserve the last-active-`SUPER_ADMIN` protection and session revocation after account changes.

Public editorial content is escaped plain text, with line breaks preserved. Do not enable arbitrary HTML or scripts from CMS fields. Preserve publication-state and publication-time checks for public posts.

## Settings and theme

The CMS manages the site logo, primary color, secondary color, institutional details, and calls to action. `/theme.css` is generated from settings, and public gradients use theme variables.

Primary and secondary colors must pass the existing six-digit hexadecimal validation (`#RRGGBB`). Validate stored values again before emitting CSS. Never insert raw administrator input into CSS. Keep logo uploads on the same safe image pipeline as other uploads.

## Upload security and storage

Uploads use bounded Multer memory storage followed by Sharp decoding and re-encoding. Preserve these invariants:

- one file, with a 5 MB limit and bounded fields/parts;
- JPG/JPEG, PNG, and WebP only, checked by extension, MIME type, and decoded format;
- a 25-megapixel input limit and bounded output dimensions;
- automatic rotation and WebP re-encoding without unnecessary metadata;
- UUID filenames rather than user-provided names;
- the explicit folder allowlist: `blog`, `gallery`, `pages`, and `branding`;
- cleanup of replaced, deleted, or failed new uploads where applicable.

`public/uploads` may be a Docker volume or host bind mount. Image decode/validation failures are client errors; `EACCES` and `EROFS` are storage configuration failures and must remain distinguishable. Dockerfile ownership changes do not change the ownership or permissions of a host bind mount.

## Privacy boundary

This CMS stores public institutional content and ordinary contact messages. Do not add storage for sensitive beneficiary or case data, including passports, asylum documents, detailed immigration status, detention records, medical data, or confidential legal documents. A request for those features requires a separate restricted system and a dedicated security, access-control, retention, and threat design.

## Security invariants

Preserve or improve:

- Helmet and the Content Security Policy;
- CSRF protection on every mutation, including login, logout, uploads, settings, and contact submission;
- global and endpoint-specific rate limiting;
- PostgreSQL-backed sessions, regeneration on login, HttpOnly/SameSite cookies, and Secure cookies in production;
- bcrypt password hashing and its 72-byte input boundary;
- Zod input validation and EJS output escaping;
- least-privilege backend role checks and audit logging;
- production HTTPS and correctly scoped proxy trust;
- generic error responses that do not leak secrets or database details;
- the non-root production container, dropped capabilities, and `no-new-privileges`.

Never weaken a security control merely to make a test pass.

## Prisma and PostgreSQL

This repository uses Prisma ORM 6.19.x. Do not apply Prisma 7/8 configuration, generator, driver-adapter, migration, or client initialization instructions unless a Prisma upgrade is explicitly requested.

In particular:

- keep `provider = "prisma-client-js"` in `prisma/schema.prisma`;
- keep the existing CommonJS `PrismaClient` initialization;
- do not add `@prisma/adapter-pg` or another driver adapter;
- do not replace PostgreSQL with Prisma Postgres or provision a hosted database;
- do not install or apply the `prisma-postgres`, `prisma-postgres-setup`, or `prisma-upgrade-v7` skills;
- use the installed `prisma-client-api` skill only for API guidance verified as compatible with Prisma 6.19.x.

Prisma migrations are version controlled. Use `npm run db:migrate -- --name <name>` only in development to create a migration, and `npm run db:deploy` to apply committed migrations in production. Never run destructive reset commands against production data. Do not delete or recreate PostgreSQL data unless explicitly instructed.

Keep PostgreSQL data and public uploads on separate persistent volumes. Use a dedicated, disposable database for integration tests; never point them at production or a database containing real data.

## Tests and verification

The project uses Node's built-in test runner. Preserve it and do not introduce Vitest or Jest unless explicitly requested, even if generic testing guidance recommends them.

Available checks include:

```bash
npm ci
npm run db:generate
npm run format:check
npm test
npm run test:integration
npm run db:deploy
```

Before claiming completion, run the checks relevant to the change and report their actual results. Add or update automated coverage for changes to routes, permissions, authentication, uploads, database behavior, themes, publishing, or other security-sensitive flows. Run integration tests for changes involving PostgreSQL, sessions, permissions, controllers, validation, uploads, or CMS workflows when a test database is available. A skipped integration suite does not prove database behavior.

Use Prettier and avoid unrelated refactors. Confirm that dependency versions and generated Prisma configuration did not change unless the task required them.

## Debugging

Use root-cause debugging:

1. reproduce the failure;
2. read the complete error and relevant logs;
3. identify the failing layer;
4. distinguish application faults from Docker, filesystem, database, proxy, or environment faults;
5. test one evidence-based hypothesis at a time;
6. apply the smallest appropriate fix;
7. add regression coverage when it protects meaningful behavior;
8. rerun fresh verification.

Do not make speculative patches. Do not misclassify upload-volume permission failures as invalid images.

## Docker and CI

Production containers must remain non-root, health checked, minimal, and multi-stage where appropriate. Persist only PostgreSQL data and public uploads. Keep the database on its internal network without unnecessary host exposure. Do not bake secrets into images or add `.env` files to build contexts.

Preserve the existing GitHub Actions checks, PostgreSQL integration service, Compose validation, image boundary checks, and container smoke tests. Do not silently remove or weaken a required check. When changing CI, keep least-privilege permissions, trusted or appropriately pinned actions, secret isolation, dependency caching tied to the lockfile, and database-backed integration coverage.

Validate both Compose files with `docker compose ... config --quiet` when Docker is available. Treat volume deletion as destructive; preserve database and upload volumes unless their deletion is explicitly requested.

## Accessibility and frontend work

Keep the existing EJS, CSS, and vanilla JavaScript approach. Prefer native semantic elements, bound form labels, keyboard access, visible focus, useful alternative text, a coherent heading outline, the skip link, and reduced-motion support. Check public and admin flows at narrow widths and keyboard-only where relevant. Keep CSP compatibility; do not solve frontend behavior by adding unsafe inline scripts or styles.

## Git discipline

Start future work from the requested base branch and use a dedicated feature or fix branch. Do not modify `main` directly unless explicitly requested. Keep unrelated work out of the branch, and verify the base branch has not moved before finalizing substantial changes. Do not merge a pull request unless explicitly asked.
