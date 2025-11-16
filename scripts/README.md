# SocialVault Utility Scripts

This folder contains utility scripts for maintaining and managing your SocialVault Firebase backend.

## Available Scripts

### 1. Orphaned Users Cleanup

Clean up user documents in Firestore that don't have corresponding Firebase Authentication accounts.

#### Windows (PowerShell)

```powershell
.\scripts\cleanup-orphaned-users.ps1
```

#### Linux/Mac (Bash)

```bash
chmod +x scripts/cleanup-orphaned-users.sh
./scripts/cleanup-orphaned-users.sh
```

**What it does:**
- Scans all user documents in Firestore
- Identifies users without Firebase Auth accounts
- Deletes orphaned user documents and their data
- Provides a detailed summary report

**Requirements:**
- Admin secret key (configured in Firebase Functions)
- Network connection to Firebase

**Documentation:** See [docs/ORPHANED_USERS_CLEANUP.md](../docs/ORPHANED_USERS_CLEANUP.md) for detailed information.

---

## Security Note

⚠️ These scripts require administrative access and should only be run by authorized personnel. Always backup your data before running maintenance scripts.

## Contributing

When adding new scripts:
1. Create both PowerShell (.ps1) and Bash (.sh) versions when applicable
2. Add clear comments and usage instructions
3. Include error handling
4. Update this README
5. Create corresponding documentation in the `docs/` folder

