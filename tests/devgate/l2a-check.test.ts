/**
 * l2a-check.test.ts
 *
 * L2A Check 脚本测试 (简化版)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "child_process";
import { existsSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from "fs";
import { resolve, join } from "path";

const PROJECT_ROOT = resolve(__dirname, "../..");
const L2A_SCRIPT = join(PROJECT_ROOT, "scripts/devgate/l2a-check.sh");
const TEST_DIR = join(PROJECT_ROOT, ".test-l2a");

describe("l2a-check.sh", () => {
  beforeAll(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
      mkdirSync(join(TEST_DIR, "docs"), { recursive: true });
    }
  });

  beforeEach(() => {
    // Clean test directory before each test
    const files = [".prd.md", ".dod.md", "docs/QA-DECISION.md", "docs/AUDIT-REPORT.md"];
    for (const file of files) {
      const filepath = join(TEST_DIR, file);
      if (existsSync(filepath)) {
        unlinkSync(filepath);
      }
    }
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should exist and be executable", () => {
    expect(existsSync(L2A_SCRIPT)).toBe(true);
    expect(() => {
      execSync(`bash -n "${L2A_SCRIPT}"`, { encoding: "utf-8" });
    }).not.toThrow();
  });

  it("should pass when all files are valid (pr mode)", () => {
    writeFileSync(join(TEST_DIR, ".prd.md"), "# PRD\n\nLine 2\n\nLine 3");
    writeFileSync(join(TEST_DIR, ".dod.md"), "# DoD\n\nQA: test\n\n- [ ] item");
    writeFileSync(join(TEST_DIR, "docs/QA-DECISION.md"), "Decision: NO_RCI");
    writeFileSync(join(TEST_DIR, "docs/AUDIT-REPORT.md"), "Decision: PASS");

    const output = execSync(`bash "${L2A_SCRIPT}" pr`, {
      cwd: TEST_DIR,
      encoding: "utf-8",
    });
    expect(output).toContain("L2A_SUMMARY: passed=4 failed=0");
  });

  it("should fail when .prd.md is missing", () => {
    writeFileSync(join(TEST_DIR, ".dod.md"), "# DoD\n\nQA: test\n\n- [ ] item");
    writeFileSync(join(TEST_DIR, "docs/QA-DECISION.md"), "Decision: NO_RCI");
    writeFileSync(join(TEST_DIR, "docs/AUDIT-REPORT.md"), "Decision: PASS");

    try {
      execSync(`bash "${L2A_SCRIPT}" pr`, { cwd: TEST_DIR, encoding: "utf-8" });
      expect.fail("Should have failed");
    } catch (error: any) {
      expect(error.status).toBe(2);
      expect(error.stdout + error.stderr).toContain(".prd.md");
    }
  });

  it("should pass in release mode without PRD/DoD (skip PRD/DoD check)", () => {
    // Release 模式跳过 PRD/DoD 检查，只需要 QA 和 Audit
    writeFileSync(join(TEST_DIR, "docs/QA-DECISION.md"), "Decision: PASS");
    writeFileSync(join(TEST_DIR, "docs/AUDIT-REPORT.md"), "Decision: PASS");

    const output = execSync(`bash "${L2A_SCRIPT}" release`, {
      cwd: TEST_DIR,
      encoding: "utf-8",
    });
    expect(output).toContain("L2A_SUMMARY: passed=4 failed=0");
    expect(output).toContain("[Release 模式] 跳过 PRD/DoD 检查");
  });

  it("should fail in release mode when QA decision is not PASS", () => {
    // Release 模式仍然检查 QA 必须是 PASS
    writeFileSync(join(TEST_DIR, "docs/QA-DECISION.md"), "Decision: NO_RCI");
    writeFileSync(join(TEST_DIR, "docs/AUDIT-REPORT.md"), "Decision: PASS");

    try {
      execSync(`bash "${L2A_SCRIPT}" release`, { cwd: TEST_DIR });
      expect.fail("Should have failed");
    } catch (error: any) {
      expect(error.status).toBe(2);
      expect(error.stdout + error.stderr).toContain("not PASS");
    }
  });
});
