#!/usr/bin/env bash
set -euo pipefail

setline_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]] || ! command -v xcodebuild >/dev/null; then
  echo 'This build requires macOS with Xcode. Use the included GitHub Actions workflow.' >&2
  exit 1
fi

if [[ ! -d "$setline_root/ios/Setline.xcworkspace" ]]; then
  echo 'First run Expo prebuild and pod install to create ios/Setline.xcworkspace.' >&2
  exit 1
fi

setline_workdir="$(mktemp -d "${TMPDIR:-/tmp}/setline-ios.XXXXXX")"
trap 'rm -rf "$setline_workdir"' EXIT

# Build a Release binary for physical iPhones. Personal signing happens later on
# the user's computer, so this build does not use certificates or provisioning.
xcodebuild \
  -workspace "$setline_root/ios/Setline.xcworkspace" \
  -scheme Setline \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$setline_workdir/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  'CODE_SIGN_IDENTITY=' \
  build

setline_app="$setline_workdir/DerivedData/Build/Products/Release-iphoneos/Setline.app"
if [[ ! -f "$setline_app/Setline" || ! -s "$setline_app/main.jsbundle" ]]; then
  echo 'The Release iPhone app or its bundled JavaScript is missing.' >&2
  exit 1
fi

# Verify this is an arm64 device binary rather than a simulator artifact.
xcrun lipo -verify_arch arm64 "$setline_app/Setline"
setline_platform="$(/usr/libexec/PlistBuddy -c 'Print :DTPlatformName' "$setline_app/Info.plist")"
if [[ "$setline_platform" != 'iphoneos' ]]; then
  echo 'Expected an iPhone device app; refusing to package a simulator app.' >&2
  exit 1
fi

mkdir -p "$setline_workdir/Payload" "$setline_root/artifacts"
ditto "$setline_app" "$setline_workdir/Payload/Setline.app"
ditto -c -k --keepParent "$setline_workdir/Payload" "$setline_workdir/Setline-unsigned.ipa"
cp "$setline_workdir/Setline-unsigned.ipa" "$setline_root/artifacts/Setline-unsigned.ipa"
echo "Created $setline_root/artifacts/Setline-unsigned.ipa"
echo 'This file must be personally signed before it can be installed on an iPhone.'
