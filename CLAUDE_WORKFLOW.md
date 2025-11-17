# Claude Workflow for Enhancements

This guide explains how to use Claude (AI assistant) to implement the 63 enhancements systematically.

## Overview

We provide **three different workflows** for starting enhancement work:

1. **🚀 Full Workflow (Recommended)** - Automated branch + detailed task generation
2. **📝 Task Generation Only** - Generate detailed task for current branch
3. **⚡ Quick Branch** - Simple branch creation with basic task

---

## Option 1: Full Workflow (Recommended) 🚀

**Best for**: Starting a new enhancement from scratch with complete Claude integration.

### Usage

```bash
./scripts/start-enhancement.sh <number> <short-name>

# Example
./scripts/start-enhancement.sh 5 onnx-optimization
```

### What It Does

1. ✅ Creates feature branch: `feature/enhancement-5-onnx-optimization`
2. ✅ Parses Enhancement Matrix for details (title, severity, time, etc.)
3. ✅ Parses Implementation Guide for file structure
4. ✅ Generates detailed `TASK.md` with:
   - Full enhancement context
   - Business value and use cases
   - Step-by-step implementation plan
   - Specific files to create/modify
   - TodoWrite template
   - Testing checklist
   - Commit message template
5. ✅ Creates `.claude/session-start.md` for Claude Code auto-loading
6. ✅ Commits task files to the branch

### Claude Integration

When you open Claude Code in this branch, it will:
- Automatically load context from `.claude/session-start.md`
- Know which enhancement you're working on
- Have immediate access to the task details

**To start with Claude:**
```bash
# Open Claude Code in your editor
# Or share TASK.md content with Claude:
cat TASK.md | pbcopy  # Mac
cat TASK.md | xclip   # Linux
```

### Example Output

```
🚀 Starting Enhancement #5
   Branch: feature/enhancement-5-onnx-optimization

✅ Found: ONNX Runtime Optimization
   Severity: High
   Time: Medium
   Complexity: Med
   Estimated LOC: 300
   Files to create: 0
   Files to modify: 2

✅ Created TASK.md with detailed enhancement information
✅ Created .claude/session-start.md for Claude Code integration

📋 Files created:
   ├─ TASK.md - Your complete implementation task
   └─ .claude/session-start.md - Claude Code session context

🎯 Next steps:
   1. READ THE TASK: cat TASK.md
   2. START CLAUDE: Open Claude Code or share TASK.md
   3. IMPLEMENT: Follow the step-by-step guide
```

---

## Option 2: Task Generation Only 📝

**Best for**: You already have a branch, just need the detailed task file.

### Usage

```bash
# First, checkout your branch
git checkout feature/enhancement-5-onnx-optimization

# Then generate the task
node scripts/create-enhancement-task.js 5
```

### What It Does

