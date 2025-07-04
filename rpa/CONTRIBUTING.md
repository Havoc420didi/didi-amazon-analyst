# 贡献指南

感谢您对 Pipiads RPA 系统的贡献！本文档将帮助您了解如何为项目做出贡献。

## 📋 贡献类型

我们欢迎以下类型的贡献：

- 🐛 **Bug 修复** - 修复现有功能的问题
- 💡 **新功能** - 添加新的功能或增强现有功能
- 📚 **文档改进** - 改进文档、添加示例或教程
- 🔧 **代码优化** - 性能优化、代码重构
- 🧪 **测试** - 添加或改进测试用例
- 🎨 **UI/UX 改进** - 改进人机协作界面

## 🚀 开始贡献

### 1. 设置开发环境

```bash
# 克隆项目
git clone https://github.com/your-org/pipiads-rpa.git
cd pipiads-rpa

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
pip install -r requirements-dev.txt  # 开发依赖
```

### 2. 创建功能分支

```bash
# 基于最新的主分支创建功能分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 或者修复bug
git checkout -b bugfix/issue-number-description
```

### 3. 进行开发

- 遵循现有的代码风格和约定
- 为新功能添加适当的测试
- 更新相关文档
- 确保所有测试通过

### 4. 提交更改

```bash
# 暂存更改
git add .

# 提交更改（使用有意义的提交消息）
git commit -m "feat: add new data validation feature"

# 推送到您的分支
git push origin feature/your-feature-name
```

### 5. 创建 Pull Request

1. 在 GitHub 上创建 Pull Request
2. 填写 PR 模板中的所有必需信息
3. 等待代码审查
4. 根据反馈进行修改

## 📝 代码规范

### Python 代码风格

我们遵循 PEP 8 规范，并使用以下工具：

```bash
# 代码格式化
black .

# 导入排序
isort .

# 代码检查
flake8 .

# 类型检查
mypy .
```

### 提交消息规范

使用约定式提交格式：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**类型 (type):**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式化（不影响代码逻辑）
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例:**
```
feat(collector): add retry mechanism for failed requests

- Add exponential backoff for network requests
- Implement maximum retry limit configuration
- Add logging for retry attempts

Closes #123
```

## 🧪 测试要求

### 运行测试

```bash
# 运行所有测试
python -m pytest

# 运行特定测试文件
python -m pytest tests/test_collector.py

# 运行带覆盖率的测试
python -m pytest --cov=. --cov-report=html
```

### 编写测试

- 为新功能编写单元测试
- 确保测试覆盖率不低于 80%
- 使用有意义的测试名称
- 包含边界情况和错误处理测试

**测试示例:**
```python
def test_data_collector_login_success():
    """测试正常登录流程"""
    collector = PipiadsCollector()
    collector.start_session()
    
    # Mock 成功登录
    with patch('data_collector.webdriver') as mock_driver:
        mock_driver.find_element.return_value.is_displayed.return_value = True
        result = collector.login()
    
    assert result == True
    collector.close_session()
```

## 📚 文档要求

### 代码文档

- 所有公共函数和类必须有文档字符串
- 使用 Google 风格的文档字符串
- 包含参数、返回值和异常说明

**示例:**
```python
def process_data(self, data_file: str, filters: Dict[str, Any] = None) -> Dict[str, Any]:
    """处理并分析采集的数据
    
    Args:
        data_file: 数据文件路径
        filters: 可选的过滤条件字典
        
    Returns:
        包含分析结果的字典，包括:
        - total_products: 总产品数
        - high_potential_count: 高潜力产品数
        - recommendations: 推荐列表
        
    Raises:
        FileNotFoundError: 当数据文件不存在时
        ValueError: 当数据格式不正确时
    """
```

### README 更新

如果您的更改影响了使用方式，请更新 README.md：

- 新功能的使用说明
- 配置选项的变更
- 依赖项的更新

## 🔍 代码审查流程

### 审查标准

我们的代码审查关注以下方面：

1. **功能正确性**: 代码是否实现了预期功能
2. **代码质量**: 是否遵循最佳实践和编码规范
3. **性能**: 是否存在性能问题
4. **安全性**: 是否存在安全漏洞
5. **可维护性**: 代码是否易于理解和维护
6. **测试覆盖**: 是否有足够的测试覆盖

### 审查清单

**作者清单:**
- [ ] 代码已经过本地测试
- [ ] 遵循了代码规范
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 提交消息符合规范

**审查者清单:**
- [ ] 代码逻辑正确
- [ ] 测试覆盖充分
- [ ] 文档完整准确
- [ ] 性能可接受
- [ ] 安全考虑充分

## 🐛 Bug 报告

请使用 Issue 模板报告 Bug，包含以下信息：

1. **环境信息**: 操作系统、Python 版本、依赖版本
2. **重现步骤**: 详细的步骤说明
3. **预期行为**: 应该发生什么
4. **实际行为**: 实际发生了什么
5. **日志信息**: 相关的错误日志
6. **截图**: 如果适用的话

## 💡 功能请求

请使用 Issue 模板提交功能请求，包含：

1. **功能描述**: 清楚地描述新功能
2. **使用场景**: 为什么需要这个功能
3. **建议实现**: 如果有的话
4. **优先级**: 功能的重要性
5. **兼容性**: 是否会影响现有功能

## 🏷️ 标签系统

我们使用以下标签来分类 Issues 和 PRs：

**类型标签:**
- `bug`: Bug 报告
- `enhancement`: 功能增强
- `documentation`: 文档相关
- `question`: 问题询问
- `help wanted`: 需要帮助

**优先级标签:**
- `priority/high`: 高优先级
- `priority/medium`: 中等优先级
- `priority/low`: 低优先级

**状态标签:**
- `status/in-progress`: 正在进行中
- `status/review`: 等待审查
- `status/blocked`: 被阻塞
- `status/done`: 已完成

## 📧 联系方式

如果您有任何问题或需要帮助，请联系：

- **邮箱**: rpa-dev@company.com
- **GitHub Issues**: 在项目中创建 issue
- **讨论**: 使用 GitHub Discussions

## 📄 许可证

通过贡献代码，您同意您的贡献将在与项目相同的许可证下发布。

## 🙏 致谢

感谢所有为 Pipiads RPA 系统做出贡献的开发者！

---

**最后更新**: 2024年1月1日
**版本**: v1.0.0