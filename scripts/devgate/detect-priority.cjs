#!/usr/bin/env node
/**
 * detect-priority.cjs
 *
 * 检测 PR 优先级（P0/P1/P2/P3）。
 *
 * 检测来源（按优先级）：
 *   1. 环境变量 PR_PRIORITY
 *   2. PR title 前缀（如 "P0: xxx" 或 "fix(P0): xxx"）
 *   3. PR labels（如 "priority:P0"）
 *   4. Git commit 消息前缀
 *
 * 用法：
 *   node scripts/devgate/detect-priority.cjs [--json]
 *
 * 环境变量：
 *   PR_PRIORITY - 直接指定优先级
 *   PR_TITLE    - PR 标题
 *   PR_LABELS   - PR labels（逗号分隔）
 *
 * 输出：
 *   默认: P0/P1/P2/P3/unknown
 *   --json: {"priority": "P0", "source": "env"}
 */

const { execSync } = require("child_process");

/**
 * 从字符串中提取优先级
 * @param {string} text
 * @returns {string|null}
 */
function extractPriority(text) {
  if (!text) return null;

  // 匹配 P0, P1, P2, P3（不区分大小写）
  const match = text.match(/\b[Pp]([0-3])\b/);
  if (match) {
    return `P${match[1]}`;
  }
  return null;
}

/**
 * 从最近的 commit 消息中检测优先级
 * @returns {string|null}
 */
function detectFromCommits() {
  try {
    // 获取当前分支相对于 base 分支的 commit 消息
    const baseBranch =
      process.env.BASE_REF ||
      execSync("git config branch.$(git rev-parse --abbrev-ref HEAD).base-branch 2>/dev/null || echo develop", {
        encoding: "utf-8",
      }).trim();

    const commits = execSync(
      `git log ${baseBranch}..HEAD --pretty=format:"%s" 2>/dev/null || echo ""`,
      { encoding: "utf-8" }
    ).trim();

    if (!commits) return null;

    // 检查每条 commit 消息
    for (const line of commits.split("\n")) {
      const priority = extractPriority(line);
      if (priority) return priority;
    }
  } catch {
    // 忽略错误
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");

  let priority = null;
  let source = null;

  // 1. 环境变量
  if (process.env.PR_PRIORITY) {
    const p = extractPriority(process.env.PR_PRIORITY);
    if (p) {
      priority = p;
      source = "env";
    }
  }

  // 2. PR title
  if (!priority && process.env.PR_TITLE) {
    const p = extractPriority(process.env.PR_TITLE);
    if (p) {
      priority = p;
      source = "title";
    }
  }

  // 3. PR labels
  if (!priority && process.env.PR_LABELS) {
    const labels = process.env.PR_LABELS.split(",");
    for (const label of labels) {
      // 匹配 priority:P0, P0, priority-P0 等格式
      const p = extractPriority(label);
      if (p) {
        priority = p;
        source = "label";
        break;
      }
    }
  }

  // 4. Git commits
  if (!priority) {
    const p = detectFromCommits();
    if (p) {
      priority = p;
      source = "commit";
    }
  }

  // 默认值
  if (!priority) {
    priority = "unknown";
    source = "default";
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ priority, source }));
  } else {
    console.log(priority);
  }
}

main();
