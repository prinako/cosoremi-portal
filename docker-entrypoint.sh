#!/bin/sh
set -eu

# Maintenance commands (seed, migrate, shell) run exactly as requested.
if { [ "${1:-}" = "node" ] && [ "${2:-}" = "server.js" ]; } || \
   { [ "${1:-}" = "npm" ] && [ "${2:-}" = "run" ] && [ "${3:-}" = "dev" ]; }; then
  node docker/wait-for-db.cjs
  npm run db:deploy
  if [ "${NODE_ENV:-}" = "development" ]; then
    npm run db:seed
  fi
fi

exec "$@"
