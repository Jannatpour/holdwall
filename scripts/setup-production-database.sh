#!/bin/bash
# Production Database Setup Script
# Helps set up production PostgreSQL database for Vercel and AWS deployments

set -e

echo "🗄️  Holdwall POS - Production Database Setup"
echo "=============================================="
echo ""

# Check for Vercel CLI
if command -v vc &> /dev/null; then
    echo "📦 Vercel CLI detected"
    echo ""
    echo "Options for production database:"
    echo "1. Vercel Postgres (Recommended for Vercel deployments)"
    echo "2. External PostgreSQL (Supabase, Neon, AWS RDS, etc.)"
    echo ""
    
    read -p "Choose option (1 or 2): " DB_OPTION
    
    case $DB_OPTION in
        1)
            echo ""
            echo "Setting up Vercel Postgres..."
            echo ""
            echo "To create a Vercel Postgres database:"
            echo "1. Go to https://vercel.com/dashboard"
            echo "2. Select your project: holdwall"
            echo "3. Go to Storage tab"
            echo "4. Click 'Create Database' > 'Postgres'"
            echo "5. Select a plan and region"
            echo "6. Copy the DATABASE_URL from the database settings"
            echo ""
            read -p "Enter DATABASE_URL from Vercel Postgres: " DATABASE_URL
            
            if [ ! -z "$DATABASE_URL" ]; then
                echo ""
                echo "Adding DATABASE_URL to Vercel environment variables..."
                echo 'y' | vc env rm DATABASE_URL production 2>/dev/null || true
                echo "$DATABASE_URL" | vc env add DATABASE_URL production
                echo "✅ DATABASE_URL added to Vercel"
            fi
            ;;
        2)
            echo ""
            echo "Using external PostgreSQL database"
            echo ""
            echo "Supported providers:"
            echo "- Supabase (https://supabase.com)"
            echo "- Neon (https://neon.tech)"
            echo "- AWS RDS"
            echo "- Railway (https://railway.app)"
            echo "- Render (https://render.com)"
            echo "- Any PostgreSQL 14+ compatible database"
            echo ""
            read -p "Enter DATABASE_URL (postgresql://user:pass@host:port/dbname): " DATABASE_URL
            
            if [ ! -z "$DATABASE_URL" ]; then
                echo ""
                echo "Adding DATABASE_URL to Vercel environment variables..."
                echo 'y' | vc env rm DATABASE_URL production 2>/dev/null || true
                echo "$DATABASE_URL" | vc env add DATABASE_URL production
                echo "✅ DATABASE_URL added to Vercel"
            fi
            ;;
        *)
            echo "Invalid option"
            exit 1
            ;;
    esac
else
    echo "⚠️  Vercel CLI not found. Setting up for AWS or other platforms..."
    echo ""
    read -p "Enter DATABASE_URL: " DATABASE_URL
fi

# Test database connection
if [ ! -z "$DATABASE_URL" ]; then
    echo ""
    echo "Testing database connection..."
    export DATABASE_URL
    
    if npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
        echo "✅ Database connection successful!"
        echo ""
        echo "Running database migrations..."
        npx prisma migrate deploy
        echo "✅ Migrations completed successfully!"
    else
        echo "❌ Database connection failed"
        echo "Please verify:"
        echo "1. DATABASE_URL is correct"
        echo "2. Database server is accessible"
        echo "3. Network/firewall allows connections"
        exit 1
    fi
fi

echo ""
echo "✅ Production database setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify deployment: curl https://holdwall-jannatpours-projects.vercel.app/api/health"
echo "2. Test authentication: Visit https://holdwall-jannatpours-projects.vercel.app/auth/signin"
echo "3. Run seed data (optional): npm run db:seed"
