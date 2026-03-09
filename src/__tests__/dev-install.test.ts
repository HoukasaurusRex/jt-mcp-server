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

describe("dev-install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register the dev_install tool", async () => {
    const { register } = await import("../tools/dev-install.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "dev_install",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should run yarn install when yarn.lock exists", async () => {
    const { register } = await import("../tools/dev-install.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("yarn.lock") ? true : false
    );
    mockExeca.mockResolvedValue({
      stdout: "Done",
      stderr: "",
      exitCode: 0,
    } as any);

    const result = await handler({ cwd: "/project", frozen: false, timeout: 300000 });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("[yarn]");
    expect(mockExeca).toHaveBeenCalledWith(
      "sh",
      ["-c", "yarn install"],
      expect.objectContaining({ cwd: "/project" })
    );
  });

  it("should run npm ci when frozen with package-lock.json", async () => {
    const { register } = await import("../tools/dev-install.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith("package-lock.json") ? true : false
    );
    mockExeca.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    } as any);

    const result = await handler({ cwd: "/project", frozen: true, timeout: 300000 });
    expect(result.content[0].text).toContain("[npm]");
    expect(mockExeca).toHaveBeenCalledWith(
      "sh",
      ["-c", "npm ci"],
      expect.objectContaining({ cwd: "/project" })
    );
  });

  it("should return error on non-zero exit code", async () => {
    const { register } = await import("../tools/dev-install.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExistsSync.mockReturnValue(false);
    mockExeca.mockResolvedValue({
      stdout: "",
      stderr: "ERR!",
      exitCode: 1,
    } as any);

    const result = await handler({ cwd: "/project", frozen: false, timeout: 300000 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("install failed");
  });
});
