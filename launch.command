#!/bin/bash
# Change to the frontend directory relative to this script's location
cd "$(dirname "$0")/frontend"

echo "============================================="
echo " Starting Atrium Local Planner...            "
echo "============================================="
echo ""

# Start the Vite server in the background
npm run dev &
SERVER_PID=$!

# Wait 2 seconds for server to start, then open the browser
sleep 2
open http://localhost:3000

echo ""
echo "App launched at http://localhost:3000."
echo "Keep this window open to run the server."
echo "Close this window (or press Ctrl+C) to stop the app."
echo ""

# Ensure the background server stops when this terminal process exits
trap "kill $SERVER_PID" EXIT
wait
