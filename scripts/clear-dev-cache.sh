#!/bin/bash
# Clear Next.js development cache and service worker cache

echo "Clearing Next.js development cache..."

# Remove .next directory
if [ -d ".next" ]; then
  rm -rf .next
  echo "✅ Removed .next directory"
else
  echo "ℹ️  .next directory not found"
fi

# Clear browser cache instructions
echo ""
echo "📋 Next steps:"
echo "1. Stop your Next.js dev server (Ctrl+C)"
echo "2. Clear your browser's cache and service worker:"
echo "   - Chrome/Edge: DevTools > Application > Clear storage > Clear site data"
echo "   - Firefox: DevTools > Storage > Clear All"
echo "3. Unregister service worker:"
echo "   - Open DevTools > Application > Service Workers > Unregister"
echo "4. Restart dev server: npm run dev"
echo ""
echo "✅ Cache clearing complete!"
