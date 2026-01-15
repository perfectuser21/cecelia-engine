#!/bin/bash
# Branch Protection Hook for Claude Code
# Prevents direct code file modifications on main/master branches

set -e

# Read JSON input from stdin
INPUT=$(cat)

# Extract operation type
OPERATION=$(echo "$INPUT" | jq -r '.operation // empty')

# Only check Write/Edit operations
if [[ "$OPERATION" != "Write" && "$OPERATION" != "Edit" ]]; then
    exit 0
fi

# Extract file path
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

# Get file extension
EXT="${FILE_PATH##*.}"

# Allow non-code files (.md, .json, .txt, .yml, .yaml)
case "$EXT" in
    md|json|txt|yml|yaml)
        exit 0
        ;;
esac

# Get current git branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# Check if on protected branch
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    echo "❌ Branch Protection: Cannot modify code files on $CURRENT_BRANCH branch"
    echo ""
    echo "Please create a feature branch first:"
    echo "  git checkout -b feature/your-feature-name"
    echo ""
    echo "File: $FILE_PATH"
    exit 2
fi

# Allow operation
exit 0
