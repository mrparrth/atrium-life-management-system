---
name: save-progress
description: Analyzes active session work, updates context.md with recent changes, and commits the state as a new checkpoint.
---

# Sync Context & Create Checkpoint

Follow this procedure to record session architectural choices and create a git checkpoint:

1. **Analyze Session Changes**:
   - Run `git status` and `git diff` to identify created, modified, or deleted files.
   - Summarize key architectural decisions, added patterns, or configuration updates made during this session.

2. **Update `context.md`**:
   - Locate `context.md` in the project root (create it if missing).
   - Update the current project status, modified components, and decisions to reflect the exact state.
   - Keep existing core guidelines intact while appending/updating session notes under a clean header.

3. **Stage and Commit**:
   - Stage all updated files including `context.md`: `git add .`
   - Generate a structured commit message following Conventional Commits format:
     ```text
     docs(context): sync session progress and update project state
     
     - Summarize key change 1
     - Summarize key change 2
     - Updated context.md checkpoint
     ```
   - Execute the commit.