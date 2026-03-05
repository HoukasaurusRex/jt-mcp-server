import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
const mockExeca = vi.mocked(execa);

describe("dev-run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export register and resolveNodeBinPath", async () => {
    const mod = await import("../tools/dev-run.js");
    expect(typeof mod.register).toBe("function");
    expect(typeof mod.resolveNodeBinPath).toBe("function");
  });

  it("should register the dev_run tool", async () => {
    const { register } = await import("../tools/dev-run.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "dev_run",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should run a command and return stdout", async () => {
    const { register } = await import("../tools/dev-run.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExeca.mockResolvedValueOnce({
      stdout: "hello world",
      stderr: "",
      exitCode: 0,
    } as any);

    const result = await handler({ command: "echo hello world" });
    expect(result.content[0].text).toBe("hello world");
    expect(result.isError).toBeUndefined();
  });

  it("should return isError on non-zero exit code", async () => {
    const { register } = await import("../tools/dev-run.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExeca.mockResolvedValueOnce({
      stdout: "",
      stderr: "command not found",
      exitCode: 127,
    } as any);

    const result = await handler({ command: "nonexistent" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("127");
  });
});
