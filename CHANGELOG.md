# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.1.10] (2026-04-03)

### Features
* 添加CI工作流并优化日志级别
* 新增API密钥验证器，支持15+个LLM提供商
* 新增错误助手模块，提供详细的错误诊断和建议
* 新增配置管理器，支持多提供商配置
* 新增交互式选择器

### Bug Fixes
* 修复SQLite事务错误处理
* 修复Journal持久化错误
* 移除analyzer-agent.ts中的TODO注释

### Documentation
* 更新README文档以反映最新CLI命令
* 添加npm版本徽章
* 修正CLI命令列表

### Code Refactoring
* 优化日志脱敏功能
* 改进Daemon模块的重试队列内存使用
* 优化数据库连接管理

### Tests
* 新增20+个单元测试文件
* 测试覆盖率阈值设置: Lines 60%, Functions 60%, Branches 45%, Statements 60%
* 304个测试全部通过

### Chores
* 清理项目配置文件和自动生成文档
* 更新.gitignore文件添加OrnnSkills相关配置
* 移除不应提交的运行时文件

---

## [0.1.9] (2026-04-02)

### Features
* 初始版本发布
* 实现核心功能：智能观察、精准映射、自动优化
* 支持Codex/OpenCode/Claude等Agent
* 实现影子副本和回滚支持
