/**
 * Agent Orchestrator
 * OpenTUI-based Agent Management
 */

import { tui } from "./tui/app"

async function main() {
  const args = process.argv.slice(2)

  // Simple CLI argument handling
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Agent Orchestrator - Terminal Agent Management

Usage:
  agent-orchestrator [options]

Options:
  --help, -h            Show this help message
  --version, -v         Show version
  --light               Use light mode theme
  -s, --shortcut <key>  Launch shortcut by key (e.g., av -s x)

Keyboard Shortcuts (in TUI):
  Ctrl+K         Command palette
  Ctrl+L         Session list
  N              New session
  Q              Quit / Detach
  ?              Help
`)
    process.exit(0)
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log("agent-orchestrator v1.0.0")
    process.exit(0)
  }

  // Handle --shortcut / -s flag
  const shortcutIdx = args.findIndex(a => a === "--shortcut" || a === "-s")
  if (shortcutIdx !== -1) {
    const shortcutKey = args[shortcutIdx + 1]
    if (!shortcutKey) {
      console.error("Error: --shortcut requires a key argument (e.g., av -s x)")
      process.exit(1)
    }

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

  const mode = args.includes("--light") ? "light" : "dark"

  try {
    await tui({
      mode,
      onExit: async () => {
        console.log("Goodbye!")
      }
    })
  } catch (error) {
    console.error("Fatal error:", error)
    process.exit(1)
  }
}

main()
