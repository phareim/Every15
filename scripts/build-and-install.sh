#!/bin/bash
set -e

cd "$(dirname "$0")/../Every15"

echo "Generating Xcode project..."
xcodegen generate

echo "Building Every15..."
xcodebuild -project Every15.xcodeproj \
  -scheme Every15_macOS \
  -destination "platform=macOS" \
  -configuration Release \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  build

# Find the built app
BUILD_DIR=$(xcodebuild -project Every15.xcodeproj -scheme Every15_macOS -showBuildSettings -configuration Release 2>/dev/null | grep " BUILT_PRODUCTS_DIR = " | sed 's/.*= //')
APP_PATH="$BUILD_DIR/Every15.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: Built app not found at $APP_PATH"
  exit 1
fi

echo "Installing to /Applications..."
# Kill running instance
pkill -x Every15 2>/dev/null || true
sleep 1

# Copy to Applications
rm -rf /Applications/Every15.app
cp -R "$APP_PATH" /Applications/Every15.app

echo "Done! Every15 installed to /Applications/Every15.app"
echo "Opening..."
open /Applications/Every15.app
