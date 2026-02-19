# Project Shortcuts Design

**Date:** 2026-02-19
**Issue:** [#1 — Request for project shortcuts](https://github.com/Frayo44/agent-view/issues/1)
**Status:** Approved

## Problem

Users working with multiple projects (e.g., X_backend, X_frontend) must navigate to the project directory and create a new session each time. They want quick-launch aliases to instantly open a session in a frequently used project.

## Solution

Shortcuts as first-class entities: a new SQLite table, TUI dialog for management, and CLI flag for instant launch.

## Data Model

New `shortcuts` table in SQLite:

```sql
CREATE TABLE shortcuts (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  tool TEXT NOT NULL DEFAULT 'claude',
  cli_options TEXT DEFAULT '',
  group_path TEXT DEFAULT '',
  skip_permissions INTEGER DEFAULT 0,
  use_worktree INTEGER DEFAULT 0,
  worktree_branch TEXT DEFAULT '',
  use_base_develop INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);
```

TypeScript type:

```typescript
interface Shortcut {
  id: string
  key: string              // 'x', 'be', 'fe'
  name: string             // 'X Backend'
  projectPath: string
  tool: Tool
  cliOptions: string
  groupPath: string
  skipPermissions: boolean
  useWorktree: boolean
  worktreeBranch: string
  useBaseDevelop: boolean
  createdAt: Date
  order: number
}
```

## TUI Design

### Shortcut Management
- `S` key on home screen opens "Manage Shortcuts" dialog
- Dialog lists existing shortcuts with options to add, edit, delete
- Adding a shortcut uses same field patterns as new session dialog (path autocomplete, tool selection, CLI options, worktree toggle) plus a "key" field

### Triggering Shortcuts
- Pressing a shortcut's key on the home screen triggers it (when no dialog/input is focused)
- Built-in keys take priority and cannot be used as shortcut keys
- Shortcut keys are case-sensitive

### Visual Indicator
- Footer section on home screen showing defined shortcuts: `[x] X Backend  [f] X Frontend`

## CLI Integration

```bash
av -s <key>          # Short form
av --shortcut <key>  # Long form
```

Behavior:
1. Look up shortcut by key in SQLite
2. If not found, print error and exit
3. Check for existing running session at that `projectPath` with matching `tool`
4. If running session exists, attach to it (skip TUI)
5. If no running session, create new session with saved options, then attach (skip TUI)
6. On detach (Ctrl+Q), exit `av`

Zero-interaction: `av -s x` instantly attaches or creates.

## Smart Attach-or-Create

When a shortcut is triggered (TUI or CLI):
1. Query sessions where `projectPath` matches AND `tool` matches AND status is running/waiting/idle
2. If found, attach to most recently accessed session
3. If not found, create new session using shortcut's saved options

## Error Handling

- **Key conflicts:** Reserved keys rejected at creation time. Reserved set: `n`, `d`, `r`, `R`, `f`, `F`, `g`, `m`, `s`, `q`, `j`, `k`, `h`, `l`, `1-9`, `Enter`, arrows
- **Path validation:** On trigger, verify `projectPath` exists. Show toast error if missing
- **Multiple sessions:** Match on both `projectPath` and `tool`. Attach to most recently accessed
- **Worktree:** If branch already exists, use existing worktree path instead of failing

## Files to Modify

- `src/core/types.ts` — Add `Shortcut` type
- `src/core/storage.ts` — Add shortcuts table, CRUD methods
- `src/core/session.ts` — Add `findOrCreate` logic for shortcut triggers
- `src/cli/index.ts` — Add `-s`/`--shortcut` flag parsing
- `src/tui/routes/home.tsx` — Add shortcut key handling and footer display
- `src/tui/component/dialog-shortcut.tsx` — New dialog for managing shortcuts
