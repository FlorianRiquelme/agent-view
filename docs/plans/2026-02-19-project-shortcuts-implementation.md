# Project Shortcuts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add project shortcuts that let users define quick-launch aliases for frequently used project paths, triggerable from both the TUI and CLI.

**Architecture:** New `Shortcut` type and `shortcuts` SQLite table for persistence. Storage layer gets CRUD methods. A new `dialog-shortcut.tsx` manages shortcuts in the TUI. The home screen handles shortcut key presses and shows a footer bar. CLI gets `-s`/`--shortcut` flag for direct launch. A shared `triggerShortcut()` function in `session.ts` handles the smart attach-or-create logic.

**Tech Stack:** Bun, Solid.js, OpenTUI, SQLite (bun:sqlite), tmux

---

### Task 1: Add Shortcut type to types.ts

**Files:**
- Modify: `src/core/types.ts:48` (after the `Group` interface)

**Step 1: Add the Shortcut interface and reserved keys constant**

Add after the `Group` interface (line 48) in `src/core/types.ts`:

```typescript
export interface Shortcut {
  id: string
  key: string
  name: string
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

export const RESERVED_SHORTCUT_KEYS = new Set([
  "n", "d", "r", "f", "g", "m", "s", "q", "j", "k", "h", "l",
  "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "R", "F", "S",
])
```

**Step 2: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: add Shortcut type and reserved keys constant"
```

---

### Task 2: Add shortcuts table and CRUD methods to storage

**Files:**
- Modify: `src/core/storage.ts:11` (import Shortcut)
- Modify: `src/core/storage.ts:47-102` (migrate method)
- Modify: `src/core/storage.ts:436-467` (add new methods before `isEmpty()`)

**Step 1: Add Shortcut to imports**

In `src/core/storage.ts` line 11, change:

```typescript
import type { Session, Group, StatusUpdate, Tool, SessionStatus } from "./types"
```

to:

```typescript
import type { Session, Group, StatusUpdate, Tool, SessionStatus, Shortcut } from "./types"
```

**Step 2: Add shortcuts table creation in `migrate()`**

Add after the `heartbeats` table creation (after line 95) in the `migrate()` method:

```typescript
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shortcuts (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        project_path TEXT NOT NULL,
        tool TEXT NOT NULL DEFAULT 'claude',
        cli_options TEXT NOT NULL DEFAULT '',
        group_path TEXT NOT NULL DEFAULT '',
        skip_permissions INTEGER NOT NULL DEFAULT 0,
        use_worktree INTEGER NOT NULL DEFAULT 0,
        worktree_branch TEXT NOT NULL DEFAULT '',
        use_base_develop INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)
```

**Step 3: Add shortcut CRUD methods**

Add before the `// Change detection` comment (line 452) in `storage.ts`:

```typescript
  // Shortcut CRUD

  saveShortcut(shortcut: Shortcut): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO shortcuts (
        id, key, name, project_path, tool, cli_options, group_path,
        skip_permissions, use_worktree, worktree_branch, use_base_develop,
        created_at, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      shortcut.id,
      shortcut.key,
      shortcut.name,
      shortcut.projectPath,
      shortcut.tool,
      shortcut.cliOptions,
      shortcut.groupPath,
      shortcut.skipPermissions ? 1 : 0,
      shortcut.useWorktree ? 1 : 0,
      shortcut.worktreeBranch,
      shortcut.useBaseDevelop ? 1 : 0,
      shortcut.createdAt.getTime(),
      shortcut.order
    )
  }

  loadShortcuts(): Shortcut[] {
    if (this.closed) return []
    const stmt = this.db.prepare(`
      SELECT id, key, name, project_path, tool, cli_options, group_path,
        skip_permissions, use_worktree, worktree_branch, use_base_develop,
        created_at, sort_order
      FROM shortcuts ORDER BY sort_order
    `)
    const rows = stmt.all() as any[]
    return rows.map(row => ({
      id: row.id,
      key: row.key,
      name: row.name,
      projectPath: row.project_path,
      tool: row.tool as Tool,
      cliOptions: row.cli_options,
      groupPath: row.group_path,
      skipPermissions: row.skip_permissions === 1,
      useWorktree: row.use_worktree === 1,
      worktreeBranch: row.worktree_branch,
      useBaseDevelop: row.use_base_develop === 1,
      createdAt: new Date(row.created_at),
      order: row.sort_order
    }))
  }

  getShortcut(id: string): Shortcut | null {
    const stmt = this.db.prepare(`
      SELECT id, key, name, project_path, tool, cli_options, group_path,
        skip_permissions, use_worktree, worktree_branch, use_base_develop,
        created_at, sort_order
      FROM shortcuts WHERE id = ?
    `)
    const row = stmt.get(id) as any
    if (!row) return null
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      projectPath: row.project_path,
      tool: row.tool as Tool,
      cliOptions: row.cli_options,
      groupPath: row.group_path,
      skipPermissions: row.skip_permissions === 1,
      useWorktree: row.use_worktree === 1,
      worktreeBranch: row.worktree_branch,
      useBaseDevelop: row.use_base_develop === 1,
      createdAt: new Date(row.created_at),
      order: row.sort_order
    }
  }

  getShortcutByKey(key: string): Shortcut | null {
    const stmt = this.db.prepare(`
      SELECT id, key, name, project_path, tool, cli_options, group_path,
        skip_permissions, use_worktree, worktree_branch, use_base_develop,
        created_at, sort_order
      FROM shortcuts WHERE key = ?
    `)
    const row = stmt.get(key) as any
    if (!row) return null
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      projectPath: row.project_path,
      tool: row.tool as Tool,
      cliOptions: row.cli_options,
      groupPath: row.group_path,
      skipPermissions: row.skip_permissions === 1,
      useWorktree: row.use_worktree === 1,
      worktreeBranch: row.worktree_branch,
      useBaseDevelop: row.use_base_develop === 1,
      createdAt: new Date(row.created_at),
      order: row.sort_order
    }
  }

  deleteShortcut(id: string): void {
    const stmt = this.db.prepare("DELETE FROM shortcuts WHERE id = ?")
    stmt.run(id)
  }
```

