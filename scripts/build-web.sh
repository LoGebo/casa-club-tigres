#!/bin/sh
# Exporta la app web de Expo a public/ (la sirve server.js). Mismo origen que la API: EXPO_PUBLIC_API_URL vacío.
set -e
cd "$(dirname "$0")/../app"
rm -rf ../public.new
EXPO_PUBLIC_API_URL= npx expo export -p web --output-dir ../public.new
cd ..
rm -rf public && mv public.new public
echo "Listo: public/ ($(du -sh public | cut -f1))"
