---
name: aether-git-workflow
description: Safe Git workflow for AETHER repos — inspect status first, focused commits, branches, never discard user work. Use before committing, branching, reverting, or summarizing changes, and when asked to set up GitHub for this repo.
---

# AETHER Git workflow

## Current state (re-check with `git status` / `git log`)

- AETHER CITY: git initialized on `master`, **no commits, no remote**; everything is untracked. `gh` is authenticated as the user (scopes repo, workflow).
- AETHER MAP (`../Nexus Drone app`): **not a git repository**.

Because there's no history, uncommitted files are the only copy of the user's work. Treat every file as precious.

## First commit (only when the user asks)

1. Confirm `.gitignore` covers `.env*` (except `.env.example`), `node_modules/`, `.next/`, `test-results*/`, `playwright-report/`, `*.tsbuildinfo`, `.nexus/` runtime data if it holds session files. Ask before ignoring things the user may want tracked (e.g. `docs/` evidence media, `.playwright-mcp/`).
2. `git status --porcelain` and check no secret file is staged: `git diff --cached --name-only | grep -i env`.
3. Ask which branch name they want (`main` vs current `master`) before renaming.
4. Creating a GitHub repo (`gh repo create`) is outward-facing: confirm visibility (private by default) and name first.

## Everyday rules

- Start every task with `git status`; note pre-existing changes so you never mix them into your commit.
- One logical change per commit; stage explicit paths (`git add <files>`), not `git add -A`, when other edits exist.
- Message: imperative summary line; body says what was verified (which commands passed).
- Feature work on a branch (`feat/<area>-<topic>`), not directly on the default branch, once history exists.
- Never without explicit approval: `reset --hard`, `checkout -- .`, `clean -fd`, `push --force`, `branch -D`, rewriting history, deleting stashes. Prefer `git stash` / new commits / `git revert` for undo.
- Before reverting something, show the diff of what will be lost.

## Summaries

For change summaries use `git diff --stat` and `git diff` on the actual files; describe behavior changes and verification, not just file lists.
