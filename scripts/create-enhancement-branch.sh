#!/bin/bash
# Enhanced script to create enhancement branch with Claude-ready task file
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

echo "🌱 Creating enhancement branch with Claude task file..."
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
  echo "📥 Pulling latest changes from main..."
  git pull origin main || git pull origin master
  echo ""
fi

# Create and checkout new branch
echo "🔀 Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Failed to create branch"
  exit 1
fi

# Extract enhancement details from ENHANCEMENT_MATRIX_V2.md
echo "📝 Creating Claude task file..."

# Create TASK.md with Claude-ready prompt
cat > TASK.md << 'TASK_TEMPLATE'
# Enhancement #{ENHANCEMENT_NUM}: {TITLE}

You are working on implementing Enhancement #{ENHANCEMENT_NUM} for the Page Indexer Chrome Extension.

## Your Task

Implement this enhancement by following the detailed guide in `IMPLEMENTATION_EXAMPLES.md` (search for "### #{ENHANCEMENT_NUM}:").

## Enhancement Overview

**Priority**: {PRIORITY}
**Complexity**: {COMPLEXITY}
**Time Estimate**: {TIME_ESTIMATE}
**Estimated LOC**: {LOC}
**Breaking Changes**: {BREAKING}

## Implementation Steps

Please follow these steps in order:

### 1. Review the Implementation Guide
- Open `IMPLEMENTATION_EXAMPLES.md`
- Read the section for Enhancement #{ENHANCEMENT_NUM}
- Understand the files to create/modify
- Review the code examples

### 2. Create New Files
Based on the implementation guide, you will need to create:
- {LIST_NEW_FILES}

### 3. Modify Existing Files
You will need to modify:
- {LIST_MODIFIED_FILES}

### 4. Implementation Plan

Create a step-by-step implementation plan by:
1. Breaking down the enhancement into atomic tasks
2. Identifying dependencies between tasks
3. Determining the order of implementation

Use the TodoWrite tool to track your progress.

### 5. Implement the Enhancement

Follow the code examples in the implementation guide. Make sure to:
- Follow existing code style and patterns
- Add appropriate error handling
- Include inline comments for complex logic
- Consider edge cases
- Optimize for performance where applicable

### 6. Testing

After implementation:
- Write/update unit tests
- Test manually in Chrome
- Verify no regressions
- Check performance metrics (if applicable)

### 7. Documentation

Update documentation:
- Add/update code comments
- Update README.md if user-facing changes
- Document any breaking changes
- Update CHANGELOG.md

## Reference Files

- **Implementation Guide**: `IMPLEMENTATION_EXAMPLES.md` (or `IMPLEMENTATION_EXAMPLES_PART2.md`)
- **Enhancement Matrix**: `ENHANCEMENT_MATRIX_V2.md`
- **Workflow Guide**: `BRANCH_WORKFLOW_GUIDE.md`

## Acceptance Criteria

This enhancement is complete when:
- [ ] All files from the implementation guide are created/modified
- [ ] Code follows the patterns shown in examples
- [ ] Tests are written and passing
- [ ] No linting errors
- [ ] Documentation is updated
- [ ] Manual testing completed successfully
- [ ] No performance regressions

## Getting Started

To begin, please:
1. Read the implementation guide for Enhancement #{ENHANCEMENT_NUM}
2. Create a detailed implementation plan using TodoWrite
3. Start implementing following the guide
4. Test thoroughly as you go
5. Commit with clear messages

When ready to finish:
```bash
./scripts/finish-enhancement-branch.sh
git push -u origin {BRANCH_NAME}
```

Good luck! 🚀
TASK_TEMPLATE

# Now customize the template with actual values
# This is a placeholder - in a real implementation, we'd parse ENHANCEMENT_MATRIX_V2.md
# For now, create a generic task that references the guide

cat > TASK.md << EOF
# Enhancement #${ENHANCEMENT_NUM}: Implementation Task

You are working on implementing Enhancement #${ENHANCEMENT_NUM} for the Page Indexer Chrome Extension.

## Your Task

Implement this enhancement by following the detailed guide in the implementation examples.

## Quick Start

### Step 1: Review the Implementation Guide

