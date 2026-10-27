#!/bin/sh
# Starts a throwaway Postgres (local-only, trust auth), then the API. SIGTERM stops both.
set -e
initdb -D "$PGDATA" -U postgres --auth=trust --no-sync > /dev/null
pg_ctl -D "$PGDATA" -w -l /tmp/postgres.log start \
  -o "-c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp -c shared_buffers=16MB -c max_connections=20"
set +e

node --import tsx src/server.ts &
api=$!
trap 'kill -TERM "$api" 2> /dev/null' TERM INT
wait "$api"; status=$?
# A trapped signal interrupts wait while the API is still shutting down: wait again.
if kill -0 "$api" 2> /dev/null; then wait "$api"; status=$?; fi

pg_ctl -D "$PGDATA" -m fast stop > /dev/null
exit "$status"
