# 贡献指南

感谢你对 Amazon Analyst 项目的贡献！为了保持一致的协作体验，请遵循以下规范。

## 提交与 Issue 语言规范（必须使用中文）
- 所有 commit message 必须使用中文。
- 所有 Issue（标题与描述）必须使用中文。
- 推荐采用约定式提交（Conventional Commits）格式：
  - 格式：`type(scope): 中文描述`
  - 常用类型：`feat`、`fix`、`docs`、`chore`、`refactor`、`test`、`perf`、`ci`、`build`、`revert`
  - 示例：
    - `feat(analysis): 新增多日聚合查询与趋势图`
    - `fix(db): 修复 inventory_points 缺失 country_code 字段导致的查询报错`

## 分支策略
- `main` 为生产分支，保持可部署状态。
- 功能开发使用 `feature/*` 分支；修复使用 `fix/*` 分支。
- 合并前请确保通过构建与基本校验。

## Pull Request 规范
- PR 标题与描述必须使用中文。
- 关联 Issue（如有）：使用 `Closes #123` 或 `Refs #123`。
- 提供变更摘要、动机、影响范围与验证方式。
- 勾选 PR 模板中的检查项，保证质量。

## Issue 规范
- 清晰描述问题/需求与复现步骤。
- 如为 Bug，请附：期望行为 / 实际行为 / 复现步骤 / 截图或日志。
- 如为 Feature，请附：场景、目标用户、验收标准。

## 代码规范（摘要）
- TypeScript + React 19 + Next.js 15；优先使用 RSC，最小化 `use client`。
- 组件/函数使用明确的类型与命名（如 `isLoading`、`hasError`）。
- 目录命名使用小写连字符（如 `auth-wizard`）。
- 数据库：使用 PostgreSQL 与 Drizzle ORM，表名 `snake_case`。

## 提交前自检清单
- [ ] 通过 `pnpm build`（含类型检查）
- [ ] 更新/新增必要的测试与文档
- [ ] 如涉及数据库/配置，更新相关脚本与文档

更多规则请参考 `memory-bank/rules.md`。
