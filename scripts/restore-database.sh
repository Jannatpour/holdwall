#!/bin/bash
# Database Restore Script
# Restores PostgreSQL database from backup file

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Database Restore Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}Usage: $0 <backup-file>${NC}"
    echo ""
    echo "Available backups:"
    ls -lh backups/holdwall-backup-*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE=$1

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL not set${NC}"
    exit 1
fi

# Confirm restore
echo -e "${RED}WARNING: This will overwrite the current database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Create temporary file for decompressed backup
TEMP_FILE=$(mktemp)

# Decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo -e "${YELLOW}Decompressing backup...${NC}"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
else
    cp "$BACKUP_FILE" "$TEMP_FILE"
fi

# Restore database
echo -e "${YELLOW}Restoring database...${NC}"
if psql "$DATABASE_URL" < "$TEMP_FILE"; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
else
    echo -e "${RED}Error: Restore failed${NC}"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Cleanup
rm -f "$TEMP_FILE"

# Run migrations to ensure schema is up to date
echo -e "${YELLOW}Running migrations...${NC}"
npx prisma migrate deploy
echo -e "${GREEN}✓ Migrations completed${NC}"

echo ""
echo -e "${GREEN}Restore completed successfully!${NC}"
