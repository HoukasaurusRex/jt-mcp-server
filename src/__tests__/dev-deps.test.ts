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
import { existsSync } from "node:fs";
const mockExeca = vi.mocked(execa);
const mockExistsSync = vi.mocked(existsSync);

describe("dev-deps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register the dev_deps tool", async () => {
    const { register } = await import("../tools/dev-deps.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "dev_deps",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should add packages with yarn", async () => {
    const { register } = await import("../tools/dev-deps.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("yarn.lock") ? true : false
    );
    mockExeca.mockResolvedValue({
      stdout: "success",
      stderr: "",
      exitCode: 0,
    } as any);

    const result = await handler({
      action: "add",
      packages: ["zod", "vitest"],
      dev: false,
      cwd: "/project",
      timeout: 300000,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("[yarn]");
    expect(result.content[0].text).toContain("Added");
    expect(mockExeca).toHaveBeenCalledWith(
      "sh",
      ["-c", "yarn add zod vitest"],
      expect.objectContaining({ cwd: "/project" })
    );
  });

  it("should add dev dependencies with npm", async () => {
    const { register } = await import("../tools/dev-deps.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("package-lock.json") ? true : false
    );
    mockExeca.mockResolvedValue({
      stdout: "added",
      stderr: "",
      exitCode: 0,
    } as any);

    const result = await handler({
      action: "add",
      packages: ["vitest"],
      dev: true,
      cwd: "/project",
      timeout: 300000,
    });
    expect(result.content[0].text).toContain("(dev)");
    expect(mockExeca).toHaveBeenCalledWith(
      "sh",
      ["-c", "npm install --save-dev vitest"],
      expect.any(Object)
    );
  });

  it("should remove packages with pnpm", async () => {
    const { register } = await import("../tools/dev-deps.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("pnpm-lock.yaml") ? true : false
    );
    mockExeca.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    } as any);

    const result = await handler({
      action: "remove",
      packages: ["lodash"],
      dev: false,
      cwd: "/project",
      timeout: 300000,
    });
    expect(result.content[0].text).toContain("Removed");
    expect(mockExeca).toHaveBeenCalledWith(
      "sh",
      ["-c", "pnpm remove lodash"],
      expect.any(Object)
    );
  });

  it("should return error on non-zero exit code", async () => {
    const { register } = await import("../tools/dev-deps.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExistsSync.mockReturnValue(false);
    mockExeca.mockResolvedValue({
      stdout: "",
      stderr: "404 not found",
      exitCode: 1,
    } as any);

    const result = await handler({
      action: "add",
      packages: ["nonexistent-pkg"],
      dev: false,
      cwd: "/project",
      timeout: 300000,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("add failed");
  });
});
