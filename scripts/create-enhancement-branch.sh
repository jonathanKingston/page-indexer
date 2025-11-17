#!/bin/bash
# Script to create a new enhancement branch
# Usage: ./scripts/create-enhancement-branch.sh <enhancement-number> <short-name>

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Error: Missing arguments"
  echo ""
  echo "Usage: $0 <enhancement-number> <short-name>"
  echo ""
  echo "Examples:"
  echo "  $0 5 onnx-optimization"
  echo "  $0 15 typescript"
  echo "  $0 32 csp"
  echo ""
  exit 1
fi

ENHANCEMENT_NUM=$1
SHORT_NAME=$2
BRANCH_NAME="feature/enhancement-${ENHANCEMENT_NUM}-${SHORT_NAME}"

echo "🌱 Creating enhancement branch..."
echo "   Number: #${ENHANCEMENT_NUM}"
echo "   Branch: ${BRANCH_NAME}"
echo ""

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  echo "⚠️  Warning: Not on main branch (currently on: $CURRENT_BRANCH)"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  # Pull latest changes
  echo "📥 Pulling latest changes from main..."
  git pull origin main || git pull origin master
  echo ""
fi

# Create and checkout new branch
echo "🔀 Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Branch created successfully!"
  echo ""
  echo "📚 Next steps:"
  echo "   1. Read IMPLEMENTATION_EXAMPLES.md for enhancement #${ENHANCEMENT_NUM}"
  echo "   2. Implement the enhancement following the guide"
  echo "   3. Test your changes thoroughly"
  echo "   4. Run: ./scripts/finish-enhancement-branch.sh"
  echo ""
  echo "📖 Documentation:"
  echo "   - Enhancement Matrix: ENHANCEMENT_MATRIX_V2.md"
  echo "   - Implementation Guide: IMPLEMENTATION_EXAMPLES.md"
  echo "   - Workflow Guide: BRANCH_WORKFLOW_GUIDE.md"
  echo ""
  echo "Happy coding! 🚀"
else
  echo ""
  echo "❌ Failed to create branch"
  exit 1
fi
