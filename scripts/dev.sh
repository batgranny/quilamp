#!/bin/bash

# Kill any existing Vite or Electron processes
pkill -f vite || true
pkill -f electron || true

# Start Vite dev server in the background
npm run dev &

# Wait for Vite to be ready (usually takes a few seconds)
echo "Waiting for Vite dev server..."
sleep 3

# Start Electron in development mode
echo "Starting Electron..."
export NODE_ENV=development
npx electron .
