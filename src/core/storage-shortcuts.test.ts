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

  test("unique key replaces conflicting row via INSERT OR REPLACE", () => {
    storage.saveShortcut(createMockShortcut({ id: "1", key: "x", name: "First" }))
    storage.saveShortcut(createMockShortcut({ id: "2", key: "x", name: "Second" }))
    const loaded = storage.loadShortcuts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.id).toBe("2")
    expect(loaded[0]!.name).toBe("Second")
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

  test("getShortcut by id", () => {
    storage.saveShortcut(createMockShortcut({ id: "abc-123" }))
    const found = storage.getShortcut("abc-123")
    expect(found).not.toBeNull()
    expect(found!.id).toBe("abc-123")
  })

  test("getShortcut returns null for missing id", () => {
    const found = storage.getShortcut("nonexistent")
    expect(found).toBeNull()
  })
})
