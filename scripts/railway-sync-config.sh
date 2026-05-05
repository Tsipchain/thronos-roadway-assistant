#!/bin/bash
# Railway environment variable sync helper
# Syncs Thronos-derived values to Railway service
#
# Usage:
#   bash scripts/railway-sync-config.sh
#
# Requirements:
#   - railway CLI installed: https://docs.railway.app/guides/cli
#   - logged in: railway login
#   - .env.thronos-bridge generated: npx tsx scripts/sync-thronos-env.ts

set -e

echo "🚀 Railway Environment Sync"
echo "==========================="
echo ""

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ railway CLI not found. Install: https://docs.railway.app/guides/cli"
    exit 1
fi

# Check .env.thronos-bridge exists
if [ ! -f ".env.thronos-bridge" ]; then
    echo "❌ .env.thronos-bridge not found."
    echo "   Run: npx tsx scripts/sync-thronos-env.ts"
    exit 1
fi

echo "📝 Select target service:"
echo "   1) thronos-roadway-assistant (production)"
echo "   2) thronos-roadway-assistant-dev (staging)"
echo ""
read -p "Enter choice (1-2): " CHOICE

case $CHOICE in
    1) SERVICE="thronos-roadway-assistant" ;;
    2) SERVICE="thronos-roadway-assistant-dev" ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

echo ""
echo "🔗 Syncing to $SERVICE..."
echo ""

# Extract variables and set in Railway
grep -v '^#' .env.thronos-bridge | grep -v '^$' | while IFS='=' read -r key value; do
    # Skip if empty
    [ -z "$key" ] && continue
    
    # Remove quotes
    value=$(echo $value | sed 's/^"\|"$//g')
    
    # Skip if value is placeholder
    if [[ "$value" == "0x..." ]] || [[ "$value" == "generate-"* ]]; then
        echo "⏭️  Skipping $key (requires manual setup)"
        continue
    fi
    
    echo "📌 Setting $key..."
    railway variables set $key "$value" --service $SERVICE 2>/dev/null || true
done

echo ""
echo "✅ Sync complete!"
echo ""
echo "⚠️  Manual steps required:"
echo "   1. Set THRONOS_DEPLOYER_PRIVATE_KEY in Railway"
echo "   2. Set THRONOS_PLATFORM_PRIVATE_KEY in Railway"
echo "   3. Generate and set THRONOS_ATTESTATION_API_KEY:"
echo "      openssl rand -hex 32"
echo ""
echo "💡 View current variables:"
echo "   railway variables --service $SERVICE"
