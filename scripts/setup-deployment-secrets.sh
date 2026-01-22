#!/bin/bash
# Setup deployment secrets for Vercel and AWS
# This script helps configure environment variables

set -e

echo "🔐 Holdwall POS - Deployment Secrets Setup"
echo "=========================================="
echo ""

# Generated secrets
NEXTAUTH_SECRET="0FHUhec/iwdT+N5gnT8CAyQNLkUlnEvK2J7K5MsF3/I="
VAPID_PUBLIC_KEY="BBn2dPyJLZ2ZVunFhtqzbqr4mLo9lQGZiuDupMEaICD6cnbMe6mlFCDX58AgukLVorSAf0onJ-lXGGRqkIwG_E0"
VAPID_PRIVATE_KEY="HbQG-DaVCyuPcGagaYkcGg9ARYKjcmkG4KXPi1Mqtrg"
VAPID_SUBJECT="mailto:contact@workspax.com"

echo "Generated Secrets:"
echo "=================="
echo "NEXTAUTH_SECRET: $NEXTAUTH_SECRET"
echo "VAPID_PUBLIC_KEY: $VAPID_PUBLIC_KEY"
echo "VAPID_PRIVATE_KEY: $VAPID_PRIVATE_KEY"
echo "VAPID_SUBJECT: $VAPID_SUBJECT"
echo ""

# Check if Vercel CLI is available
if command -v vc &> /dev/null; then
    echo "📦 Setting up Vercel environment variables..."
    echo ""
    echo "⚠️  IMPORTANT: You need to provide DATABASE_URL manually"
    echo "   Get it from your PostgreSQL provider (Vercel Postgres, Supabase, etc.)"
    echo ""
    
    read -p "Do you want to set Vercel environment variables now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter DATABASE_URL: " DATABASE_URL
        read -p "Enter NEXTAUTH_URL (or press Enter to set after deployment): " NEXTAUTH_URL
        
        # Set environment variables in Vercel
        vc env add NEXTAUTH_SECRET production <<< "$NEXTAUTH_SECRET"
        vc env add VAPID_PUBLIC_KEY production <<< "$VAPID_PUBLIC_KEY"
        vc env add VAPID_PRIVATE_KEY production <<< "$VAPID_PRIVATE_KEY"
        vc env add VAPID_SUBJECT production <<< "$VAPID_SUBJECT"
        vc env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production <<< "$VAPID_PUBLIC_KEY"
        
        if [ ! -z "$DATABASE_URL" ]; then
            vc env add DATABASE_URL production <<< "$DATABASE_URL"
        fi
        
        if [ ! -z "$NEXTAUTH_URL" ]; then
            vc env add NEXTAUTH_URL production <<< "$NEXTAUTH_URL"
        else
            echo "⚠️  Remember to set NEXTAUTH_URL after deployment with your Vercel URL"
        fi
        
        echo "✅ Vercel environment variables configured!"
    fi
fi

# Check if AWS CLI is available
if command -v aws &> /dev/null; then
    echo ""
    echo "☁️  Setting up AWS Secrets Manager..."
    echo ""
    
    read -p "Do you want to set AWS secrets now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter AWS Region (default: us-east-1): " AWS_REGION
        AWS_REGION=${AWS_REGION:-us-east-1}
        
        read -p "Enter DATABASE_URL: " DATABASE_URL
        
        # Create secrets in AWS Secrets Manager
        echo "Creating secrets in AWS Secrets Manager..."
        
        # NEXTAUTH_SECRET
        aws secretsmanager create-secret \
            --name holdwall/prod/nextauth-secret \
            --secret-string "$NEXTAUTH_SECRET" \
            --region $AWS_REGION 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id holdwall/prod/nextauth-secret \
            --secret-string "$NEXTAUTH_SECRET" \
            --region $AWS_REGION
        
        # VAPID keys
        VAPID_KEYS_JSON=$(cat <<EOF
{
  "VAPID_PUBLIC_KEY": "$VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY": "$VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT": "$VAPID_SUBJECT",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY": "$VAPID_PUBLIC_KEY"
}
EOF
)
        
        aws secretsmanager create-secret \
            --name holdwall/prod/vapid-keys \
            --secret-string "$VAPID_KEYS_JSON" \
            --region $AWS_REGION 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id holdwall/prod/vapid-keys \
            --secret-string "$VAPID_KEYS_JSON" \
            --region $AWS_REGION
        
        # DATABASE_URL
        if [ ! -z "$DATABASE_URL" ]; then
            aws secretsmanager create-secret \
                --name holdwall/prod/database-url \
                --secret-string "$DATABASE_URL" \
                --region $AWS_REGION 2>/dev/null || \
            aws secretsmanager update-secret \
                --secret-id holdwall/prod/database-url \
                --secret-string "$DATABASE_URL" \
                --region $AWS_REGION
        fi
        
        echo "✅ AWS secrets configured in region: $AWS_REGION"
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy to Vercel: vc --prod"
echo "2. Deploy to AWS: ./aws-deploy.sh production us-east-1 ecs"
echo "3. Update NEXTAUTH_URL with your production URL after deployment"
