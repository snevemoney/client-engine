#!/bin/bash
# E2E preflight: free port 3000 so Playwright can start Client Engine.
# Run before playwright test when not using USE_EXISTING_SERVER.
PID=$(lsof -ti :3000 2>/dev/null)
if [ -n "$PID" ]; then
  kill -9 $PID 2>/dev/null || true
  sleep 2
fi
