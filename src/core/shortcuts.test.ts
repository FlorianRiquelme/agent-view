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
