#!/bin/bash
# Script to build the project and run the Electron app

echo "Installing dependencies..."
npm install

echo "Building project..."
npm run build

echo "Starting Electron app..."
npm start
