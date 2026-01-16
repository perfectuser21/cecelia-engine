# Changelog

All notable changes to ZenithJoy Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [7.9.0] - 2026-01-16

### Added
- SKILL.md: 渐进式加载架构 - 710行精简至192行
- references/STEPS.md: 详细步骤实现（按需加载）
- scripts/check.sh: 完成度检查脚本

### Changed
- 统一清单标记：□ 必须 / □⏭ 可跳过 / ○ 可选
- 合并正常模式和快速修复模式清单

## [7.8.1] - 2026-01-16

### Fixed
- SKILL.md: 快速修复模式删除硬编码数字，改为动态描述

## [7.8.0] - 2026-01-16

### Added
- SKILL.md: 快速修复模式 - 简化流程适用于明确的小修复

## [7.7.2] - 2026-01-16

### Fixed
- SKILL.md: 依赖检查移至 Step 0，确保在 cp-* 分支恢复时也会执行

## [7.7.1] - 2026-01-16

### Fixed
- CI: Fixed auto-merge job dependency - now handles skipped version-check correctly
- CI: Fixed notify-failure to only depend on test job
- package-lock.json: Synced version to 7.7.x

## [7.7.0] - 2026-01-16

### Added
- CI: Version check job - validates package.json version update on PRs
- CI: Push triggers now include feature/* branches
- SKILL.md: Dependency checks (gh CLI, jq, gh auth status)
- README: Prerequisites section (gh CLI, jq, Node.js)
- README: Environment variables documentation (ZENITHJOY_ENGINE)

### Changed
- README: Installation uses $ZENITHJOY_ENGINE instead of hardcoded paths
- Global CLAUDE.md: Simplified Subagents section, fixed cp-* consistency

## [7.6.1] - 2026-01-16

### Fixed
- src/index.ts: Added missing entry point file
- package.json: Updated description to "AI development workflow engine"
- package-lock.json: Synced version to 7.6.x
- SKILL.md: Added Step 2.5 to flowcharts
- CHANGELOG.md: Added [7.6.0] version link
- hooks/branch-protect.sh: "checkpoint" → "cp-*"
- templates/DOD-TEMPLATE.md: Updated title format

## [7.6.0] - 2026-01-16

### Fixed
- SKILL.md: Hardcoded paths now use `ZENITHJOY_ENGINE` env variable
- SKILL.md: Semver rule `BREAKING:` → standard `feat!:` or `BREAKING CHANGE:`
- hooks/branch-protect.sh: "ZenithJoy Core" → "ZenithJoy Engine"
- CLAUDE.md: Added CHANGELOG.md to "唯一真实源", updated directory structure
- ARCHITECTURE.md: Added CHANGELOG.md, fixed .md extension, clarified Notion as optional
- LEARNINGS.md: Updated "20/20" to dynamic description, added new learnings section
- CHANGELOG.md: Fixed GitHub username (ZenithJoy → perfectuser21), added missing links
- package-lock.json: "zenithjoy-core" → "zenithjoy-engine"

### Added
- `.gitignore` file for node_modules, dist, logs, IDE files

## [7.5.2] - 2026-01-16

### Fixed
- Updated stale `zenithjoy-core` references to `zenithjoy-engine` in worktree example

## [7.5.1] - 2026-01-16

### Changed
- Checklist now uses dynamic counting (no hardcoded numbers)
- Uses `□` for required items, `○` for optional items
- Completion check script auto-calculates from SKILL.md

## [7.5.0] - 2026-01-16

### Added
- Step 2.5: Context review before PRD (check CHANGELOG, recent PRs, architecture, learnings)
- Dual-layer Learn in Step 7: Engine learnings + Project learnings

### Changed
- Checklist updated from 20+1 to 20+2 (two optional Learn steps)

## [7.4.1] - 2026-01-16

### Changed
- Restructured documentation organization
- Renamed GitHub repository from zenithjoy-core to zenithjoy-engine

## [7.4.0] - 2026-01-16

### Added
- Knowledge layering architecture (docs/ARCHITECTURE.md)
- Development learnings documentation (docs/LEARNINGS.md)

### Changed
- Project renamed to zenithjoy-engine

## [7.3.1] - 2026-01-16

### Fixed
- Removed outdated temporary annotations
- Documentation consistency fixes
- CI shell check now always executes
- Auto-merge error handling improvements

## [7.3.0] - 2026-01-16

### Added
- Key milestone checklist and completion degree check (20/20)

### Fixed
- Session recovery detection improvements
- Core rules description corrections
- Completion check numbering
- Version number update moved to before commit (Step 5.2)
- Completion check script syntax

### Changed
- Enhanced error recovery capabilities
- Cleaned up redundant code

## [7.1.0] - 2026-01-16

### Fixed
- Unified version numbers across project
- Third round workflow optimizations
- Second round workflow bug fixes (5 issues)
- First round workflow bug fixes (3 issues)
- Updated project-detect.sh to reference /dev

### Changed
- Updated README.md to unify on /dev workflow
- Updated CLAUDE.md to remove state file logic
- Refactored to remove state file, use pure git detection

## [7.0.0] - 2026-01-16

### Added
- Initial stable release of ZenithJoy Engine
- /dev workflow as single entry point
- Claude Code Hooks integration
- Branch protection (cp-* branches only)
- Automated CI/CD pipeline
- Semantic versioning enforcement

### Changed
- Complete workflow refactoring

## Earlier Versions

Previous iterations were experimental development versions leading up to the 7.0.0 stable release.

[Unreleased]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.8.1...HEAD
[7.8.1]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.8.0...v7.8.1
[7.8.0]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.7.2...v7.8.0
[7.7.2]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.7.1...v7.7.2
[7.7.1]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.7.0...v7.7.1
[7.7.0]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.6.1...v7.7.0
[7.6.1]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.6.0...v7.6.1
[7.6.0]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.5.2...v7.6.0
[7.5.2]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.5.1...v7.5.2
[7.5.1]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.5.0...v7.5.1
[7.5.0]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.4.1...v7.5.0
[7.4.1]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.4.0...v7.4.1
[7.4.0]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.3.1...v7.4.0
[7.3.1]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.3.0...v7.3.1
[7.3.0]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.1.0...v7.3.0
[7.1.0]: https://github.com/perfectuser21/zenithjoy-engine/compare/v7.0.0...v7.1.0
[7.0.0]: https://github.com/perfectuser21/zenithjoy-engine/releases/tag/v7.0.0
