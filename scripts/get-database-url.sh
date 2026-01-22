#!/bin/bash
# Helper script to get production DATABASE_URL
# Checks Vercel and provides instructions

set -e

echo "🔍 Finding Production DATABASE_URL"
echo "===================================="
echo ""

# Check Vercel
if command -v vc &> /dev/null; then
    echo "Checking Vercel environment variables..."
    vc env pull .env.production.check --environment production 2>/dev/null || true
    
    if [ -f .env.production.check ]; then
        source .env.production.check
        rm -f .env.production.check
        
        if [ ! -z "$DATABASE_URL" ]; then
            if echo "$DATABASE_URL" | grep -q "localhost\|127.0.0.1"; then
                echo "⚠️  Current DATABASE_URL is localhost (development)"
                echo ""
                echo "You need a production database. Quick options:"
                echo ""
                echo "1. Supabase (Free, ~5 min setup):"
                echo "   https://supabase.com → New Project → Settings → Database → Connection string"
                echo ""
                echo "2. Vercel Postgres:"
                echo "   https://vercel.com/dashboard → holdwall → Storage → Create Database"
                echo ""
                echo "3. Neon (Free tier):"
                echo "   https://neon.tech → New Project → Connection string"
                echo ""
                echo "Once you have DATABASE_URL, run:"
                echo "   npm run deploy:complete 'your-database-url'"
            else
                echo "✅ Production DATABASE_URL found!"
                echo "Database: $(echo $DATABASE_URL | sed 's/:[^:]*@/:***@/' | sed 's/@[^/]*\//@***\//')"
                echo ""
                echo "You can now run:"
                echo "   npm run deploy:complete"
            fi
        else
            echo "❌ DATABASE_URL not found in Vercel"
        fi
    fi
else
    echo "Vercel CLI not found"
fi
