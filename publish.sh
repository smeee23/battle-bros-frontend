#!/bin/sh
set -eu

output_dir="dist"
mkdir -p "$output_dir"
node scripts/generate-runtime-config.mjs --output runtime-config.js
cp index.html "$output_dir/index.html"
cp runtime-config.js "$output_dir/runtime-config.js"
for asset_dir in vendor models sounds crowd schemas assets; do
  rm -rf "$output_dir/$asset_dir"
  cp -R "$asset_dir" "$output_dir/$asset_dir"
done
cp README.md LICENSE "$output_dir/"
printf '%s\n' 'BattleBros frontend build complete.'
