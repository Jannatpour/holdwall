#!/bin/bash
# Run Production Database Migrations
# Connects to production database and runs Prisma migrations

set -e

echo "🔄 Holdwall POS - Production Database Migrations"
echo "=================================================="
echo ""

# Check if DATABASE_URL is set, try to get from Vercel if not
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set, attempting to retrieve from Vercel..."
    
    if command -v vc &> /dev/null; then
        if vc env pull .env.production.local 2>/dev/null; then
            source .env.production.local
            if [ ! -z "$DATABASE_URL" ]; then
                echo "✅ DATABASE_URL retrieved from Vercel"
            fi
        fi
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        echo "❌ DATABASE_URL environment variable not set"
        echo ""
        echo "Options:"
        echo "1. Set DATABASE_URL environment variable:"
        echo "   export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
        echo ""
        echo "2. For Vercel, get DATABASE_URL from:"
        echo "   vc env pull .env.production"
        echo "   source .env.production"
        echo ""
        echo "3. For AWS, get from Secrets Manager:"
        echo "   aws secretsmanager get-secret-value --secret-id holdwall/prod/database-url --query SecretString --output text"
        exit 1
    fi
fi

echo "Database: ${DATABASE_URL%%@*}@***"
echo ""

# Test connection
echo "Testing database connection..."
if npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Run migrations
echo ""
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo ""
echo "✅ Migrations completed successfully!"
echo ""
echo "Verifying database schema..."
npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" | head -20

echo ""
echo "✅ Production database is ready!"