**Step 4: Run the build to verify**

Run: `bun run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/core/storage.ts
git commit -m "feat: add shortcuts table and CRUD methods to storage"
```

---

### Task 3: Add `findOrCreateForShortcut()` to SessionManager

**Files:**
- Modify: `src/core/session.ts:7` (import Shortcut)
- Modify: `src/core/session.ts:491` (add new method before singleton)

**Step 1: Update imports**

In `src/core/session.ts` line 7, change:

```typescript
import type { Session, SessionCreateOptions, SessionForkOptions, SessionStatus, Tool } from "./types"
```

to:

```typescript
import type { Session, SessionCreateOptions, SessionForkOptions, SessionStatus, Tool, Shortcut } from "./types"
```

**Step 2: Add `findOrCreateForShortcut()` method**

Add before the `// Singleton instance` comment (line 494) in `session.ts`:

```typescript
  /**
   * Find an existing active session for a shortcut's project path + tool,
   * or create a new one using the shortcut's saved options.
   * Returns the session to attach to.
   */
  async findOrCreateForShortcut(shortcut: Shortcut): Promise<Session> {
    const storage = getStorage()
    const sessions = storage.loadSessions()

    // Find existing active session matching path + tool
    const activeStatuses: SessionStatus[] = ["running", "waiting", "idle"]
    const matching = sessions
      .filter(s =>
        s.projectPath === shortcut.projectPath &&
        s.tool === shortcut.tool &&
        activeStatuses.includes(s.status)
      )
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())

    if (matching.length > 0) {
      return matching[0]!
    }

    // No active session found — create a new one
    const createOptions: SessionCreateOptions = {
      projectPath: shortcut.projectPath,
      tool: shortcut.tool,
      groupPath: shortcut.groupPath || undefined,
      cliOptions: [
        shortcut.skipPermissions ? "--dangerously-skip-permissions" : "",
        shortcut.cliOptions
      ].filter(Boolean).join(" ") || undefined
    }

    return this.create(createOptions)
  }
```

**Step 3: Run the build to verify**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/core/session.ts
git commit -m "feat: add findOrCreateForShortcut to SessionManager"
```

---

### Task 4: Add shortcut methods to sync context

**Files:**
- Modify: `src/tui/context/sync.tsx:10` (import Shortcut)
- Modify: `src/tui/context/sync.tsx:22` (add shortcuts to store)
- Modify: `src/tui/context/sync.tsx:36` (load shortcuts in refresh)
- Modify: `src/tui/context/sync.tsx:180` (add shortcut methods before `refresh`)

**Step 1: Update imports**

In `src/tui/context/sync.tsx` line 10, change:

```typescript
import type { Session, Group, Config } from "@/core/types"
```

to:

```typescript
import type { Session, Group, Config, Shortcut } from "@/core/types"
```

**Step 2: Add shortcuts to store type**

In `src/tui/context/sync.tsx` line 22, change:

```typescript
    }>({
      sessions: [],
      groups: [],
      config: {}
    })
```

to:

```typescript
    }>({
      sessions: [],
      groups: [],
      shortcuts: [] as Shortcut[],
      config: {}
    })
