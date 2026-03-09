import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({ execa: vi.fn() }));
import { execa } from "execa";
const mockExeca = vi.mocked(execa);

describe("netlify tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export register function", async () => {
    const { register } = await import("../tools/netlify.js");
    expect(typeof register).toBe("function");
  });

  it("should register five tools", async () => {
    const { register } = await import("../tools/netlify.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(5);
    const names = mockServer.registerTool.mock.calls.map((c: any[]) => c[0]);
    expect(names).toEqual([
      "netlify_deploy_status",
      "netlify_build_log",
      "netlify_function_log",
      "netlify_list_deploys",
      "netlify_list_functions",
    ]);
  });

  describe("netlify_deploy_status", () => {
    async function getHandler() {
      const { register } = await import("../tools/netlify.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[0][2];
    }

    it("should return deploy status", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            id: "deploy-1",
            state: "ready",
            branch: "main",
            deploy_ssl_url: "https://example.netlify.app",
            created_at: "2024-01-01T00:00:00Z",
          },
        ]),
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({ site_name: "my-site" });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.state).toBe("ready");
      expect(data.id).toBe("deploy-1");
    });

    it("should handle no deploys", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "[]",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({ site_name: "empty-site" });
      expect(result.content[0].text).toContain("No deploys found");
    });
  });

  describe("netlify_build_log", () => {
    async function getHandler() {
      const { register } = await import("../tools/netlify.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[1][2];
    }

    it("should fetch build log for latest deploy", async () => {
      const handler = await getHandler();

      // listSiteDeploys (getLatestDeployId)
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([{ id: "deploy-abc" }]),
        exitCode: 0,
      } as any);

      // getDeploy
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({
          id: "deploy-abc",
          state: "error",
          branch: "main",
          error_message: "Build failed",
        }),
        exitCode: 0,
      } as any);

      // listSiteBuilds
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([
          { id: "build-1", deploy_id: "deploy-abc", done: true },
        ]),
        exitCode: 0,
      } as any);

      // listSiteBuildLog
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([
          { message: "Installing dependencies" },
          { message: "Build command failed" },
          { message: "Error: exit code 1" },
        ]),
        exitCode: 0,
      } as any);

      const result = await handler({ site_name: "my-site", tail: 100 });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("deploy-abc");
      expect(result.content[0].text).toContain("Build failed");
      expect(result.content[0].text).toContain("Build command failed");
      expect(result.content[0].text).toContain("exit code 1");
    });

    it("should use specific deploy_id when provided", async () => {
      const handler = await getHandler();

      // getDeploy (no getLatestDeployId call since deploy_id is provided)
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({
          id: "deploy-xyz",
          state: "ready",
          branch: "feature",
        }),
        exitCode: 0,
      } as any);

      // listSiteBuilds
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([]),
        exitCode: 0,
      } as any);

      const result = await handler({
        site_name: "my-site",
        deploy_id: "deploy-xyz",
        tail: 50,
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("deploy-xyz");
    });
  });

  describe("netlify_function_log", () => {
    async function getHandler() {
      const { register } = await import("../tools/netlify.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[2][2];
    }

    it("should return function logs", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "2024-01-01 INFO: Function invoked\n2024-01-01 ERROR: timeout",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({ site_name: "my-site" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Function invoked");
      expect(result.content[0].text).toContain("timeout");
    });

    it("should handle no logs", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({ site_name: "my-site" });
      expect(result.content[0].text).toContain("No recent function logs");
    });

    it("should pass function name filter", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "log output",
        stderr: "",
        exitCode: 0,
      } as any);

      await handler({ site_name: "my-site", function_name: "my-func" });
      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("--name");
      expect(args).toContain("my-func");
    });
  });

  describe("netlify_list_deploys", () => {
    async function getHandler() {
      const { register } = await import("../tools/netlify.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[3][2];
    }

    it("should list recent deploys", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            id: "d1",
            state: "ready",
            branch: "main",
            created_at: "2024-01-02",
            context: "production",
          },
          {
            id: "d2",
            state: "error",
            branch: "feature",
            created_at: "2024-01-01",
            error_message: "Build failed",
            context: "deploy-preview",
          },
        ]),
        exitCode: 0,
      } as any);

      const result = await handler({ site_name: "my-site", limit: 5 });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].state).toBe("ready");
      expect(data[1].error).toBe("Build failed");
    });
  });

  describe("netlify_list_functions", () => {
    async function getHandler() {
      const { register } = await import("../tools/netlify.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[4][2];
    }

    it("should list deployed functions", async () => {
      const handler = await getHandler();

      // getLatestDeployId
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([{ id: "deploy-abc" }]),
        exitCode: 0,
      } as any);

      // listDeployFunctions
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([
          { id: "fn-1", name: "submit-form", runtime: "js" },
          { id: "fn-2", name: "send-email", runtime: "js" },
        ]),
        exitCode: 0,
      } as any);

      const result = await handler({ site_name: "my-site" });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("submit-form");
    });

    it("should handle no functions", async () => {
      const handler = await getHandler();

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([{ id: "deploy-abc" }]),
        exitCode: 0,
      } as any);

      mockExeca.mockResolvedValueOnce({
        stdout: "[]",
        exitCode: 0,
      } as any);

      const result = await handler({ site_name: "my-site" });
      expect(result.content[0].text).toContain("No functions found");
    });
  });
});
