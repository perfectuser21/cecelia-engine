/**
 * Gate Token 机制测试
 *
 * 测试令牌生成（mark-subagent-done.sh）和校验（require-subagent-token.sh）：
 * 1. PostToolUse hook 在 gate subagent PASS 后生成令牌
 * 2. PreToolUse hook 拦截无令牌的 generate-gate-file.sh
 * 3. 防伪造：阻止 Bash 写 .gate_tokens 目录
 * 4. 一次性消费：令牌使用后删除
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { resolve, join } from "path";
import { tmpdir } from "os";

const PROJECT_ROOT = resolve(__dirname, "../..");
const MARK_HOOK = resolve(PROJECT_ROOT, "hooks/mark-subagent-done.sh");
const REQUIRE_HOOK = resolve(PROJECT_ROOT, "hooks/require-subagent-token.sh");
const TOKEN_DIR = resolve(PROJECT_ROOT, ".git/.gate_tokens");

function runHook(
  hookPath: string,
  env: Record<string, string>,
  stdin: string
): { exitCode: number; stdout: string; stderr: string } {
  const tmpFile = join(tmpdir(), `hook-stdin-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(tmpFile, stdin);
  try {
    const result = execSync(`bash "${hookPath}" < "${tmpFile}"`, {
      encoding: "utf-8",
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      timeout: 5000,
    });
    return { exitCode: 0, stdout: result, stderr: "" };
  } catch (e: any) {
    return {
      exitCode: e.status ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  } finally {
    rmSync(tmpFile, { force: true });
  }
}

describe("mark-subagent-done.sh (PostToolUse)", () => {
  beforeAll(() => {
    expect(existsSync(MARK_HOOK)).toBe(true);
  });

  beforeEach(() => {
    // Clean token dir
    if (existsSync(TOKEN_DIR)) {
      rmSync(TOKEN_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TOKEN_DIR)) {
      rmSync(TOKEN_DIR, { recursive: true });
    }
  });

  it("should pass syntax check", () => {
    expect(() => {
      execSync(`bash -n "${MARK_HOOK}"`, { encoding: "utf-8" });
    }).not.toThrow();
  });

  it("should exit 0 for non-Task tools", () => {
    const result = runHook(
      MARK_HOOK,
      { TOOL_NAME: "Bash" },
      JSON.stringify({ tool_input: { command: "ls" } })
    );
    expect(result.exitCode).toBe(0);
  });

  it("should exit 0 for non-gate Task descriptions", () => {
    const result = runHook(
      MARK_HOOK,
      { TOOL_NAME: "Task" },
      JSON.stringify({ tool_input: { description: "some-task" }, tool_result: "done" })
    );
    expect(result.exitCode).toBe(0);
    expect(existsSync(TOKEN_DIR)).toBe(false);
  });

  it("should generate token when gate subagent returns PASS", () => {
    const input = JSON.stringify({
      tool_input: { description: "gate:prd" },
      tool_result: "## Gate Result\n\nDecision: PASS\n\n### Findings\n- ok",
    });
    const result = runHook(
      MARK_HOOK,
      { TOOL_NAME: "Task", CLAUDE_SESSION_ID: "test-session" },
      input
    );
    expect(result.exitCode).toBe(0);
    const tokenFile = join(TOKEN_DIR, "subagent-prd-test-session.token");
    expect(existsSync(tokenFile)).toBe(true);
    const content = readFileSync(tokenFile, "utf-8");
    expect(content).toContain("gate: prd");
    expect(content).toContain("session_id: test-session");
    expect(content).toContain("nonce:");
  });

  it("should NOT generate token when gate subagent returns FAIL", () => {
    const input = JSON.stringify({
      tool_input: { description: "gate:dod" },
      tool_result: "## Gate Result\n\nDecision: FAIL\n\n### Required Fixes\n- fix something",
    });
    const result = runHook(
      MARK_HOOK,
      { TOOL_NAME: "Task", CLAUDE_SESSION_ID: "test-session" },
      input
    );
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(TOKEN_DIR, "subagent-dod-test-session.token"))).toBe(false);
  });

  it("should handle markdown bold Decision: **PASS**", () => {
    const input = JSON.stringify({
      tool_input: { description: "gate:audit" },
      tool_result: "Decision: **PASS**",
    });
    const result = runHook(
      MARK_HOOK,
      { TOOL_NAME: "Task", CLAUDE_SESSION_ID: "test-session" },
      input
    );
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(TOKEN_DIR, "subagent-audit-test-session.token"))).toBe(true);
  });
});

describe("require-subagent-token.sh (PreToolUse)", () => {
  beforeAll(() => {
    expect(existsSync(REQUIRE_HOOK)).toBe(true);
  });

  beforeEach(() => {
    if (existsSync(TOKEN_DIR)) {
      rmSync(TOKEN_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TOKEN_DIR)) {
      rmSync(TOKEN_DIR, { recursive: true });
    }
  });

  it("should pass syntax check", () => {
    expect(() => {
      execSync(`bash -n "${REQUIRE_HOOK}"`, { encoding: "utf-8" });
    }).not.toThrow();
  });

  it("should exit 0 for non-Bash tools", () => {
    const result = runHook(
      REQUIRE_HOOK,
      { TOOL_NAME: "Write" },
      JSON.stringify({ tool_input: { file_path: "/tmp/test" } })
    );
    expect(result.exitCode).toBe(0);
  });

  it("should exit 0 for normal Bash commands", () => {
    const result = runHook(
      REQUIRE_HOOK,
      { TOOL_NAME: "Bash" },
      JSON.stringify({ tool_input: { command: "git status" } })
    );
    expect(result.exitCode).toBe(0);
  });

  it("should block generate-gate-file.sh without token (exit 2)", () => {
    const result = runHook(
      REQUIRE_HOOK,
      { TOOL_NAME: "Bash", CLAUDE_SESSION_ID: "test-session" },
      JSON.stringify({ tool_input: { command: "bash scripts/gate/generate-gate-file.sh prd" } })
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("令牌不存在");
  });

  it("should allow generate-gate-file.sh with valid token", () => {
    // Create token
    mkdirSync(TOKEN_DIR, { recursive: true });
    const tokenFile = join(TOKEN_DIR, "subagent-prd-test-session.token");
    writeFileSync(tokenFile, "gate: prd\nsession_id: test-session\nnonce: abc123\n");

    const result = runHook(
      REQUIRE_HOOK,
      { TOOL_NAME: "Bash", CLAUDE_SESSION_ID: "test-session" },
      JSON.stringify({ tool_input: { command: "bash scripts/gate/generate-gate-file.sh prd" } })
    );
    expect(result.exitCode).toBe(0);
    // Token file should be consumed (deleted)
    expect(existsSync(tokenFile)).toBe(false);
  });

  it("should consume token (one-time use)", () => {
    mkdirSync(TOKEN_DIR, { recursive: true });
    const tokenFile = join(TOKEN_DIR, "subagent-dod-test-session.token");
    writeFileSync(tokenFile, "gate: dod\nsession_id: test-session\nnonce: xyz789\n");

    // First call: should succeed
    const result1 = runHook(
      REQUIRE_HOOK,
      { TOOL_NAME: "Bash", CLAUDE_SESSION_ID: "test-session" },
      JSON.stringify({ tool_input: { command: "bash scripts/gate/generate-gate-file.sh dod" } })
    );
    expect(result1.exitCode).toBe(0);
    expect(existsSync(tokenFile)).toBe(false);

    // Second call: should fail (token consumed)
    const result2 = runHook(
      REQUIRE_HOOK,
      { TOOL_NAME: "Bash", CLAUDE_SESSION_ID: "test-session" },
      JSON.stringify({ tool_input: { command: "bash scripts/gate/generate-gate-file.sh dod" } })
    );
    expect(result2.exitCode).toBe(2);
  });

  it("should block Bash commands that write to .gate_tokens (anti-forgery)", () => {
    const forgeryCommands = [
      'echo "fake" > .git/.gate_tokens/fake.token',
      "cat something > .git/.gate_tokens/token",
      "cp /tmp/token .git/.gate_tokens/",
      "touch .git/.gate_tokens/fake.token",
      "rm -rf .git/.gate_tokens/",
      "python -c 'open(\".git/.gate_tokens/x\",\"w\")'",
    ];

    for (const cmd of forgeryCommands) {
      const result = runHook(
        REQUIRE_HOOK,
        { TOOL_NAME: "Bash" },
        JSON.stringify({ tool_input: { command: cmd } })
      );
      expect(result.exitCode).toBe(2);
    }
  });

  it("should reject invalid gate types", () => {
    const result = runHook(
      REQUIRE_HOOK,
      { TOOL_NAME: "Bash", CLAUDE_SESSION_ID: "test-session" },
      JSON.stringify({ tool_input: { command: "bash scripts/gate/generate-gate-file.sh invalid123" } })
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("缺少 gate 类型参数");
  });
});
