#!/bin/bash
# Setup VAPID Keys for Push Notifications
# This script generates VAPID keys and provides instructions for setting them up

set -e

echo "=========================================="
echo "VAPID Keys Setup for Push Notifications"
echo "=========================================="
echo ""

# Check if web-push is installed
if ! command -v npx &> /dev/null; then
    echo "Error: npx is not installed. Please install Node.js first."
    exit 1
fi

# Generate VAPID keys
echo "Generating VAPID keys..."
echo ""

KEYS=$(npx web-push generate-vapid-keys 2>&1)

# Extract keys
PUBLIC_KEY=$(echo "$KEYS" | grep "Public Key:" | cut -d: -f2 | xargs)
PRIVATE_KEY=$(echo "$KEYS" | grep "Private Key:" | cut -d: -f2 | xargs)

if [ -z "$PUBLIC_KEY" ] || [ -z "$PRIVATE_KEY" ]; then
    echo "Error: Failed to generate VAPID keys"
    exit 1
fi

echo "✅ VAPID keys generated successfully!"
echo ""
echo "=========================================="
echo "Add these to your .env file:"
echo "=========================================="
echo ""
echo "VAPID_PUBLIC_KEY=$PUBLIC_KEY"
echo "VAPID_PRIVATE_KEY=$PRIVATE_KEY"
echo "VAPID_SUBJECT=mailto:notifications@holdwall.com"
echo "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$PUBLIC_KEY"
echo ""
echo "=========================================="
echo "For production deployment:"
echo "=========================================="
echo ""
echo "1. Add these as environment variables in your hosting platform:"
echo "   - Vercel: Project Settings > Environment Variables"
echo "   - AWS: Systems Manager Parameter Store or Secrets Manager"
echo "   - Docker: Add to docker-compose.yml or .env file"
echo "   - Kubernetes: Add to secrets.yaml"
echo ""
echo "2. For Kubernetes, update k8s/secrets.yaml:"
echo "   kubectl create secret generic vapid-keys \\"
echo "     --from-literal=VAPID_PUBLIC_KEY='$PUBLIC_KEY' \\"
echo "     --from-literal=VAPID_PRIVATE_KEY='$PRIVATE_KEY' \\"
echo "     --from-literal=VAPID_SUBJECT='mailto:notifications@holdwall.com' \\"
echo "     --from-literal=NEXT_PUBLIC_VAPID_PUBLIC_KEY='$PUBLIC_KEY'"
echo ""
echo "3. Restart your application after setting environment variables"
echo ""

# Optionally write to .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    read -p "Would you like to create .env.local with these keys? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cat >> .env.local << EOF

# VAPID Keys for Push Notifications
# Generated on $(date)
VAPID_PUBLIC_KEY=$PUBLIC_KEY
VAPID_PRIVATE_KEY=$PRIVATE_KEY
VAPID_SUBJECT=mailto:notifications@holdwall.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=$PUBLIC_KEY
EOF
        echo "✅ Keys added to .env.local"
    fi
fi

echo ""
echo "Done! 🎉"
