# COSOREMI repository instructions

For development, review, debugging, database, Docker, CI, testing, accessibility, security, or content-management work in this repository, read and follow `.agents/skills/cosoremi-portal/SKILL.md`. Its repository-specific rules take precedence over generic installed skills.

This repository uses Prisma ORM 6.19.x. Do not apply Prisma 7/8 configuration, generator, driver-adapter, migration, or client initialization instructions unless a Prisma upgrade is explicitly requested.

Preserve the server-rendered Express/EJS architecture and the existing Node built-in test runner. Do not introduce a frontend framework, Tailwind, Vitest, or Jest unless explicitly requested.

Application JavaScript uses native Node.js ESM under `"type": "module"`. Keep explicit `.js` extensions on relative imports and reserve `.cjs` for documented infrastructure helpers that deliberately remain CommonJS.
