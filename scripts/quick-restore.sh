
# Show files in that commit
git show --name-only ce8effd

# Stash current work
git stash push -m "pre-restore-ce8effd"

# Restore all files from ce8effd to working directory
git restore --source=ce8effd --worktree .

# Check what changed
git status

# Stage and commit if you want to keep these versions
git add .
git commit -m "Restore all files from ce8effd"

# Or restore specific files only
# git restore --source=ce8effd src/components/Chat.tsx
# git restore --source=ce8effd src/components/AzureMapView.tsx