#!/usr/bin/env bash
set -euo pipefail

TARGET=ce8effd

echo "== Stashing current changes =="
git stash push -m "pre-restore-$TARGET" || echo "Nothing to stash."

echo "== Files in commit $TARGET =="
git show --name-only --oneline $TARGET

echo
echo "== Restoring all files from $TARGET =="
git restore --source=$TARGET --worktree .

echo "== Current status after restore =="
git status

echo "== Done =="
echo "Files restored from $TARGET to working directory."
echo "To commit these changes: git add . && git commit -m 'Restore files from $TARGET'"
echo "To see your stashed changes: git stash list"
echo "To restore stash later: git stash pop"
