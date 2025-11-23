#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"

echo "== Fetch =="
git fetch --all --prune

echo
echo "== Last 25 commits on $BRANCH (oneline) =="
git log "$BRANCH" --oneline -25

echo
echo "== Graph (last 15) =="
git log "$BRANCH" --oneline --decorate --graph -15

echo
echo "== Commits from past 3 days =="
git log "$BRANCH" --oneline --since="3 days ago"

echo
echo "== Commits by you (author) =="
git log "$BRANCH" --oneline --author="$(git config user.name)" -20 || true

echo
echo "== Grep example (drought) =="
git log "$BRANCH" --oneline --grep="drought" || echo "No matches."

echo
echo "== Full detail of HEAD =="
git show "$BRANCH" --no-patch --stat

echo
echo "== Interactive picker (press q to quit) =="
git log "$BRANCH" --decorate --graph
