#!/bin/sh
set -e
rm -rf dist
cp -r app dist
SHA=$(git rev-parse --short=12 HEAD)
sed -i "s/content=\"0000000000000000000000000000000000000000\"/content=\"$SHA\"/" dist/index.html
echo "built dist with sha $SHA"
