#!/bin/bash
# Database Backup Script
# Creates timestamped backups of PostgreSQL database

set -e

# Configuration
BACKUP_DIR=${BACKUP_DIR:-"./backups"}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/holdwall-backup-${TIMESTAMP}.sql"
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Database Backup Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL not set${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo -e "${YELLOW}Backup directory: $BACKUP_DIR${NC}"

# Extract connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_URL=$DATABASE_URL

# Create backup
echo -e "${YELLOW}Creating backup...${NC}"
if pg_dump "$DB_URL" > "$BACKUP_FILE"; then
    # Compress backup
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE (${BACKUP_SIZE})${NC}"
else
    echo -e "${RED}Error: Backup failed${NC}"
    exit 1
fi

# Cleanup old backups
echo -e "${YELLOW}Cleaning up old backups (older than ${RETENTION_DAYS} days)...${NC}"
find "$BACKUP_DIR" -name "holdwall-backup-*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo -e "${GREEN}✓ Cleanup completed${NC}"

# List backups
echo ""
echo -e "${GREEN}Available backups:${NC}"
ls -lh "$BACKUP_DIR"/holdwall-backup-*.sql.gz 2>/dev/null | tail -5 || echo "No backups found"

echo ""
echo -e "${GREEN}Backup completed successfully!${NC}"
