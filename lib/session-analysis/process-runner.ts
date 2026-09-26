import "server-only";

import { spawn } from "node:child_process";

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export class CommandTimedOutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Command timed out after ${timeoutMs}ms.`);
    this.name = "CommandTimedOutError";
  }
}

export type ProcessRunner = (input: {
  command: string;
  args: string[];
  timeoutMs: number;
  cwd?: string;
}) => Promise<CommandResult>;

export const runCommand: ProcessRunner = ({ command, args, timeoutMs, cwd }) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill();
      reject(new CommandTimedOutError(timeoutMs));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode });
    });
  });
};
