# Cursor CLI Memory Bank 使用指南

## 🧠 什么是 Memory Bank？

Memory Bank 是一个用于增强 Cursor AI 助手记忆能力的系统，通过结构化的 Markdown 文件来保存项目上下文、进度和重要信息。

## 📁 文件结构说明

```
memory-bank/
├── projectbrief.md    # 项目概述 - 项目基本信息、技术栈、架构
├── activeContext.md   # 当前上下文 - 正在进行的任务、用户需求
├── progress.md        # 进度记录 - 已完成任务、里程碑、待办事项
├── rules.md          # 项目规则 - 代码规范、开发流程、技术约束
├── changelog.md      # 变更日志 - 版本更新、功能变更记录
├── notes.md          # 项目笔记 - 配置信息、常见问题、有用命令
└── README.md         # 本使用指南
```

## 🚀 如何使用 Memory Bank

### 1. 初始化 Memory Bank
在 Cursor 聊天中输入：
```
initialize memory bank
```
AI 会根据当前项目自动填充初始内容。

### 2. 更新 Memory Bank
当项目有重要变更时，输入：
```
update memory bank
```
AI 会重新审视所有文件并更新相关内容。

### 3. 手动维护
您可以直接编辑 `memory-bank/` 目录中的任何文件：
- 及时更新 `activeContext.md` 中的当前任务
- 在 `progress.md` 中记录完成的工作
- 在 `changelog.md` 中记录重要变更
- 在 `notes.md` 中添加有用的配置和命令

## 💡 最佳实践

### 定期更新
- **每日**: 更新 `activeContext.md` 和 `progress.md`
- **每周**: 检查并更新 `changelog.md`
- **每月**: 全面审查所有文件

### 内容质量
- 保持信息准确和最新
- 使用清晰的标题和结构
- 添加具体的代码示例和配置
- 记录重要的决策和原因

### 协作
- 团队成员都可以编辑这些文件
- 重要变更应该通过Git版本控制
- 定期同步团队对项目的理解

## 🔧 高级用法

### 自定义指令
您可以创建特定的更新指令：
```
update memory bank for database changes
update memory bank for new feature completion
update memory bank for bug fixes
```

### 查询记忆
向AI询问项目相关问题时，它会自动参考Memory Bank：
```
"根据我们的项目规则，这个组件应该如何设计？"
"当前项目的主要技术债务是什么？"
"我们上次讨论的数据库配置是什么？"
```

### 项目切换
每个项目都应该有自己的Memory Bank，这样AI可以快速理解不同项目的上下文。

## 📈 Memory Bank 的好处

1. **上下文连续性**: AI能够记住长期的项目背景
2. **知识积累**: 重要信息不会丢失
3. **团队协作**: 新成员可以快速了解项目
4. **决策追踪**: 记录重要决策的来龙去脉
5. **问题解决**: 常见问题和解决方案得以保留

## 🎯 开始使用

1. ✅ Memory Bank 文件已创建完成
2. 在 Cursor 中输入 `initialize memory bank` 来完善内容
3. 开始您的开发工作，定期更新相关文件
4. 享受增强的AI协作体验！

---

💡 **提示**: 这个 Memory Bank 系统是您项目知识的大脑，投入时间维护它会让您的开发效率大大提升！
