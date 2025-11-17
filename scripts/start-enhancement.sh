#!/bin/bash
# Comprehensive script to start working on an enhancement
# Creates branch, generates detailed task file, and sets up Claude context
# Usage: ./scripts/start-enhancement.sh <enhancement-number> <short-name>

set -e  # Exit on error

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
  echo "This script will:"
  echo "  1. Create a feature branch"
  echo "  2. Parse enhancement details from the matrix"
  echo "  3. Generate a detailed TASK.md file"
  echo "  4. Create Claude session context"
  echo "  5. Commit the task files"
  echo ""
  exit 1
fi

ENHANCEMENT_NUM=$1
SHORT_NAME=$2
BRANCH_NAME="feature/enhancement-${ENHANCEMENT_NUM}-${SHORT_NAME}"

echo "🚀 Starting Enhancement #${ENHANCEMENT_NUM}"
echo "   Branch: ${BRANCH_NAME}"
echo ""

# Step 1: Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  echo "⚠️  Warning: Not on main branch (currently on: $CURRENT_BRANCH)"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  echo "📥 Pulling latest changes..."
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
  echo ""
fi

# Step 2: Create branch
echo "🔀 Creating branch: ${BRANCH_NAME}"
git checkout -b "${BRANCH_NAME}" || {
  echo "❌ Failed to create branch (may already exist)"
  echo "   Try: git checkout ${BRANCH_NAME}"
  exit 1
}
echo "✅ Branch created"
echo ""

# Step 3: Generate detailed task file
echo "📝 Generating detailed task file from Enhancement Matrix..."
if [ -f "scripts/create-enhancement-task.js" ]; then
  node scripts/create-enhancement-task.js "${ENHANCEMENT_NUM}"
  echo ""
else
  echo "⚠️  Task generator not found, creating basic task file..."

  cat > TASK.md << EOF
# Enhancement #${ENHANCEMENT_NUM}: Implementation Task

You are implementing Enhancement #${ENHANCEMENT_NUM} for the Page Indexer Chrome Extension.

## Your Task

Implement this enhancement by following the detailed guide in IMPLEMENTATION_EXAMPLES.md.

## Quick Start

1. **Find the implementation guide**:
   - Open \`IMPLEMENTATION_EXAMPLES.md\`
   - Search for: \`### #${ENHANCEMENT_NUM}:\`
   - Read the complete section

2. **Create implementation plan**:
   - Use TodoWrite to break down the task
   - Identify all files to create/modify
   - Plan the implementation order

3. **Implement following the guide**:
   - Follow the code examples provided
   - Adapt to fit existing codebase patterns
   - Test incrementally as you build

4. **Test thoroughly**:
   - Unit tests
   - Manual testing in Chrome
   - No regressions

5. **Document your changes**:
   - Code comments
   - Update README if needed
   - Update CHANGELOG

## Reference Files

- Implementation guide: \`IMPLEMENTATION_EXAMPLES.md\`
- Enhancement matrix: \`ENHANCEMENT_MATRIX_V2.md\`
- Workflow guide: \`BRANCH_WORKFLOW_GUIDE.md\`

## When Complete

\`\`\`bash
./scripts/finish-enhancement-branch.sh
git push -u origin ${BRANCH_NAME}
gh pr create
\`\`\`

Good luck! 🚀
EOF

  mkdir -p .claude
  cat > .claude/session-start.md << EOF
# Enhancement #${ENHANCEMENT_NUM}

Working on: ${BRANCH_NAME}

Please read TASK.md for the complete implementation task.

Reference:
- TASK.md - Your main task
- IMPLEMENTATION_EXAMPLES.md - Detailed implementation guide
- ENHANCEMENT_MATRIX_V2.md - Full context
EOF
fi

# Step 4: Stage and commit task files
echo "💾 Committing task files..."
git add TASK.md .claude/ 2>/dev/null || true
git commit -m "chore: add task files for enhancement #${ENHANCEMENT_NUM}

Created Claude-ready task file and session context.
" 2>/dev/null || echo "⚠️  Task files may already be committed"
echo ""

# Step 5: Display summary and next steps
echo "════════════════════════════════════════════════════════════════"
echo "✅ Enhancement #${ENHANCEMENT_NUM} setup complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📂 Current branch: ${BRANCH_NAME}"
echo ""
echo "📋 Files created:"
echo "   ├─ TASK.md - Your complete implementation task"
echo "   └─ .claude/session-start.md - Claude Code session context"
echo ""
echo "🎯 Next steps:"
echo ""
echo "   1. READ THE TASK:"
echo "      cat TASK.md"
echo ""
echo "   2. START CLAUDE:"
echo "      • Open Claude Code in this repo"
echo "      • It will auto-load from .claude/session-start.md"
echo "      • Or manually open TASK.md and share with Claude"
echo ""
echo "   3. IMPLEMENT:"
echo "      • Follow the step-by-step guide in TASK.md"
echo "      • Reference IMPLEMENTATION_EXAMPLES.md for code"
echo "      • Use TodoWrite to track progress"
echo ""
echo "   4. TEST & FINISH:"
echo "      ./scripts/finish-enhancement-branch.sh"
echo ""
echo "   5. PUSH & CREATE PR:"
echo "      git push -u origin ${BRANCH_NAME}"
echo "      gh pr create"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "💡 Pro tips:"
echo "   • Read TASK.md fully before starting"
echo "   • Follow the code examples closely"
echo "   • Commit frequently with clear messages"
echo "   • Test incrementally, not all at once"
echo ""
echo "📚 Reference docs:"
echo "   • TASK.md - Your specific task"
echo "   • IMPLEMENTATION_EXAMPLES.md - Code examples"
echo "   • ENHANCEMENT_MATRIX_V2.md - Full context"
echo "   • BRANCH_WORKFLOW_GUIDE.md - Git workflow"
echo ""
echo "Happy coding! 🚀"
echo ""
