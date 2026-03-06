import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
const mockExeca = vi.mocked(execa);

describe("shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export a register function", async () => {
    const { register } = await import("../tools/shell.js");
    expect(typeof register).toBe("function");
  });

  it("should register the shell_lint tool", async () => {
    const { register } = await import("../tools/shell.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "shell_lint",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return no issues when shellcheck finds nothing", async () => {
    const { register } = await import("../tools/shell.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExeca.mockResolvedValueOnce({
      stdout: "[]",
      stderr: "",
      exitCode: 0,
    } as any);

    const result = await handler({ files: ["/tmp/test.sh"], shell: "bash", severity: "style" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No issues found");
  });

  it("should return structured findings when shellcheck finds issues", async () => {
    const { register } = await import("../tools/shell.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    const findings = [
      { file: "/tmp/test.sh", line: 5, column: 1, level: "warning", code: 2034, message: "x appears unused" },
    ];
    mockExeca.mockResolvedValueOnce({
      stdout: JSON.stringify(findings),
      stderr: "",
      exitCode: 1,
    } as any);

    const result = await handler({ files: ["/tmp/test.sh"], shell: "bash", severity: "style" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].code).toBe("SC2034");
  });

  it("should return error when shellcheck is not found", async () => {
    const { register } = await import("../tools/shell.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExeca.mockRejectedValueOnce(new Error("ENOENT shellcheck"));

    const result = await handler({ files: ["/tmp/test.sh"], shell: "bash", severity: "style" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("shellcheck not found");
  });
});
