#!/usr/bin/env node
/**
 * Enhanced script to create Claude-ready task files with parsed enhancement details
 * Usage: node scripts/create-enhancement-task.js <enhancement-number>
 */

const fs = require('fs');
const path = require('path');

const ENHANCEMENT_NUM = process.argv[2];

if (!ENHANCEMENT_NUM) {
  console.error('❌ Error: Enhancement number required');
  console.error('Usage: node scripts/create-enhancement-task.js <enhancement-number>');
  console.error('Example: node scripts/create-enhancement-task.js 5');
  process.exit(1);
}

// Parse Enhancement Matrix to extract details
function parseEnhancementMatrix() {
  const matrixPath = path.join(__dirname, '..', 'ENHANCEMENT_MATRIX_V2.md');
  const content = fs.readFileSync(matrixPath, 'utf8');

  // Find the enhancement in the table
  const tableRegex = new RegExp(`\\| ${ENHANCEMENT_NUM} \\| \\[([^\\]]+)\\].*\\| ([^|]+) \\| ([^|]+) \\| ([^|]+) \\| ([^|]+) \\|`);
  const match = content.match(tableRegex);

  if (!match) {
    console.error(`❌ Enhancement #${ENHANCEMENT_NUM} not found in matrix`);
    return null;
  }

  const title = match[1].trim();
  const status = match[2].trim();
  const severity = match[3].trim();
  const time = match[4].trim();
  const complexity = match[5].trim();

  // Find the detailed section
  const sectionRegex = new RegExp(`### #${ENHANCEMENT_NUM}: ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=###|---|\$)`, 'i');
  const sectionMatch = content.match(sectionRegex);

  let description = '';
  let businessValue = '';
  let technicalBenefits = '';
  let useCases = '';

  if (sectionMatch) {
    const section = sectionMatch[0];

    // Extract description sections
    const businessMatch = section.match(/\*\*Business Value:\*\*([^*]+)/);
    if (businessMatch) businessValue = businessMatch[1].trim();

    const technicalMatch = section.match(/\*\*Technical Benefits:\*\*([^*]+)/);
    if (technicalMatch) technicalBenefits = technicalMatch[1].trim();

    const useCasesMatch = section.match(/\*\*Use Cases:\*\*([^#]+)/);
    if (useCasesMatch) useCases = useCasesMatch[1].trim();
  }

  return {
    number: ENHANCEMENT_NUM,
    title,
    status,
    severity,
    time,
    complexity,
    businessValue,
    technicalBenefits,
    useCases
  };
}

// Parse Implementation Examples to get file details
function parseImplementationGuide() {
  const guidePath1 = path.join(__dirname, '..', 'IMPLEMENTATION_EXAMPLES.md');
  const guidePath2 = path.join(__dirname, '..', 'IMPLEMENTATION_EXAMPLES_PART2.md');

  let content = '';
  if (fs.existsSync(guidePath1)) {
    content += fs.readFileSync(guidePath1, 'utf8');
  }
  if (fs.existsSync(guidePath2)) {
    content += fs.readFileSync(guidePath2, 'utf8');
  }

  // Find the enhancement section
  const sectionRegex = new RegExp(`### #${ENHANCEMENT_NUM}:([\\s\\S]*?)(?=###|---|\$)`);
  const match = content.match(sectionRegex);

  if (!match) {
    return { filesToCreate: [], filesToModify: [], estimatedLOC: 'Unknown' };
  }

  const section = match[0];

  // Extract files to create
  const createMatch = section.match(/\*\*Files to Create:\*\*([^*]+)/);
  const filesToCreate = createMatch
    ? createMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().replace(/^- /, ''))
    : [];

  // Extract files to modify
  const modifyMatch = section.match(/\*\*Files to Modify:\*\*([^*]+)/);
  const filesToModify = modifyMatch
    ? modifyMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().replace(/^- /, ''))
    : [];

  // Extract LOC estimate
  const locMatch = section.match(/\*\*Estimated LOC\*\*: (\d+)/);
  const estimatedLOC = locMatch ? locMatch[1] : 'Unknown';

  return { filesToCreate, filesToModify, estimatedLOC };
}

// Generate task markdown
function generateTaskMarkdown(enhancement, implementation) {
  return `# Enhancement #${enhancement.number}: ${enhancement.title}

You are implementing **Enhancement #${enhancement.number}** for the Page Indexer Chrome Extension.

## Enhancement Details

- **Status**: ${enhancement.status}
- **Severity**: ${enhancement.severity}
- **Time Estimate**: ${enhancement.time}
- **Complexity**: ${enhancement.complexity}
- **Estimated LOC**: ~${implementation.estimatedLOC} lines

## Business Value

${enhancement.businessValue || 'See ENHANCEMENT_MATRIX_V2.md for details'}

## Technical Benefits

${enhancement.technicalBenefits || 'See ENHANCEMENT_MATRIX_V2.md for details'}

## Use Cases

${enhancement.useCases || 'See ENHANCEMENT_MATRIX_V2.md for details'}

---

## Implementation Task

### Step 1: Review Implementation Guide

Open \`IMPLEMENTATION_EXAMPLES.md\` (or \`IMPLEMENTATION_EXAMPLES_PART2.md\`) and search for:
\`\`\`
### #${enhancement.number}: ${enhancement.title}
\`\`\`

Read the entire section carefully, including:
- Branch naming
- File structure
- Code examples
- Implementation patterns
- Testing requirements

### Step 2: Create Implementation Plan

Use TodoWrite to break down this enhancement into tasks:

\`\`\`javascript
TodoWrite({
  todos: [
    { content: "Review implementation guide for #${enhancement.number}", status: "in_progress", activeForm: "Reviewing implementation guide" },
    { content: "Create implementation plan", status: "pending", activeForm: "Creating implementation plan" },
    { content: "Create new files", status: "pending", activeForm: "Creating new files" },
    { content: "Modify existing files", status: "pending", activeForm: "Modifying existing files" },
    { content: "Implement core functionality", status: "pending", activeForm: "Implementing core functionality" },
    { content: "Add error handling", status: "pending", activeForm: "Adding error handling" },
    { content: "Write/update tests", status: "pending", activeForm: "Writing/updating tests" },
    { content: "Update documentation", status: "pending", activeForm: "Updating documentation" },
    { content: "Test manually in Chrome", status: "pending", activeForm: "Testing manually" },
    { content: "Run linting and tests", status: "pending", activeForm: "Running linting and tests" },
  ]
})
\`\`\`

### Step 3: Files to Create

${implementation.filesToCreate.length > 0 ?
  'Based on the implementation guide, create these files:\n\n' +
  implementation.filesToCreate.map(f => `- [ ] ${f}`).join('\n')
  : 'See implementation guide for file structure'}

### Step 4: Files to Modify

${implementation.filesToModify.length > 0 ?
  'Modify these existing files:\n\n' +
  implementation.filesToModify.map(f => `- [ ] ${f}`).join('\n')
  : 'See implementation guide for modifications'}

### Step 5: Implementation Pattern

For each file, follow this pattern:

1. **Read the example** in the implementation guide
2. **Create/open the file** in your editor
3. **Copy the example code** as a starting point
4. **Adapt the code** to fit existing patterns
5. **Add error handling** and edge case checks
6. **Test incrementally** - don't wait until everything is done
7. **Commit frequently** with clear messages

### Step 6: Code Quality Checklist

As you implement:
- [ ] Follow existing code style and conventions
- [ ] Add JSDoc comments for all functions
- [ ] Handle errors gracefully with try/catch
- [ ] Consider edge cases (empty input, null values, etc.)
- [ ] Optimize for performance where applicable
- [ ] Use meaningful variable and function names
- [ ] Keep functions small and focused

### Step 7: Testing Checklist

Before marking complete:
- [ ] Code works as expected (happy path)
- [ ] Edge cases are handled
- [ ] No console errors or warnings
- [ ] Linting passes: \`npm run lint\`
- [ ] Tests pass: \`npm test\`
- [ ] Manual testing in Chrome completed
- [ ] No performance regressions
- [ ] Works on different screen sizes (if UI)

### Step 8: Documentation

Update these as needed:
- [ ] Add/update JSDoc comments in code
- [ ] Update README.md (if user-facing changes)
- [ ] Add CHANGELOG.md entry
- [ ] Document breaking changes (if any)
- [ ] Update user guide (if applicable)

---

## Reference Files

- **Implementation Guide**: \`IMPLEMENTATION_EXAMPLES.md\` or \`IMPLEMENTATION_EXAMPLES_PART2.md\`
- **Enhancement Matrix**: \`ENHANCEMENT_MATRIX_V2.md\` (full context)
- **Workflow Guide**: \`BRANCH_WORKFLOW_GUIDE.md\` (git workflow)
- **README**: \`README.md\` (project overview)

## Example Code Location

Search for \`### #${enhancement.number}:\` in the implementation guide to find:
- Complete code examples
- File structure
- Implementation patterns
- Best practices

## Commit Message Template

\`\`\`
feat(${enhancement.title.toLowerCase().replace(/\s+/g, '-').substring(0, 20)}): ${enhancement.title.substring(0, 50)}

- {describe main change}
- {describe another change}
- {describe impact}

Implements enhancement #${enhancement.number}
Estimated LOC: ${implementation.estimatedLOC}
Time: ${enhancement.time}
\`\`\`

## When Complete

1. **Run validation**:
   \`\`\`bash
   ./scripts/finish-enhancement-branch.sh
   \`\`\`

2. **Review your changes**:
   \`\`\`bash
   git diff origin/main
   \`\`\`

3. **Push to remote**:
   \`\`\`bash
   git push -u origin feature/enhancement-${enhancement.number}-{short-name}
   \`\`\`

4. **Create Pull Request** with this template:
   \`\`\`markdown
   ## Enhancement #${enhancement.number}: ${enhancement.title}

   ### Summary
   {Brief description of what was implemented}

   ### Changes
   - {List key changes}

   ### Testing
   - [x] Unit tests pass
   - [x] Manual testing completed
   - [x] No regressions

   ### Checklist
   - [x] Code follows style guidelines
   - [x] Documentation updated
   - [x] Self-review completed

   Implements enhancement #${enhancement.number}
   \`\`\`

---

## Need Help?

- **Stuck on implementation?** Re-read the code examples, they're production-ready
- **Unclear requirements?** Check Enhancement Matrix for full context
- **Code style questions?** Look at similar files in the codebase
- **Testing help?** Check existing test files for patterns

---

**Ready to implement? Start by reading the implementation guide section for Enhancement #${enhancement.number}.**

**Current branch**: \`feature/enhancement-${enhancement.number}-{branch-name}\`

Good luck! 🚀
`;
}

// Main execution
try {
  console.log(`\n📝 Generating task file for Enhancement #${ENHANCEMENT_NUM}...\n`);

  const enhancement = parseEnhancementMatrix();
  if (!enhancement) {
    process.exit(1);
  }

  const implementation = parseImplementationGuide();

  console.log(`✅ Found: ${enhancement.title}`);
  console.log(`   Severity: ${enhancement.severity}`);
  console.log(`   Time: ${enhancement.time}`);
  console.log(`   Complexity: ${enhancement.complexity}`);
  console.log(`   Estimated LOC: ${implementation.estimatedLOC}`);
  console.log(`   Files to create: ${implementation.filesToCreate.length}`);
  console.log(`   Files to modify: ${implementation.filesToModify.length}`);
  console.log();

  const taskContent = generateTaskMarkdown(enhancement, implementation);

  // Write TASK.md
  fs.writeFileSync('TASK.md', taskContent, 'utf8');
  console.log('✅ Created TASK.md with detailed enhancement information');

  // Create .claude directory
  if (!fs.existsSync('.claude')) {
    fs.mkdirSync('.claude');
  }

  // Write session start hook
  const sessionStart = `# Enhancement #${enhancement.number}: ${enhancement.title}

You are implementing Enhancement #${enhancement.number} for the Page Indexer Chrome Extension.

## Quick Context

- **Title**: ${enhancement.title}
- **Severity**: ${enhancement.severity}
- **Time**: ${enhancement.time}
- **Complexity**: ${enhancement.complexity}

## Your Task

Please read **TASK.md** for the complete implementation task with step-by-step instructions.

## Quick Start

1. Open TASK.md and read it thoroughly
2. Review the implementation guide in IMPLEMENTATION_EXAMPLES.md
3. Create an implementation plan using TodoWrite
4. Follow the code examples and patterns provided
5. Test thoroughly as you implement
6. Commit with clear messages

## Reference

- Main task: TASK.md
- Implementation guide: IMPLEMENTATION_EXAMPLES.md (search for "#${enhancement.number}")
- Enhancement details: ENHANCEMENT_MATRIX_V2.md

Let's build this enhancement! 🚀
`;

  fs.writeFileSync('.claude/session-start.md', sessionStart, 'utf8');
  console.log('✅ Created .claude/session-start.md for Claude Code integration');
  console.log();

  console.log('📚 Next steps:');
  console.log('   1. Open TASK.md to see your complete task');
  console.log('   2. When you open Claude Code, it will auto-load the session context');
  console.log('   3. Or manually share TASK.md with Claude to begin');
  console.log();
  console.log('💡 The TASK.md file includes:');
  console.log('   - Full enhancement details from the matrix');
  console.log('   - Specific files to create/modify');
  console.log('   - Step-by-step implementation guide');
  console.log('   - TodoWrite template');
  console.log('   - Testing checklist');
  console.log('   - Commit message template');
  console.log();
  console.log('✨ Ready to implement Enhancement #' + ENHANCEMENT_NUM + '!');

} catch (error) {
  console.error('❌ Error generating task file:', error.message);
  process.exit(1);
}
