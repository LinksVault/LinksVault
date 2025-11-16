#!/bin/bash
# Bash Script to Clean Up Orphaned Users
# This script calls the Firebase Cloud Function to remove user documents that don't have corresponding auth accounts

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     SocialVault - Orphaned Users Cleanup Script          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Prompt for admin secret
read -sp "Enter your admin secret key: " adminSecret
echo ""

if [ -z "$adminSecret" ]; then
    echo -e "${RED}❌ Error: Admin secret is required${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🔐 Admin secret provided${NC}"
echo -e "${YELLOW}🌐 Calling cleanup function...${NC}"
echo ""

# Cloud Function URL
functionUrl="https://us-central1-social-vault.cloudfunctions.net/cleanupOrphanedUsers"

# Make the HTTP request
response=$(curl -s -X POST "$functionUrl" \
  -H "Content-Type: application/json" \
  -d "{\"adminSecret\": \"$adminSecret\"}")

# Check if curl was successful
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to connect to Cloud Function${NC}"
    exit 1
fi

# Check if response contains "success": true
if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Cleanup completed successfully!${NC}"
    echo ""
    echo -e "${CYAN}═══════════════════ SUMMARY ═══════════════════${NC}"
    echo ""
    
    # Parse JSON response (requires jq - install if needed)
    if command -v jq &> /dev/null; then
        totalChecked=$(echo "$response" | jq -r '.summary.totalUsersChecked')
        orphanedFound=$(echo "$response" | jq -r '.summary.orphanedUsersFound')
        orphanedDeleted=$(echo "$response" | jq -r '.summary.orphanedUsersDeleted')
        errorsCount=$(echo "$response" | jq -r '.summary.errors | length')
        
        echo -e "Total users checked:        ${WHITE}$totalChecked${NC}"
        echo -e "Orphaned users found:       ${YELLOW}$orphanedFound${NC}"
        echo -e "Orphaned users deleted:     ${GREEN}$orphanedDeleted${NC}"
        
        if [ "$errorsCount" -gt 0 ]; then
            echo -e "Errors encountered:         ${RED}$errorsCount${NC}"
        else
            echo -e "Errors encountered:         ${GREEN}$errorsCount${NC}"
        fi
        
        echo ""
        
        if [ "$orphanedFound" -gt 0 ]; then
            echo -e "${CYAN}═══════════════ DELETED USERS ═══════════════${NC}"
            echo ""
            echo "$response" | jq -r '.summary.orphanedUserData[] | "  👤 \(.fullName)\n     Email:     \(.email)\n     User ID:   \(.userId)\n     Created:   \(.createdAt)\n"'
        fi
        
        echo -e "${CYAN}═════════════════════════════════════════════${NC}"
        echo ""
        echo -e "${GREEN}🎉 Cleanup process completed!${NC}"
        echo ""
    else
        echo "Raw response:"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        echo ""
        echo -e "${YELLOW}💡 Tip: Install 'jq' for better formatted output: sudo apt-get install jq${NC}"
    fi
else
    echo -e "${RED}❌ Error: Cleanup failed${NC}"
    echo ""
    
    # Try to extract error message
    errorMessage=$(echo "$response" | jq -r '.message' 2>/dev/null)
    if [ -n "$errorMessage" ] && [ "$errorMessage" != "null" ]; then
        echo -e "Server response: ${YELLOW}$errorMessage${NC}"
    else
        echo "Raw response:"
        echo "$response"
    fi
    
    echo ""
    echo -e "${CYAN}💡 Tips:${NC}"
    echo -e "${GRAY}  • Make sure your admin secret is correct${NC}"
    echo -e "${GRAY}  • Check that the Cloud Function is deployed${NC}"
    echo -e "${GRAY}  • Review the documentation in docs/ORPHANED_USERS_CLEANUP.md${NC}"
    echo ""
    
    exit 1
fi

