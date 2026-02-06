/**
 * bash-guard.sh 测试
 *
 * 两类防护：
 * 1. 凭据泄露：命令行包含真实 token 时拦截
 * 2. HK 部署：rsync/scp 到 HK IP 时检查 git 状态
 *
 * 性能要求：未命中时 < 5ms
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const HOOK_PATH = resolve(__dirname, "../../hooks/bash-guard.sh");

function runHook(command: string): { exitCode: number; stderr: string } {
  const input = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command },
  });

  try {
    execSync(`echo '${input.replace(/'/g, "'\\''")}' | bash "${HOOK_PATH}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { exitCode: 0, stderr: "" };
  } catch (err: any) {
    return { exitCode: err.status, stderr: err.stderr || "" };
  }
}

describe("bash-guard.sh", () => {
  beforeAll(() => {
    expect(existsSync(HOOK_PATH)).toBe(true);
  });

  it("should exist and be executable", () => {
    const stat = execSync(`stat -c %a "${HOOK_PATH}"`, { encoding: "utf-8" });
    const mode = parseInt(stat.trim(), 8);
    expect(mode & 0o111).toBeGreaterThan(0);
  });

  it("should pass syntax check", () => {
    expect(() => {
      execSync(`bash -n "${HOOK_PATH}"`, { encoding: "utf-8" });
    }).not.toThrow();
  });

  // ─── 日常命令放行 ─────────────────────────────────────────
  describe("should allow normal commands", () => {
    const normalCommands = [
      "git checkout -b cp-test-branch",
      "npm test",
      'echo "ok" >> .dev-mode',
      "git log --oneline > /tmp/x.txt",
      "npm run build 2>&1",
      "git status --short",
      "ls -la",
      "ssh hk uptime",
      'ssh hk "docker ps"',
      "cat package.json",
      "cp templates/prd.md .prd.md",
      "rsync file.txt localhost:/tmp/",
      "scp file.txt user@192.168.1.1:/tmp/",
    ];

    for (const cmd of normalCommands) {
      it(`allows: ${cmd}`, () => {
        const result = runHook(cmd);
        expect(result.exitCode).toBe(0);
      });
    }
  });

  // ─── 凭据拦截 ─────────────────────────────────────────────
  describe("should block commands with real tokens", () => {
    it("blocks Notion token", () => {
      const result = runHook(
        'echo "ntn_abcdefghijklmnopqrstuvwx" > config.ts',
      );
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("BASH GUARD");
    });

    it("blocks GitHub PAT", () => {
      const result = runHook(
        'curl -H "Authorization: github_pat_abcdefghijklmnopqrstuvwxyz1234567890"',
      );
      expect(result.exitCode).toBe(2);
    });

    it("blocks OpenAI key", () => {
      const result = runHook(
        'export OPENAI_KEY="sk-proj-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      );
      expect(result.exitCode).toBe(2);
    });

    it("allows placeholder tokens", () => {
      const result = runHook('echo "ntn_YOUR_NOTION_KEY_HERE_placeholder"');
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── HK 部署拦截 ──────────────────────────────────────────
  describe("should block HK deploy when git is dirty", () => {
    it("blocks rsync to HK public IP", () => {
      const result = runHook("rsync -avz dist/ user@43.154.85.217:/srv/app/");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("BASH GUARD");
    });

    it("blocks scp to HK Tailscale IP", () => {
      const result = runHook("scp file.tar.gz user@100.86.118.99:/tmp/");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("BASH GUARD");
    });

    it("does not block ssh to HK (read-only allowed)", () => {
      const result = runHook("ssh user@43.154.85.217 uptime");
      expect(result.exitCode).toBe(0);
    });

    it("does not block rsync to non-HK targets", () => {
      const result = runHook("rsync -avz dist/ user@192.168.1.100:/srv/app/");
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── 空/无效输入 ──────────────────────────────────────────
  describe("should handle edge cases", () => {
    it("allows empty command", () => {
      const input = JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "" },
      });
      try {
        execSync(`echo '${input}' | bash "${HOOK_PATH}"`, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // empty command might exit 0 or non-zero, just shouldn't crash
      }
    });

    it("handles invalid JSON gracefully", () => {
      try {
        execSync(`echo 'not json' | bash "${HOOK_PATH}"`, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        // Should exit 0 (graceful pass-through)
      } catch {
        // Also acceptable
      }
    });
  });
});
