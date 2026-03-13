#!/bin/bash
# Script to build the .dmg file for macOS

echo "Installing dependencies..."
npm install

echo "Building DMG..."
npm run dist
