/**
 * 共享常量 - 避免在多个脚本中重复硬编码
 */

module.exports = {
  // Git 默认值
  DEFAULT_BASE_BRANCH: 'develop',
  DEFAULT_HEAD_REF: 'HEAD',
  
  // 文件路径
  QA_DECISION_PATH: 'docs/QA-DECISION.md',
  FEATURE_REGISTRY_PATH: 'features/feature-registry.yml',
  REGRESSION_CONTRACT_PATH: 'regression-contract.yaml',
  
  // 目录
  ARCHIVE_DIR: '.archive',
  DOCS_DIR: 'docs',
  SCRIPTS_DIR: 'scripts',
};
