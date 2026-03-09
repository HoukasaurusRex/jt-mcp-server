import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import { execa } from "execa";
import { existsSync, readFileSync } from "node:fs";
const mockExeca = vi.mocked(execa);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe("dev-script", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register the dev_script tool", async () => {
    const { register } = await import("../tools/dev-script.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "dev_script",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should run a valid script with yarn", async () => {
    const { register } = await import("../tools/dev-script.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ scripts: { build: "tsc", test: "vitest" } })
    );
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("yarn.lock") ? true : false
    );
    mockExeca.mockResolvedValue({
      stdout: "Build complete",
      stderr: "",
      exitCode: 0,
    } as any);

    const result = await handler({ script: "build", cwd: "/project", timeout: 300000 });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("Build complete");
    expect(mockExeca).toHaveBeenCalledWith(
      "sh",
      ["-c", "yarn run build"],
      expect.objectContaining({ cwd: "/project" })
    );
  });

  it("should return error with available scripts when script not found", async () => {
    const { register } = await import("../tools/dev-script.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ scripts: { build: "tsc", test: "vitest", lint: "eslint ." } })
    );

    const result = await handler({ script: "start", cwd: "/project", timeout: 300000 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Script "start" not found');
    expect(result.content[0].text).toContain("build, test, lint");
  });

  it("should return error when no package.json", async () => {
    const { register } = await import("../tools/dev-script.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const result = await handler({ script: "build", cwd: "/empty", timeout: 300000 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No package.json");
  });

  it("should append args to the command", async () => {
    const { register } = await import("../tools/dev-script.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ scripts: { test: "vitest" } })
    );
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("yarn.lock") ? true : false
    );
    mockExeca.mockResolvedValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    } as any);

    await handler({ script: "test", args: "--watch", cwd: "/project", timeout: 300000 });
    expect(mockExeca).toHaveBeenCalledWith(
      "sh",
      ["-c", "yarn run test --watch"],
      expect.any(Object)
    );
  });
});
