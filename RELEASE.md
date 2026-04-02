# 版本发布流程

## 📋 概述

本项目使用 **standard-version** 进行自动化版本管理，遵循 [语义化版本规范](https://semver.org/lang/zh-CN/)。

---

## 🎯 版本号规则

遵循 `MAJOR.MINOR.PATCH` 格式：

- **MAJOR (主版本号)**: 不兼容的API变更
- **MINOR (次版本号)**: 向后兼容的功能新增
- **PATCH (修订号)**: 向后兼容的问题修复

---

## 📝 提交信息规范

### 提交类型

| 类型 | 说明 | 版本影响 |
|------|------|---------|
| `feat` | 新功能 | MINOR |
| `fix` | 修复bug | PATCH |
| `docs` | 文档更新 | 无 |
| `style` | 代码格式 | 无 |
| `refactor` | 重构 | 无 |
| `perf` | 性能优化 | PATCH |
| `test` | 测试相关 | 无 |
| `chore` | 构建/工具 | 无 |
| `build` | 打包相关 | 无 |

### 提交示例

```bash
# 新功能 - 自动升级MINOR版本
git commit -m "feat: 添加多语言支持"

# Bug修复 - 自动升级PATCH版本
git commit -m "fix: 修复登录验证失败的问题"

# 破坏性变更 - 自动升级MAJOR版本
git commit -m "feat: 重构API接口

BREAKING CHANGE: 旧的API接口不再兼容"
```

---

## 🚀 发布流程

### 方式1：使用交互式提交（推荐）

```bash
# 1. 使用commitizen进行提交
npm run commit

# 2. 运行测试确保代码质量
npm test

# 3. 自动生成版本号和CHANGELOG
npm run release

# 4. 推送代码和标签到远程仓库
git push --follow-tags origin main

# 5. 发布到npm
npm publish
```

### 方式2：手动提交

```bash
# 1. 正常提交代码
git add .
git commit -m "feat: 添加新功能"

# 2. 运行测试
npm test

# 3. 自动生成版本号和CHANGELOG
npm run release

# 4. 推送代码和标签
git push --follow-tags origin main

# 5. 发布到npm
npm publish
```

---

## 📦 版本发布命令

### 标准发布（自动判断版本号）

```bash
npm run release
```

根据提交类型自动决定版本号：
- `feat` → 0.2.0
- `fix` → 0.1.11
- `BREAKING CHANGE` → 1.0.0

### 指定版本类型

```bash
# 发布次版本 (0.1.10 → 0.2.0)
npm run release:minor

# 发布主版本 (0.1.10 → 1.0.0)
npm run release:major

# 首次发布（不升级版本号）
npm run release:first
```

---

## 🔄 完整工作流示例

### 示例1：添加新功能

```bash
# 1. 开发新功能
# ... 编写代码 ...

# 2. 提交代码
git add .
npm run commit
# 选择: feat
# 输入: 添加用户认证功能

# 3. 运行测试
npm test

# 4. 发布新版本
npm run release
# 输出: 0.1.10 → 0.2.0

# 5. 推送和发布
git push --follow-tags origin main
npm publish
```

### 示例2：修复Bug

```bash
# 1. 修复bug
# ... 修复代码 ...

# 2. 提交
git add .
git commit -m "fix: 修复用户登录失败的问题"

# 3. 测试
npm test

# 4. 发布
npm run release
# 输出: 0.1.10 → 0.1.11

# 5. 推送和发布
git push --follow-tags origin main
npm publish
```

---

## 📄 自动生成的文件

### CHANGELOG.md

每次发布会自动更新CHANGELOG.md：

```markdown
# Changelog

## [0.2.0] (2026-04-03)

### Features
* 添加用户认证功能 ([abc123](链接))

## [0.1.11] (2026-04-03)

### Bug Fixes
* 修复用户登录失败的问题 ([def456](链接))
```

### Git标签

自动创建版本标签：
```
v0.1.10
v0.1.11
v0.2.0
```

---

## ⚠️ 注意事项

### 1. 提交前检查

```bash
# 确保代码通过所有检查
npm run lint
npm run typecheck
npm test
```

### 2. 版本号冲突

如果npm上已存在相同版本，发布会失败。解决方案：

```bash
# 重新生成版本号
npm run release

# 或手动升级版本号
npm version patch
```

### 3. 回退版本

如果发布出错，可以回退：

```bash
# 回退Git标签
git tag -d v0.1.11
git push origin :refs/tags/v0.1.11

# 回退提交
git reset --hard HEAD~1

# 重新发布
npm run release
```

---

## 🔧 配置文件说明

### commitlint.config.js
- 定义提交信息规范
- 强制使用规范的提交类型

### .cz-config.js
- 配置commitizen交互界面
- 自定义提交类型和提示信息

### .versionrc.json
- 配置standard-version
- 定义CHANGELOG格式

---

## 📚 参考资源

- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)
- [standard-version文档](https://github.com/conventional-changelog/standard-version)
- [commitizen文档](https://github.com/commitizen/cz-cli)
