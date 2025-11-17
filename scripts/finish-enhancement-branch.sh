#!/bin/bash
# Script to finish an enhancement branch
# Runs tests, linting, and prepares for PR
# Usage: ./scripts/finish-enhancement-branch.sh

CURRENT_BRANCH=$(git branch --show-current)

# Check if on an enhancement branch
if [[ ! "$CURRENT_BRANCH" =~ ^feature/enhancement-[0-9]+ ]]; then
  echo "❌ Error: Not on an enhancement branch"
  echo "   Current branch: $CURRENT_BRANCH"
  echo "   Expected format: feature/enhancement-{number}-{name}"
  echo ""
  exit 1
fi

# Extract enhancement number
ENHANCEMENT_NUM=$(echo "$CURRENT_BRANCH" | grep -oP 'enhancement-\K[0-9]+')

echo "🏁 Finishing enhancement branch"
echo "   Branch: $CURRENT_BRANCH"
echo "   Enhancement: #$ENHANCEMENT_NUM"
echo ""

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo "⚠️  Warning: You have uncommitted changes"
  git status -s
  echo ""
  read -p "Commit changes first? (Y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "Please commit your changes and run this script again"
    exit 1
  fi
fi

# Run linter if available
if command -v npm &> /dev/null && [ -f "package.json" ]; then
  if grep -q "\"lint\"" package.json; then
    echo "🔍 Running linter..."
    npm run lint
    if [ $? -ne 0 ]; then
      echo ""
      echo "❌ Linting failed. Please fix the errors and try again."
      exit 1
    fi
    echo "✅ Linting passed"
    echo ""
  fi

  # Run tests if available
  if grep -q "\"test\"" package.json; then
    echo "🧪 Running tests..."
    npm test
    if [ $? -ne 0 ]; then
      echo ""
      echo "❌ Tests failed. Please fix the errors and try again."
      exit 1
    fi
    echo "✅ Tests passed"
    echo ""
  fi

  # Run type check if available
  if grep -q "\"type-check\"" package.json; then
    echo "📝 Running type check..."
    npm run type-check
    if [ $? -ne 0 ]; then
      echo ""
      echo "❌ Type check failed. Please fix the errors and try again."
      exit 1
    fi
    echo "✅ Type check passed"
    echo ""
  fi
fi

echo "✅ All checks passed!"
echo ""
echo "📤 Next steps:"
echo ""
echo "1. Push your branch:"
echo "   git push -u origin $CURRENT_BRANCH"
echo ""
echo "2. Create a Pull Request:"
echo "   - GitHub UI: https://github.com/your-org/page-indexer/compare"
echo "   - GitHub CLI: gh pr create --title \"Enhancement #${ENHANCEMENT_NUM}: [Title]\" --body \"[Description]\""
echo ""
echo "3. PR Template:"
echo "   ## Enhancement #${ENHANCEMENT_NUM}: [Title]"
echo "   "
echo "   ### Summary"
echo "   [Brief description]"
echo "   "
echo "   ### Changes"
echo "   - [List changes]"
echo "   "
echo "   ### Testing"
echo "   - [x] Unit tests pass"
echo "   - [x] Linting passes"
echo "   - [ ] Manual testing completed"
echo "   "
echo "   ### Checklist"
echo "   - [ ] Self-review completed"
echo "   - [ ] Documentation updated"
echo "   - [ ] No breaking changes"
echo ""
echo "Good luck with your PR! 🎉"
