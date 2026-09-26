#!/bin/sh
set -eu

sync_development_dependencies() {
  dependency_stamp='node_modules/.cosoremi-package-lock.sha256'
  expected_lock_hash="$(sha256sum package-lock.json | cut -d ' ' -f 1)"
  installed_lock_hash=''
  if [ -f "$dependency_stamp" ]; then
    installed_lock_hash="$(cat "$dependency_stamp")"
  fi
  if [ "$installed_lock_hash" != "$expected_lock_hash" ]; then
    echo 'Development dependencies changed; synchronizing node_modules.'
    npm ci
    printf '%s\n' "$expected_lock_hash" > "$dependency_stamp"
    npm run db:generate
  fi
}

# Maintenance commands (seed, migrate, shell) run exactly as requested.
if { [ "${1:-}" = "node" ] && [ "${2:-}" = "server.js" ]; } || \
   { [ "${1:-}" = "npm" ] && [ "${2:-}" = "run" ] && [ "${3:-}" = "dev" ]; }; then
  if [ "${NODE_ENV:-}" = "development" ]; then
    sync_development_dependencies
  fi
  node docker/wait-for-db.cjs
  npm run db:deploy
  if [ "${NODE_ENV:-}" = "development" ]; then
    npm run db:seed
  fi
fi

exec "$@"