```

**Step 3: Load shortcuts in refresh**

In `src/tui/context/sync.tsx` inside the `refresh()` function (around line 35-36), change:

```typescript
      const sessions = storage.loadSessions()
      const groups = storage.loadGroups()

      batch(() => {
        setStore("sessions", sessions)
        setStore("groups", groups)
```

to:

```typescript
      const sessions = storage.loadSessions()
      const groups = storage.loadGroups()
      const shortcuts = storage.loadShortcuts()

      batch(() => {
        setStore("sessions", sessions)
        setStore("groups", groups)
        setStore("shortcuts", shortcuts)
```

**Step 4: Add shortcut methods**

Add before the `refresh` property at the end of the returned object (before line 181):

```typescript
      shortcut: {
        list(): Shortcut[] {
          return store.shortcuts
        },
        getByKey(key: string): Shortcut | undefined {
          return store.shortcuts.find(s => s.key === key)
        },
        save(shortcut: Shortcut): void {
          storage.saveShortcut(shortcut)
          refresh()
        },
        delete(id: string): void {
          storage.deleteShortcut(id)
          refresh()
        },
        async trigger(shortcut: Shortcut): Promise<Session> {
          const session = await manager.findOrCreateForShortcut(shortcut)
          refresh()
          return session
        }
      },
```

**Step 5: Run the build to verify**

Run: `bun run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/tui/context/sync.tsx
git commit -m "feat: add shortcut methods to sync context"
```

---

### Task 5: Create the shortcut management dialog

**Files:**
- Create: `src/tui/component/dialog-shortcut.tsx`
- Modify: `src/tui/component/index.ts` (export new dialog)

**Step 1: Create the dialog component**

Create `src/tui/component/dialog-shortcut.tsx` with a dialog that:
- Lists existing shortcuts in a scrollable list
- Shows each shortcut as: `[key] Name — path (tool)`
- Provides "Add" button to open an inline form
- Each existing shortcut has "Delete" action
- The add form has fields for: key (single input), name, project path (with autocomplete), tool selection, CLI options, skip permissions checkbox, worktree checkbox + branch
- Validates key is not reserved and not already taken
- On save, creates a `Shortcut` object with `randomUUID()` and calls `sync.shortcut.save()`

Follow the same patterns as `dialog-new.tsx` for:
- `useDialog()`, `useTheme()`, `useSync()`, `useToast()` hooks
- Tab navigation between fields
- `useKeyboard()` for Escape (close), Enter (save), Tab (navigate)
- `InputAutocomplete` for path field
- Tool selection radio buttons
- Checkbox toggles

```typescript
/**
 * Shortcut management dialog
 */

import { createSignal, createEffect, For, Show, onCleanup } from "solid-js"
import { TextAttributes, InputRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { InputAutocomplete } from "@tui/ui/input-autocomplete"
import { HistoryManager } from "@/core/history"
import { getStorage } from "@/core/storage"
import type { Tool, Shortcut } from "@/core/types"
import { RESERVED_SHORTCUT_KEYS } from "@/core/types"
import { randomUUID } from "crypto"

const projectPathHistory = new HistoryManager("dialog-shortcut:project-paths", 30)

const TOOLS: { value: Tool; label: string }[] = [
  { value: "claude", label: "Claude Code" },
  { value: "opencode", label: "OpenCode" },
  { value: "gemini", label: "Gemini" },
  { value: "codex", label: "Codex" },
  { value: "custom", label: "Custom" },
  { value: "shell", label: "Shell" }
]

type DialogMode = "list" | "add"
type FocusField = "key" | "name" | "tool" | "path" | "cliOptions" | "skipPermissions" | "worktree" | "branch"

export function DialogShortcut() {
  const dialog = useDialog()
  const sync = useSync()
  const toast = useToast()
  const { theme } = useTheme()
  const storage = getStorage()

  const [mode, setMode] = createSignal<DialogMode>("list")
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  // Add form state
  const [key, setKey] = createSignal("")
  const [name, setName] = createSignal("")
  const [selectedTool, setSelectedTool] = createSignal<Tool>("claude")
  const [projectPath, setProjectPath] = createSignal(process.cwd())
  const [cliOptions, setCliOptions] = createSignal("")
  const [skipPermissions, setSkipPermissions] = createSignal(false)
  const [useWorktree, setUseWorktree] = createSignal(false)
  const [worktreeBranch, setWorktreeBranch] = createSignal("")
  const [focusedField, setFocusedField] = createSignal<FocusField>("key")
  const [toolIndex, setToolIndex] = createSignal(0)
  const [errorMessage, setErrorMessage] = createSignal("")

  let keyInputRef: InputRenderable | undefined
  let nameInputRef: InputRenderable | undefined
  let pathInputRef: InputRenderable | undefined
  let cliOptionsInputRef: InputRenderable | undefined
  let branchInputRef: InputRenderable | undefined

  const shortcuts = () => sync.shortcut.list()

  // Focus management
  createEffect(() => {
    if (mode() !== "add") return
    const field = focusedField()
    if (field === "key") keyInputRef?.focus(); else keyInputRef?.blur()
    if (field === "name") nameInputRef?.focus(); else nameInputRef?.blur()
    if (field === "path") pathInputRef?.focus(); else pathInputRef?.blur()
    if (field === "cliOptions") cliOptionsInputRef?.focus(); else cliOptionsInputRef?.blur()
    if (field === "branch") branchInputRef?.focus(); else branchInputRef?.blur()
  })

  function getFocusableFields(): FocusField[] {
    const fields: FocusField[] = ["key", "name", "tool", "path", "cliOptions"]
    if (selectedTool() === "claude") {
      fields.push("skipPermissions")
    }
    fields.push("worktree")
    if (useWorktree()) {
      fields.push("branch")
    }
    return fields
  }

  function resetForm() {
    setKey("")
    setName("")
    setSelectedTool("claude")
    setProjectPath(process.cwd())
    setCliOptions("")
    setSkipPermissions(false)
    setUseWorktree(false)
    setWorktreeBranch("")
    setFocusedField("key")
    setToolIndex(0)
    setErrorMessage("")
  }

  function handleSave() {
    setErrorMessage("")
    const k = key().trim()
    if (!k) {
      setErrorMessage("Key is required")
      return
    }
    if (RESERVED_SHORTCUT_KEYS.has(k)) {
      setErrorMessage(`Key "${k}" is reserved`)
      return
    }
    if (shortcuts().some(s => s.key === k)) {
      setErrorMessage(`Key "${k}" is already in use`)
      return
    }
    if (!name().trim()) {
      setErrorMessage("Name is required")
      return
    }
    if (!projectPath().trim()) {
      setErrorMessage("Project path is required")
      return
    }

    const shortcut: Shortcut = {
      id: randomUUID(),
      key: k,
      name: name().trim(),
      projectPath: projectPath().trim(),
      tool: selectedTool(),
      cliOptions: cliOptions().trim(),
      groupPath: "",
      skipPermissions: skipPermissions(),
      useWorktree: useWorktree(),
      worktreeBranch: worktreeBranch().trim(),
      useBaseDevelop: false,
      createdAt: new Date(),
      order: shortcuts().length
    }

    sync.shortcut.save(shortcut)
    projectPathHistory.addEntry(storage, projectPath().trim())
    toast.show({ message: `Shortcut [${k}] created`, variant: "success", duration: 2000 })
    resetForm()
    setMode("list")
  }

  function handleDelete(shortcut: Shortcut) {
    sync.shortcut.delete(shortcut.id)
    toast.show({ message: `Deleted shortcut [${shortcut.key}]`, variant: "info", duration: 2000 })
  }

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault()
      if (mode() === "add") {
        resetForm()
        setMode("list")
      } else {
        dialog.clear()
      }
      return
    }

    if (mode() === "list") {
      if (evt.name === "up" || evt.name === "k") {
        const len = shortcuts().length
        if (len > 0) setSelectedIndex((selectedIndex() - 1 + len) % len)
      }
      if (evt.name === "down" || evt.name === "j") {
        const len = shortcuts().length
        if (len > 0) setSelectedIndex((selectedIndex() + 1) % len)
      }
      if (evt.name === "a" || evt.name === "n") {
        evt.preventDefault()
        resetForm()
        setMode("add")
      }
      if (evt.name === "d" || evt.name === "x") {
        const s = shortcuts()[selectedIndex()]
        if (s) handleDelete(s)
      }
      return
    }

    // Add mode
    if (evt.name === "return" && !evt.shift) {
      evt.preventDefault()
      handleSave()
      return
    }

    if (evt.name === "tab") {
      evt.preventDefault()
      const fields = getFocusableFields()
      const currentIdx = fields.indexOf(focusedField())
      const nextIdx = evt.shift
        ? (currentIdx - 1 + fields.length) % fields.length
        : (currentIdx + 1) % fields.length
      const nextField = fields[nextIdx]
      if (nextField) setFocusedField(nextField)
      return
    }

    if (focusedField() === "tool") {
      if (evt.name === "up" || evt.name === "k") {
        evt.preventDefault()
        const newIdx = (toolIndex() - 1 + TOOLS.length) % TOOLS.length
        setToolIndex(newIdx)
        const tool = TOOLS[newIdx]
        if (tool) setSelectedTool(tool.value)
      }
      if (evt.name === "down" || evt.name === "j") {
        evt.preventDefault()
        const newIdx = (toolIndex() + 1) % TOOLS.length
        setToolIndex(newIdx)
        const tool = TOOLS[newIdx]
        if (tool) setSelectedTool(tool.value)
      }
    }

    if (focusedField() === "skipPermissions" && evt.name === "space") {
      evt.preventDefault()
      setSkipPermissions(!skipPermissions())
    }

    if (focusedField() === "worktree" && evt.name === "space") {
      evt.preventDefault()
      setUseWorktree(!useWorktree())
    }
  })

  return (
    <box gap={1} paddingBottom={1}>
      {/* Header */}
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            {mode() === "list" ? "Manage Shortcuts" : "Add Shortcut"}
          </text>
          <text fg={theme.textMuted} onMouseUp={() => {
            if (mode() === "add") { resetForm(); setMode("list") }
            else dialog.clear()
          }}>
            esc
          </text>
        </box>
      </box>

      <Show when={mode() === "list"}>
        {/* Shortcut list */}
        <box paddingLeft={4} paddingRight={4}>
          <Show
            when={shortcuts().length > 0}
            fallback={
              <text fg={theme.textMuted}>No shortcuts defined yet</text>
            }
          >
            <box gap={0}>
              <For each={shortcuts()}>
                {(shortcut, idx) => (
                  <box
                    flexDirection="row"
                    gap={1}
                    paddingLeft={1}
                    height={1}
                    backgroundColor={idx() === selectedIndex() ? theme.primary : undefined}
                    onMouseUp={() => setSelectedIndex(idx())}
                  >
                    <text
                      fg={idx() === selectedIndex() ? theme.selectedListItemText : theme.accent}
                      attributes={TextAttributes.BOLD}
                    >
                      [{shortcut.key}]
                    </text>
                    <text fg={idx() === selectedIndex() ? theme.selectedListItemText : theme.text}>
                      {shortcut.name}
                    </text>
                    <text fg={idx() === selectedIndex() ? theme.selectedListItemText : theme.textMuted}>
                      {shortcut.tool}
                    </text>
                  </box>
                )}
              </For>
            </box>
          </Show>
        </box>

        {/* List footer */}
        <box paddingLeft={4} paddingRight={4} paddingTop={1}>
          <text fg={theme.textMuted}>
            a: add | d: delete | esc: close
          </text>
        </box>
      </Show>

      <Show when={mode() === "add"}>
        {/* Key field */}
        <box paddingLeft={4} paddingRight={4} gap={1}>
          <text fg={focusedField() === "key" ? theme.primary : theme.textMuted}>
            Key (single character)
          </text>
          <box onMouseUp={() => setFocusedField("key")}>
            <input
              placeholder="e.g., x"
              value={key()}
              onInput={(v) => setKey(v.slice(0, 2))}
              focusedBackgroundColor={theme.backgroundElement}
              cursorColor={theme.primary}
              focusedTextColor={theme.text}
              ref={(r) => {
                keyInputRef = r
                setTimeout(() => { if (focusedField() === "key") keyInputRef?.focus() }, 1)
              }}
            />
          </box>
        </box>

        {/* Name field */}
        <box paddingLeft={4} paddingRight={4} paddingTop={1} gap={1}>
          <text fg={focusedField() === "name" ? theme.primary : theme.textMuted}>
            Name
          </text>
          <box onMouseUp={() => setFocusedField("name")}>
            <input
              placeholder="e.g., X Backend"
              value={name()}
              onInput={setName}
              focusedBackgroundColor={theme.backgroundElement}
              cursorColor={theme.primary}
              focusedTextColor={theme.text}
              ref={(r) => { nameInputRef = r }}
            />
          </box>
        </box>

        {/* Tool selection */}
        <box paddingLeft={4} paddingRight={4} paddingTop={1} gap={1}>
          <text fg={focusedField() === "tool" ? theme.primary : theme.textMuted}>
            Tool
          </text>
          <box gap={0}>
            <For each={TOOLS}>
              {(tool, idx) => (
                <box
                  flexDirection="row"
                  gap={1}
                  paddingLeft={1}
                  backgroundColor={selectedTool() === tool.value ? theme.backgroundElement : undefined}
                  onMouseUp={() => { setSelectedTool(tool.value); setToolIndex(idx()); setFocusedField("tool") }}
                >
                  <text fg={selectedTool() === tool.value ? theme.primary : theme.textMuted}>
                    {selectedTool() === tool.value ? "\u25CF" : "\u25CB"}
                  </text>
                  <text fg={theme.text}>{tool.label}</text>
                </box>
              )}
            </For>
          </box>
        </box>

        {/* Project path */}
        <box paddingLeft={4} paddingRight={4} paddingTop={1} gap={1}>
          <text fg={focusedField() === "path" ? theme.primary : theme.textMuted}>
            Project Path
          </text>
          <InputAutocomplete
            value={projectPath()}
            onInput={setProjectPath}
            suggestions={projectPathHistory.getFiltered(storage, projectPath())}
            onSelect={setProjectPath}
            focusedBackgroundColor={theme.backgroundElement}
            cursorColor={theme.primary}
            focusedTextColor={theme.text}
            onFocus={() => setFocusedField("path")}
            ref={(r) => { pathInputRef = r }}
          />
        </box>

        {/* CLI Options */}
        <box paddingLeft={4} paddingRight={4} paddingTop={1} gap={1}>
          <text fg={focusedField() === "cliOptions" ? theme.primary : theme.textMuted}>
            CLI Options (optional)
          </text>
          <box onMouseUp={() => setFocusedField("cliOptions")}>
            <input
              placeholder="e.g., --model opus"
              value={cliOptions()}
              onInput={setCliOptions}
              focusedBackgroundColor={theme.backgroundElement}
              cursorColor={theme.primary}
              focusedTextColor={theme.text}
              ref={(r) => { cliOptionsInputRef = r }}
            />
          </box>
        </box>

        {/* Skip permissions (Claude only) */}
        <Show when={selectedTool() === "claude"}>
          <box paddingLeft={4} paddingRight={4} paddingTop={1}>
            <box
              flexDirection="row"
              gap={1}
              onMouseUp={() => { setFocusedField("skipPermissions"); setSkipPermissions(!skipPermissions()) }}
            >
              <text fg={focusedField() === "skipPermissions" ? theme.primary : theme.textMuted}>
                {skipPermissions() ? "[x]" : "[ ]"}
              </text>
              <text fg={focusedField() === "skipPermissions" ? theme.text : theme.textMuted}>
                Dangerously skip permissions
              </text>
            </box>
          </box>
        </Show>

        {/* Worktree toggle */}
        <box paddingLeft={4} paddingRight={4} paddingTop={1} gap={1}>
          <box
            flexDirection="row"
            gap={1}
            onMouseUp={() => { setFocusedField("worktree"); setUseWorktree(!useWorktree()) }}
          >
            <text fg={focusedField() === "worktree" ? theme.primary : theme.textMuted}>
              {useWorktree() ? "[x]" : "[ ]"}
            </text>
            <text fg={focusedField() === "worktree" ? theme.text : theme.textMuted}>
              Create in git worktree
            </text>
          </box>

          <Show when={useWorktree()}>
            <box paddingLeft={4} gap={1}>
              <text fg={focusedField() === "branch" ? theme.primary : theme.textMuted}>
                Branch name
              </text>
              <box onMouseUp={() => setFocusedField("branch")}>
                <input
                  placeholder="auto-generated if empty"
                  value={worktreeBranch()}
                  onInput={setWorktreeBranch}
                  focusedBackgroundColor={theme.backgroundElement}
                  cursorColor={theme.primary}
                  focusedTextColor={theme.text}
                  ref={(r) => { branchInputRef = r }}
                />
              </box>
            </box>
          </Show>
        </box>

        {/* Error display */}
        <Show when={errorMessage()}>
          <box paddingLeft={4} paddingRight={4} paddingTop={1}>
            <box backgroundColor={theme.error} padding={1}>
              <text fg={theme.selectedListItemText} wrapMode="word">
                {errorMessage()}
              </text>
            </box>
          </box>
        </Show>

        {/* Save button */}
        <box paddingLeft={4} paddingRight={4} paddingTop={2}>
          <box backgroundColor={theme.primary} padding={1} onMouseUp={handleSave} alignItems="center">
            <text fg={theme.selectedListItemText} attributes={TextAttributes.BOLD}>
              Save Shortcut
            </text>
          </box>
        </box>

        {/* Footer */}
        <box paddingLeft={4} paddingRight={4} paddingTop={1}>
          <text fg={theme.textMuted}>Tab | Enter: save | Esc: back</text>
        </box>
      </Show>
    </box>
  )
}
```

**Step 2: Export the dialog**

In `src/tui/component/index.ts`, add:

```typescript
export { DialogShortcut } from "./dialog-shortcut"
```

**Step 3: Run the build to verify**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/tui/component/dialog-shortcut.tsx src/tui/component/index.ts
git commit -m "feat: add shortcut management dialog"
```

---

### Task 6: Add shortcut triggers and footer to home screen

**Files:**
- Modify: `src/tui/routes/home.tsx:13` (import DialogShortcut)
- Modify: `src/tui/routes/home.tsx:319-447` (keyboard handler)
- Modify: `src/tui/routes/home.tsx:807-861` (footer)

**Step 1: Add imports**

In `src/tui/routes/home.tsx`, add to imports (after line 16):

```typescript
import { DialogShortcut } from "@tui/component/dialog-shortcut"
```

**Step 2: Add shortcut key handling to the keyboard handler**

Add at the end of the `useKeyboard()` callback in `home.tsx`, right before the closing `})` of the keyboard handler (before line 447):

```typescript
    // S (shift) to manage shortcuts
    if (evt.name === "s" && evt.shift) {
      dialog.push(() => <DialogShortcut />)
      return
    }

    // Check if key matches a defined shortcut
    if (evt.name.length === 1 || evt.name.length === 2) {
      const shortcut = sync.shortcut.getByKey(evt.name)
      if (shortcut) {
        evt.preventDefault()
        // Trigger the shortcut: find or create session, then attach
        sync.shortcut.trigger(shortcut).then((session) => {
          if (session.tmuxSession) {
            handleAttach(session)
          }
        }).catch((err) => {
          toast.error(err as Error)
        })
      }
    }
```

**Step 3: Add shortcuts footer bar**

In the footer section of `home.tsx` (around line 807), add a shortcuts bar right before the existing footer. Find the comment `{/* Footer with keybinds */}` and add before it:

```typescript
      {/* Shortcuts bar */}
      <Show when={sync.shortcut.list().length > 0}>
        <box
          flexDirection="row"
          width={dimensions().width}
          paddingLeft={2}
          paddingRight={2}
          height={1}
          backgroundColor={theme.backgroundElement}
          gap={2}
        >
          <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>SHORTCUTS</text>
          <For each={sync.shortcut.list()}>
            {(shortcut) => (
              <box flexDirection="row" gap={0}>
                <text fg={theme.accent} attributes={TextAttributes.BOLD}>[{shortcut.key}]</text>
                <text fg={theme.textMuted}> {shortcut.name}</text>
              </box>
            )}
          </For>
        </box>
      </Show>
```

Also add `S` to the existing footer keybinds section, after the fork entry (around line 852):

```typescript
        <box flexDirection="column" alignItems="center">
          <text fg={theme.text}>S</text>
          <text fg={theme.textMuted}>shortcuts</text>
        </box>
```

**Step 4: Run the build to verify**

Run: `bun run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/tui/routes/home.tsx
git commit -m "feat: add shortcut triggers and footer bar to home screen"
```

---

### Task 7: Add CLI `--shortcut` flag

**Files:**
- Modify: `src/index.ts:9-51` (add shortcut flag handling)

**Step 1: Add shortcut CLI handling**

In `src/index.ts`, add the shortcut handling after the `--version` check (after line 37) and before the `const mode` line:

```typescript
  // Handle --shortcut / -s flag
  const shortcutIdx = args.findIndex(a => a === "--shortcut" || a === "-s")
  if (shortcutIdx !== -1) {
    const shortcutKey = args[shortcutIdx + 1]
    if (!shortcutKey) {
      console.error("Error: --shortcut requires a key argument (e.g., av -s x)")
      process.exit(1)
    }

    // Import needed modules
    const { getStorage } = await import("./core/storage")
    const { getSessionManager } = await import("./core/session")
    const { attachSessionSync } = await import("./core/tmux")

    const storage = getStorage()
    storage.migrate()

    const shortcut = storage.getShortcutByKey(shortcutKey)
    if (!shortcut) {
      console.error(`Error: No shortcut found for key "${shortcutKey}"`)
      console.error("Use 'av' and press Shift+S to manage shortcuts")
      process.exit(1)
    }

    const manager = getSessionManager()
    try {
      const session = await manager.findOrCreateForShortcut(shortcut)
      if (session.tmuxSession) {
        attachSessionSync(session.tmuxSession)
      }
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : String(err))
      process.exit(1)
    }

    process.exit(0)
  }
```

Also update the help text to include the new flag. In the help section (around line 13-30), add to the Options section:

```
  -s, --shortcut <key>  Launch shortcut by key (e.g., av -s x)
```

**Step 2: Run the build to verify**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add --shortcut CLI flag for direct launch"
```

---

### Task 8: Add unit tests for shortcut storage

**Files:**
- Create: `src/core/storage-shortcuts.test.ts`

**Step 1: Write tests for shortcut CRUD**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Storage } from "./storage"
import type { Shortcut } from "./types"
import fs from "fs"
import path from "path"
import os from "os"

function createTestStorage(): Storage {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "av-test-"))
  const dbPath = path.join(tmpDir, "test.db")
  const storage = new Storage({ dbPath })
  storage.migrate()
  return storage
}

function createMockShortcut(overrides: Partial<Shortcut> = {}): Shortcut {
  return {
    id: "test-id",
    key: "x",
    name: "Test Project",
    projectPath: "/test/path",
    tool: "claude",
    cliOptions: "",
    groupPath: "",
    skipPermissions: false,
    useWorktree: false,
    worktreeBranch: "",
    useBaseDevelop: false,
    createdAt: new Date("2024-01-01T10:00:00Z"),
    order: 0,
    ...overrides
  }
}

describe("Storage shortcuts", () => {
  let storage: Storage

  beforeEach(() => {
    storage = createTestStorage()
  })

  afterEach(() => {
    storage.close()
  })

  test("saveShortcut and loadShortcuts", () => {
    const shortcut = createMockShortcut()
    storage.saveShortcut(shortcut)
    const loaded = storage.loadShortcuts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.key).toBe("x")
    expect(loaded[0]!.name).toBe("Test Project")
    expect(loaded[0]!.projectPath).toBe("/test/path")
    expect(loaded[0]!.tool).toBe("claude")
  })

  test("getShortcutByKey returns correct shortcut", () => {
    storage.saveShortcut(createMockShortcut({ id: "1", key: "x", name: "X" }))
    storage.saveShortcut(createMockShortcut({ id: "2", key: "y", name: "Y" }))
    const found = storage.getShortcutByKey("y")
    expect(found).not.toBeNull()
    expect(found!.name).toBe("Y")
  })

  test("getShortcutByKey returns null for missing key", () => {
    const found = storage.getShortcutByKey("z")
    expect(found).toBeNull()
  })

  test("deleteShortcut removes shortcut", () => {
    storage.saveShortcut(createMockShortcut())
    expect(storage.loadShortcuts()).toHaveLength(1)
    storage.deleteShortcut("test-id")
    expect(storage.loadShortcuts()).toHaveLength(0)
  })

  test("saveShortcut upserts on same id", () => {
    storage.saveShortcut(createMockShortcut({ name: "Old" }))
    storage.saveShortcut(createMockShortcut({ name: "New" }))
    const loaded = storage.loadShortcuts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.name).toBe("New")
  })

  test("unique key constraint", () => {
    storage.saveShortcut(createMockShortcut({ id: "1", key: "x" }))
    expect(() =>
      storage.saveShortcut(createMockShortcut({ id: "2", key: "x" }))
    ).toThrow()
  })

  test("boolean fields round-trip correctly", () => {
    storage.saveShortcut(createMockShortcut({
      skipPermissions: true,
      useWorktree: true,
      useBaseDevelop: true
    }))
    const loaded = storage.loadShortcuts()[0]!
    expect(loaded.skipPermissions).toBe(true)
    expect(loaded.useWorktree).toBe(true)
    expect(loaded.useBaseDevelop).toBe(true)
  })
})
```

**Step 2: Run the tests**

Run: `bun test src/core/storage-shortcuts.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/core/storage-shortcuts.test.ts
git commit -m "test: add unit tests for shortcut storage CRUD"
```

---

### Task 9: Add unit tests for reserved keys validation

**Files:**
- Create: `src/core/shortcuts.test.ts`

**Step 1: Write tests for reserved keys**

```typescript
import { describe, test, expect } from "bun:test"
import { RESERVED_SHORTCUT_KEYS } from "./types"

describe("RESERVED_SHORTCUT_KEYS", () => {
  test("contains navigation keys", () => {
    expect(RESERVED_SHORTCUT_KEYS.has("j")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("k")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("h")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("l")).toBe(true)
  })

  test("contains action keys", () => {
    expect(RESERVED_SHORTCUT_KEYS.has("n")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("d")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("r")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("f")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("g")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("m")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("q")).toBe(true)
  })

  test("contains shifted keys", () => {
    expect(RESERVED_SHORTCUT_KEYS.has("R")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("F")).toBe(true)
    expect(RESERVED_SHORTCUT_KEYS.has("S")).toBe(true)
  })

  test("contains number keys", () => {
    for (let i = 1; i <= 9; i++) {
      expect(RESERVED_SHORTCUT_KEYS.has(String(i))).toBe(true)
    }
  })

  test("does not contain usable keys", () => {
    expect(RESERVED_SHORTCUT_KEYS.has("x")).toBe(false)
    expect(RESERVED_SHORTCUT_KEYS.has("z")).toBe(false)
    expect(RESERVED_SHORTCUT_KEYS.has("a")).toBe(false)
    expect(RESERVED_SHORTCUT_KEYS.has("b")).toBe(false)
    expect(RESERVED_SHORTCUT_KEYS.has("c")).toBe(false)
    expect(RESERVED_SHORTCUT_KEYS.has("w")).toBe(false)
  })
})
```

**Step 2: Run the tests**

Run: `bun test src/core/shortcuts.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/core/shortcuts.test.ts
git commit -m "test: add unit tests for reserved shortcut keys"
```

---

### Task 10: Final build verification and manual testing

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Build the project**

Run: `bun run build`
Expected: Build succeeds with no errors

**Step 3: Manual testing checklist**

Run: `bun run dev`

1. Press `S` (Shift+S) on home screen → Manage Shortcuts dialog opens
2. Press `a` to add → Add form appears with key, name, tool, path fields
3. Enter key: `x`, name: `Test`, path: valid dir → Save → Shortcut appears in list
4. Press `Esc` to close dialog → Footer bar shows `[x] Test`
5. Press `x` on home screen → New session created and attached (or existing one attached)
6. `Ctrl+Q` to detach → Back to home screen
7. Press `x` again → Attaches to existing session (no new one created)
8. Exit TUI

Run: `bun run dev -- -s x`
Expected: Directly attaches to or creates session without showing TUI

**Step 4: Commit any fixes from manual testing**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
