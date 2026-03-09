import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({ execa: vi.fn() }));
import { execa } from "execa";
const mockExeca = vi.mocked(execa);

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn(),
}));
import { readFile, stat, readdir } from "node:fs/promises";
const mockReadFile = vi.mocked(readFile);
const mockStat = vi.mocked(stat);
const mockReaddir = vi.mocked(readdir);

describe("search tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export register function", async () => {
    const mod = await import("../tools/search.js");
    expect(typeof mod.register).toBe("function");
  });

  it("should register four tools", async () => {
    const { register } = await import("../tools/search.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(4);
    const names = mockServer.registerTool.mock.calls.map(
      (c: any[]) => c[0]
    );
    expect(names).toEqual(["dev_grep", "dev_find", "dev_read", "dev_tree"]);
  });

  describe("dev_grep", () => {
    async function getHandler() {
      const { register } = await import("../tools/search.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[0][2];
    }

    it("should return matches from ripgrep", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "src/index.ts:1:import foo",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({
        pattern: "import foo",
        cwd: "/project",
        context_lines: 0,
        max_results: 100,
        files_only: false,
        fixed_strings: false,
        case_insensitive: false,
      });
      expect(result.content[0].text).toContain("src/index.ts:1:import foo");
      expect(result.isError).toBeUndefined();
    });

    it("should return no matches message on exit code 1", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 1,
      } as any);

      const result = await handler({
        pattern: "nonexistent",
        cwd: "/project",
        context_lines: 2,
        max_results: 100,
        files_only: false,
        fixed_strings: false,
        case_insensitive: false,
      });
      expect(result.content[0].text).toBe("No matches found.");
    });

    it("should return error on ripgrep failure", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "invalid regex",
        exitCode: 2,
      } as any);

      const result = await handler({
        pattern: "[invalid",
        cwd: "/project",
        context_lines: 2,
        max_results: 100,
        files_only: false,
        fixed_strings: false,
        case_insensitive: false,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("ripgrep error");
    });

    it("should pass files-only flag", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "src/index.ts\nsrc/types.ts",
        stderr: "",
        exitCode: 0,
      } as any);

      await handler({
        pattern: "import",
        cwd: "/project",
        context_lines: 0,
        max_results: 100,
        files_only: true,
        fixed_strings: false,
        case_insensitive: false,
      });

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("--files-with-matches");
    });
  });

  describe("dev_find", () => {
    async function getHandler() {
      const { register } = await import("../tools/search.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[1][2];
    }

    it("should return file list from fd", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "src/index.ts\nsrc/types.ts",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({
        pattern: "*.ts",
        cwd: "/project",
        type: "file",
        max_results: 200,
      });
      expect(result.content[0].text).toContain("src/index.ts");
      expect(result.content[0].text).toContain("src/types.ts");
    });

    it("should return no files message when empty", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({
        pattern: "*.xyz",
        cwd: "/project",
        type: "file",
        max_results: 200,
      });
      expect(result.content[0].text).toBe("No files found.");
    });

    it("should fallback to git when fd is not installed", async () => {
      const handler = await getHandler();

      // First call (fd) fails with ENOENT
      const fdError = new Error("ENOENT") as any;
      fdError.code = "ENOENT";
      mockExeca.mockRejectedValueOnce(fdError);

      // Second call (git ls-files) succeeds
      mockExeca.mockResolvedValueOnce({
        stdout: "src/index.ts\nsrc/types.ts\npackage.json",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({
        pattern: "*.ts",
        cwd: "/project",
        type: "file",
        max_results: 200,
      });
      expect(result.content[0].text).toContain("src/index.ts");
    });
  });

  describe("dev_read", () => {
    async function getHandler() {
      const { register } = await import("../tools/search.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[2][2];
    }

    it("should read file with line numbers", async () => {
      const handler = await getHandler();
      mockStat.mockResolvedValueOnce({ isFile: () => true } as any);
      mockReadFile.mockResolvedValueOnce(
        Buffer.from("line one\nline two\nline three\n")
      );

      const result = await handler({
        path: "/project/src/foo.ts",
        cwd: "/project",
        max_lines: 500,
      });
      expect(result.content[0].text).toContain("1  line one");
      expect(result.content[0].text).toContain("2  line two");
      expect(result.isError).toBeUndefined();
    });

    it("should block path traversal", async () => {
      const handler = await getHandler();
      const result = await handler({
        path: "/etc/passwd",
        cwd: "/project",
        max_lines: 500,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("outside project root");
    });

    it("should block binary files", async () => {
      const handler = await getHandler();
      mockStat.mockResolvedValueOnce({ isFile: () => true } as any);
      const binary = Buffer.alloc(100);
      binary[50] = 0; // null byte
      mockReadFile.mockResolvedValueOnce(binary);

      const result = await handler({
        path: "/project/image.png",
        cwd: "/project",
        max_lines: 500,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Binary file");
    });

    it("should support line ranges", async () => {
      const handler = await getHandler();
      mockStat.mockResolvedValueOnce({ isFile: () => true } as any);
      mockReadFile.mockResolvedValueOnce(
        Buffer.from("a\nb\nc\nd\ne\n")
      );

      const result = await handler({
        path: "/project/src/foo.ts",
        cwd: "/project",
        start_line: 2,
        end_line: 4,
        max_lines: 500,
      });
      expect(result.content[0].text).toContain("2  b");
      expect(result.content[0].text).toContain("3  c");
      expect(result.content[0].text).toContain("4  d");
      expect(result.content[0].text).not.toContain("1  a");
      expect(result.content[0].text).not.toContain("5  e");
    });
  });

  describe("dev_tree", () => {
    async function getHandler() {
      const { register } = await import("../tools/search.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[3][2];
    }

    it("should display directory tree", async () => {
      const handler = await getHandler();

      // Root readdir
      mockReaddir.mockResolvedValueOnce([
        { name: "src", isDirectory: () => true, isFile: () => false },
        { name: "package.json", isDirectory: () => false, isFile: () => true },
      ] as any);

      // src readdir
      mockReaddir.mockResolvedValueOnce([
        { name: "index.ts", isDirectory: () => false, isFile: () => true },
      ] as any);

      const result = await handler({
        cwd: "/project",
        depth: 3,
        include_hidden: false,
        directories_only: false,
      });

      expect(result.content[0].text).toContain("src/");
      expect(result.content[0].text).toContain("index.ts");
      expect(result.content[0].text).toContain("package.json");
      expect(result.isError).toBeUndefined();
    });

    it("should skip node_modules and .git", async () => {
      const handler = await getHandler();

      mockReaddir.mockResolvedValueOnce([
        { name: "node_modules", isDirectory: () => true, isFile: () => false },
        { name: ".git", isDirectory: () => true, isFile: () => false },
        { name: "src", isDirectory: () => true, isFile: () => false },
      ] as any);

      // .git is hidden so filtered by include_hidden=false; node_modules is in SKIP set
      mockReaddir.mockResolvedValueOnce([] as any);

      const result = await handler({
        cwd: "/project",
        depth: 2,
        include_hidden: false,
        directories_only: false,
      });

      expect(result.content[0].text).toContain("src/");
      expect(result.content[0].text).not.toContain("node_modules");
      expect(result.content[0].text).not.toContain(".git");
    });
  });
});