1. ✅ Parses Enhancement Matrix (#5)
2. ✅ Parses Implementation Guide
3. ✅ Generates `TASK.md` with all details
4. ✅ Creates `.claude/session-start.md`
5. ⚠️ Does NOT create branch or commit (you do this manually)

### When to Use

- You created a branch manually
- You want to regenerate the task file
- You're on an existing branch and need Claude context

### Example

```bash
# Already on a branch
git checkout feature/enhancement-5-onnx-optimization

# Generate detailed task
node scripts/create-enhancement-task.js 5

# Now open with Claude
cat TASK.md  # Read the task
# Share with Claude or let Claude Code auto-load it
```

---

## Option 3: Quick Branch ⚡

**Best for**: Quick branch creation with minimal task file (basic workflow).

### Usage

```bash
./scripts/create-enhancement-branch.sh <number> <short-name>

# Example
./scripts/create-enhancement-branch.sh 5 onnx-optimization
```

### What It Does

1. ✅ Creates feature branch
2. ✅ Creates basic `TASK.md` (generic template)
3. ✅ Creates `.claude/session-start.md` (basic)
4. ✅ Commits task files
5. ⚠️ Does NOT parse matrix (no detailed info)

### When to Use

- You want to start quickly
- You'll write your own task breakdown
- You don't need parsed details from the matrix

---

## Comparison Table

| Feature | Full Workflow | Task Only | Quick Branch |
|---------|--------------|-----------|--------------|
| Script | `start-enhancement.sh` | `create-enhancement-task.js` | `create-enhancement-branch.sh` |
| Creates branch | ✅ | ❌ | ✅ |
| Parses matrix | ✅ | ✅ | ❌ |
| Parses impl guide | ✅ | ✅ | ❌ |
| Detailed TASK.md | ✅ | ✅ | Basic |
| Claude session | ✅ | ✅ | Basic |
| Auto-commits | ✅ | ❌ | ✅ |
| Best for | New enhancement | Existing branch | Quick start |

---

## Working with Claude

### Method 1: Claude Code (Automatic)

Claude Code (the official CLI/editor integration) automatically loads session context:

1. Create enhancement with any script
2. Open Claude Code in the repository
3. Claude automatically reads `.claude/session-start.md`
4. Start implementing with full context

### Method 2: Claude Web/API (Manual)

Share the task file with Claude manually:

```bash
# Copy task to clipboard
cat TASK.md | pbcopy  # Mac
cat TASK.md | xclip   # Linux
cat TASK.md | clip    # Windows

# Then paste into Claude chat
```

Or start conversation with:
```
I'm working on Enhancement #5 for the Page Indexer Chrome Extension.
I have a detailed task file. Here's the content:

[paste TASK.md content]

Please help me implement this following the step-by-step guide.
```

### Method 3: Share File Path

If Claude has file access:
```
Please read TASK.md and help me implement Enhancement #5 following
the step-by-step guide provided.
```

---

## Example Workflow with Claude

### Full Process

```bash
# 1. Start the enhancement (recommended)
./scripts/start-enhancement.sh 5 onnx-optimization

# 2. Read the generated task
cat TASK.md

# 3. Open Claude Code or share with Claude
# Claude will see:
#   - Enhancement #5: ONNX Runtime Optimization
#   - Business value, use cases, technical details
#   - Files to create/modify
#   - Step-by-step implementation plan
#   - TodoWrite template
#   - Testing checklist

# 4. Claude starts by creating TodoWrite plan
# Claude: "Let me create an implementation plan..."
# Claude will use TodoWrite tool with tasks from TASK.md

# 5. Claude implements following the guide
# Claude reads IMPLEMENTATION_EXAMPLES.md for code
# Claude creates/modifies files as specified
# Claude tests incrementally

# 6. You finish when Claude completes
./scripts/finish-enhancement-branch.sh
git push -u origin feature/enhancement-5-onnx-optimization
gh pr create
```

---

## TASK.md Structure

The generated TASK.md includes:

### 1. Enhancement Overview
- Title, number, status
- Severity, time estimate, complexity
- Business value and use cases

### 2. Implementation Steps
- Step-by-step guide
- Files to create (with checkboxes)
- Files to modify (with checkboxes)
- Implementation pattern to follow

### 3. TodoWrite Template
Pre-filled template Claude can use:
```javascript
TodoWrite({
  todos: [
    { content: "Review implementation guide", status: "in_progress", ... },
    { content: "Create new files", status: "pending", ... },
    // ... more tasks
  ]
})
```

### 4. Code Quality Checklist
- Style guidelines
- Error handling
- Edge cases
- Performance

### 5. Testing Checklist
- Unit tests
- Manual testing
- Linting
- No regressions

### 6. Documentation Requirements
- JSDoc comments
- README updates
- CHANGELOG entry

### 7. Commit Template
Pre-written commit message format

### 8. Reference Links
- Implementation guide location
- Enhancement matrix section
- Related documentation

---

## Claude's Workflow

When you share TASK.md with Claude, it will typically:

### 1. Read and Understand
```
Claude: "I'll implement Enhancement #5: ONNX Runtime Optimization.
Let me start by reviewing the task details..."
```

### 2. Create Implementation Plan
```
Claude: "I'll use TodoWrite to track this implementation:
TodoWrite({
  todos: [
    { content: "Review implementation guide for enhancement #5",
      status: "in_progress",
      activeForm: "Reviewing implementation guide" },
    ...
  ]
})
```

### 3. Read Implementation Guide
```
Claude: "Let me read IMPLEMENTATION_EXAMPLES.md for Enhancement #5..."
[Claude reads the detailed code examples]
```

### 4. Implement Files
```
Claude: "Based on the guide, I need to modify these files:
- offscreen.js - Add preload logic
- background.js - Trigger preload

Starting with offscreen.js..."
[Claude creates/modifies files following examples]
```

### 5. Test and Validate
```
Claude: "Implementation complete. Let me verify:
✓ Code follows the examples
✓ Error handling added
✓ Testing checklist complete
✓ Documentation updated"
```

### 6. Mark Complete
```
Claude: "All tasks complete. Ready to run:
./scripts/finish-enhancement-branch.sh"
```

---

## Tips for Best Results

### For Users

1. **Choose the right workflow**
   - New enhancement → Use `start-enhancement.sh`
   - Existing branch → Use `create-enhancement-task.js`
   - Quick start → Use `create-enhancement-branch.sh`

2. **Share complete context**
   - Give Claude the full TASK.md content
   - Mention you have implementation guides
   - Reference the enhancement number

3. **Let Claude use TodoWrite**
   - Claude will track progress
   - You can see what's done/pending
   - Helps organize complex work

4. **Point to examples**
   - Remind Claude to check IMPLEMENTATION_EXAMPLES.md
   - The code examples are production-ready
   - Claude should adapt them, not rewrite

### For Claude

1. **Always use TodoWrite**
   - Break down the task from TASK.md
   - Mark tasks in_progress as you work
   - Mark completed when truly done

2. **Follow the examples closely**
   - Read IMPLEMENTATION_EXAMPLES.md section
   - Use the code patterns shown
   - Adapt to fit existing codebase

3. **Test incrementally**
   - Don't wait until everything is done
   - Test each file as you create it
   - Run linting frequently

4. **Commit frequently**
   - Small, focused commits
   - Use the commit template format
   - Clear, descriptive messages

---

## Troubleshooting

### "Enhancement not found in matrix"
```bash
# Check the enhancement number exists
grep "| 5 |" ENHANCEMENT_MATRIX_V2.md

# Valid numbers are 1-63
./scripts/start-enhancement.sh 5 onnx-optimization  # ✓
./scripts/start-enhancement.sh 99 invalid  # ✗
```

### "Branch already exists"
```bash
# Delete and recreate
git branch -D feature/enhancement-5-onnx-optimization
./scripts/start-enhancement.sh 5 onnx-optimization

# Or just checkout existing
git checkout feature/enhancement-5-onnx-optimization
node scripts/create-enhancement-task.js 5  # Regenerate task
```

### "Node not found"
```bash
# Install Node.js for the task generator
# Or use the quick branch script instead
./scripts/create-enhancement-branch.sh 5 onnx-optimization
```

### Claude not seeing context
```bash
# Manually share the task
cat TASK.md

# Or recreate session context
node scripts/create-enhancement-task.js 5
```

---

## Advanced: Custom Task Templates

You can customize the task generation by editing:

```bash
scripts/create-enhancement-task.js
```

Modify the `generateTaskMarkdown()` function to:
- Add custom sections
- Change the structure
- Include additional context
- Customize for your workflow

---

## Summary

**Quick Reference:**

```bash
# Recommended: Full workflow
./scripts/start-enhancement.sh <number> <name>

# Alternative: Task only
node scripts/create-enhancement-task.js <number>

# Alternative: Quick branch
./scripts/create-enhancement-branch.sh <number> <name>

# When done
./scripts/finish-enhancement-branch.sh
```

**What you get:**
- ✅ Feature branch created
- ✅ Detailed TASK.md file
- ✅ Claude session context
- ✅ Step-by-step implementation guide
- ✅ TodoWrite template
- ✅ Testing checklist
- ✅ Commit template
- ✅ Reference documentation

**How Claude uses it:**
1. Reads TASK.md (automatically or manually)
2. Creates TodoWrite plan
3. Reads implementation guide
4. Implements following examples
5. Tests and validates
6. Marks tasks complete

---

Ready to implement enhancements with Claude! 🚀