Open \`IMPLEMENTATION_EXAMPLES.md\` and search for:
\`\`\`
### #${ENHANCEMENT_NUM}:
\`\`\`

Read the complete section including:
- Branch name (should match current branch)
- Files to create
- Files to modify
- Implementation examples
- Code patterns
- Testing requirements

### Step 2: Create Implementation Plan

Use the TodoWrite tool to break down the enhancement into tasks. Example:

\`\`\`
TodoWrite with tasks:
1. Review implementation guide for enhancement #${ENHANCEMENT_NUM}
2. Create new files as specified
3. Modify existing files as specified
4. Implement core functionality
5. Add error handling
6. Write/update tests
7. Update documentation
8. Test manually
9. Run linting and tests
10. Create PR
\`\`\`

### Step 3: Follow the Implementation Guide

The implementation guide provides:
- **Exact file structures** - Copy and adapt the code examples
- **Complete implementations** - Production-ready code you can use
- **Best practices** - Error handling, performance optimization
- **Testing guidance** - What to test and how

### Step 4: Implementation Pattern

Follow this pattern for each file:

1. **Create/Open the file**
2. **Copy the example code** from the implementation guide
3. **Adapt to fit** the existing codebase patterns
4. **Add error handling** appropriate for this use case
5. **Test the changes** incrementally
6. **Commit** with a clear message

### Step 5: Testing Checklist

Before marking tasks complete:
- [ ] Code works as expected
- [ ] No console errors
- [ ] Linting passes (\`npm run lint\`)
- [ ] Tests pass (\`npm test\`)
- [ ] Manual testing in Chrome
- [ ] No performance regressions
- [ ] Edge cases handled

### Step 6: Documentation

Update these files as needed:
- Code comments (JSDoc style)
- \`README.md\` (if user-facing changes)
- \`CHANGELOG.md\` (add entry for this enhancement)

## Reference Documentation

- **Implementation Examples**: \`IMPLEMENTATION_EXAMPLES.md\` or \`IMPLEMENTATION_EXAMPLES_PART2.md\`
- **Enhancement Matrix**: \`ENHANCEMENT_MATRIX_V2.md\` (for context and priorities)
- **Workflow Guide**: \`BRANCH_WORKFLOW_GUIDE.md\` (for git workflow)
- **Main README**: \`README.md\` (for project overview)

## Files You'll Work With

Check the implementation guide for the specific list, but typically you'll:
- Create new files in \`lib/\`, \`components/\`, or similar
- Modify \`background.js\`, \`offscreen.js\`, \`sidepanel.js\`, etc.
- Update \`manifest.json\` if needed
- Add/update tests

## Commit Message Format

Use conventional commits:
\`\`\`
feat(scope): short description

- Bullet point of changes
- Another change

Implements enhancement #${ENHANCEMENT_NUM}
Estimated LOC: [from guide]
\`\`\`

Example:
\`\`\`
feat(search): implement ONNX runtime optimization

- Preload ONNX model on extension install
- Add WebGPU execution provider support
- Keep model in memory to avoid reload

Implements enhancement #5
Estimated LOC: 300
Performance: 2-3s → <200ms
\`\`\`

## When You're Done

Run the finish script to validate:
\`\`\`bash
./scripts/finish-enhancement-branch.sh
\`\`\`

This will:
- Run linting
- Run tests
- Check for uncommitted changes
- Provide PR template

Then push and create PR:
\`\`\`bash
git push -u origin ${BRANCH_NAME}
gh pr create
\`\`\`

## Need Help?

- **Implementation stuck?** Re-read the code examples in the guide
- **Unclear requirements?** Check the Enhancement Matrix for context
- **Code pattern questions?** Look at similar existing code
- **Testing questions?** See existing test files for patterns

## Current Branch

\`${BRANCH_NAME}\`

---

**Ready to start? Begin by opening \`IMPLEMENTATION_EXAMPLES.md\` and finding Enhancement #${ENHANCEMENT_NUM}.**

Good luck! 🚀
EOF

echo "✅ Created TASK.md with Claude-ready prompt"
echo ""

# Create .claude directory for session hooks (optional)
mkdir -p .claude

cat > .claude/session-start.md << EOF
# Enhancement #${ENHANCEMENT_NUM} Session

Working on: ${BRANCH_NAME}

Please read TASK.md for the complete implementation task.

Quick context:
- This is Enhancement #${ENHANCEMENT_NUM} from the Enhancement Matrix
- See IMPLEMENTATION_EXAMPLES.md for detailed implementation guide
- Use TodoWrite to track progress
- Follow the code examples closely
EOF

echo "✅ Created .claude/session-start.md for context"
echo ""

# Stage and commit the task files
git add TASK.md .claude/
git commit -m "chore: add task files for enhancement #${ENHANCEMENT_NUM}

Created Claude-ready task file and session context for systematic
implementation of this enhancement.
" || echo "⚠️  No changes to commit (files may already exist)"

echo ""
echo "✅ Branch created successfully!"
echo ""
echo "📚 Next steps for Claude:"
echo "   1. Open TASK.md - this is your main task description"
echo "   2. Read IMPLEMENTATION_EXAMPLES.md section for #${ENHANCEMENT_NUM}"
echo "   3. Create implementation plan with TodoWrite"
echo "   4. Follow the step-by-step guide"
echo ""
echo "💡 To start Claude with this task:"
echo "   - Open Claude Code in this repository"
echo "   - It will read .claude/session-start.md automatically"
echo "   - Or manually open and share TASK.md with Claude"
echo ""
echo "📖 Quick reference:"
echo "   - Task file: TASK.md"
echo "   - Implementation guide: IMPLEMENTATION_EXAMPLES.md"
echo "   - Enhancement Matrix: ENHANCEMENT_MATRIX_V2.md"
echo ""
echo "Happy coding! 🚀"
