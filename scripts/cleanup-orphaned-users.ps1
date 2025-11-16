# PowerShell Script to Clean Up Orphaned Users
# This script calls the Firebase Cloud Function to remove user documents that don't have corresponding auth accounts

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     SocialVault - Orphaned Users Cleanup Script          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Prompt for admin secret
$adminSecret = Read-Host "Enter your admin secret key"

if ([string]::IsNullOrWhiteSpace($adminSecret)) {
    Write-Host "❌ Error: Admin secret is required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔐 Admin secret provided" -ForegroundColor Green
Write-Host "🌐 Calling cleanup function..." -ForegroundColor Yellow
Write-Host ""

# Cloud Function URL
$functionUrl = "https://us-central1-social-vault.cloudfunctions.net/cleanupOrphanedUsers"

# Prepare the request body
$body = @{
    adminSecret = $adminSecret
} | ConvertTo-Json

try {
    # Make the HTTP request
    $response = Invoke-RestMethod -Uri $functionUrl -Method Post -Body $body -ContentType "application/json"
    
    Write-Host "✅ Cleanup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "═══════════════════ SUMMARY ═══════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Total users checked:        " -NoNewline
    Write-Host $response.summary.totalUsersChecked -ForegroundColor White
    Write-Host "Orphaned users found:       " -NoNewline
    Write-Host $response.summary.orphanedUsersFound -ForegroundColor Yellow
    Write-Host "Orphaned users deleted:     " -NoNewline
    Write-Host $response.summary.orphanedUsersDeleted -ForegroundColor Green
    Write-Host "Errors encountered:         " -NoNewline
    Write-Host $response.summary.errors.Count -ForegroundColor $(if ($response.summary.errors.Count -gt 0) { "Red" } else { "Green" })
    Write-Host ""
    
    if ($response.summary.orphanedUsersFound -gt 0) {
        Write-Host "═══════════════ DELETED USERS ═══════════════" -ForegroundColor Cyan
        Write-Host ""
        foreach ($user in $response.summary.orphanedUserData) {
            Write-Host "  👤 $($user.fullName)" -ForegroundColor White
            Write-Host "     Email:     $($user.email)" -ForegroundColor Gray
            Write-Host "     User ID:   $($user.userId)" -ForegroundColor Gray
            Write-Host "     Created:   $($user.createdAt)" -ForegroundColor Gray
            Write-Host ""
        }
    }
    
    if ($response.summary.errors.Count -gt 0) {
        Write-Host "═══════════════════ ERRORS ═══════════════════" -ForegroundColor Red
        Write-Host ""
        foreach ($error in $response.summary.errors) {
            Write-Host "  ❌ User ID: $($error.userId)" -ForegroundColor Red
            Write-Host "     Error: $($error.error)" -ForegroundColor Gray
            Write-Host ""
        }
    }
    
    Write-Host "═════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🎉 Cleanup process completed!" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Error calling cleanup function:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "Server response: $($errorResponse.message)" -ForegroundColor Yellow
        } catch {
            Write-Host "Server response: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "💡 Tips:" -ForegroundColor Cyan
    Write-Host "  • Make sure your admin secret is correct" -ForegroundColor Gray
    Write-Host "  • Check that the Cloud Function is deployed" -ForegroundColor Gray
    Write-Host "  • Review the documentation in docs/ORPHANED_USERS_CLEANUP.md" -ForegroundColor Gray
    Write-Host ""
    
    exit 1
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

