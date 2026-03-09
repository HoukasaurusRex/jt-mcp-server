import { execa } from "execa";
import { resolveNodeBinPath } from "./nvm-utils.js";

export interface RunCommandOptions {
  command: string;
  cwd?: string;
  node_version?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  output: string;
}

export async function runCommand(opts: RunCommandOptions): Promise<RunCommandResult> {
  const execEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...opts.env,
  };

  if (opts.node_version) {
    const binPath = resolveNodeBinPath(opts.node_version);
    if (!binPath) {
      return {
        stdout: "",
        stderr: `Node version ${opts.node_version} not found in ~/.nvm/versions/node/`,
        exitCode: 1,
        output: `Node version ${opts.node_version} not found in ~/.nvm/versions/node/`,
      };
    }
    execEnv.PATH = `${binPath}:${execEnv.PATH ?? ""}`;
    await execa("corepack", ["enable"], { env: execEnv, reject: false });
  }

  const result = await execa("sh", ["-c", opts.command], {
    cwd: opts.cwd ?? process.cwd(),
    env: execEnv,
    reject: false,
    timeout: opts.timeout,
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 1,
    output,
  };
}
