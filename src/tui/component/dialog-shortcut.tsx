/**
 * Shortcut management dialog
 */

import { createSignal, createEffect, For, Show } from "solid-js"
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
                    {selectedTool() === tool.value ? "●" : "○"}
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
