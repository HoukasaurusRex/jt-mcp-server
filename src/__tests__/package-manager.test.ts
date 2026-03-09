import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from "node:fs";
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

import { detectPackageManager } from "../lib/package-manager.js";

describe("detectPackageManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect yarn from yarn.lock", () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("yarn.lock") ? true : false
    );
    expect(detectPackageManager("/project")).toBe("yarn");
  });

  it("should detect pnpm from pnpm-lock.yaml", () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("pnpm-lock.yaml") ? true : false
    );
    expect(detectPackageManager("/project")).toBe("pnpm");
  });

  it("should detect npm from package-lock.json", () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("package-lock.json") ? true : false
    );
    expect(detectPackageManager("/project")).toBe("npm");
  });

  it("should detect from package.json packageManager field", () => {
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ packageManager: "yarn@4.0.0" })
    );
    expect(detectPackageManager("/project")).toBe("yarn");
  });

  it("should fall back to npm when no lockfile or packageManager", () => {
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(detectPackageManager("/project")).toBe("npm");
  });

  it("should prioritize yarn.lock over package-lock.json", () => {
    mockExistsSync.mockReturnValue(true);
    expect(detectPackageManager("/project")).toBe("yarn");
  });
});
