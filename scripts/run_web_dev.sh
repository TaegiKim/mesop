(lsof -t -i:4200 | xargs kill) || true && \
MESOP_SERVER_HOST="http://localhost:32123" ibazel run //mesop/web/src/app/dev:server
