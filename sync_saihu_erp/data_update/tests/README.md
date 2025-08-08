# 数据同步系统测试文档

本测试套件用于验证赛狐ERP数据同步系统的各项功能，确保系统在生产环境中能够稳定运行。

## 🎯 测试目标

- ✅ 验证API认证机制（OAuth2/API Key）
- ✅ 验证三类数据的抓取功能（产品分析、FBA库存、库存明细）
- ✅ 验证数据处理逻辑（清洗、转换、去重）
- ✅ 验证数据库操作（连接、CRUD、事务）
- ✅ 验证系统集成性和稳定性
- ✅ 验证错误处理和容错机制

## 📁 测试结构

```
tests/
├── integration/                    # 集成测试
│   ├── test_auth_flow.py          # API认证流程测试
│   ├── test_data_fetch.py         # 数据抓取功能测试
│   └── test_sync_flow.py          # 完整同步流程测试
├── unit/                          # 单元测试
│   ├── test_models.py             # 数据模型测试
│   ├── test_processors.py         # 数据处理器测试
│   └── test_database.py           # 数据库操作测试
├── utils/                         # 测试工具
│   ├── test_config.py             # 测试配置
│   ├── mock_server.py             # 模拟API服务器
│   └── data_generator.py          # 测试数据生成器
├── fixtures/                      # 测试数据
│   ├── sample_responses.json      # 模拟API响应
│   └── test_data.sql              # 测试数据SQL
├── output/                        # 测试输出
│   ├── test_reports/              # 测试报告
│   └── logs/                      # 测试日志
├── test_runner.py                 # 测试运行器
└── README.md                      # 本文档
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 进入项目目录
cd /home/hudi_data/sync_saihu_erp/data_update

# 安装测试依赖（如果还没有安装）
pip install pytest pytest-cov requests-mock

# 创建测试输出目录
mkdir -p tests/output/logs
mkdir -p tests/output/reports
```

### 2. 配置测试环境

编辑测试配置文件 `tests/utils/test_config.py`：

```python
# 更新你的认证信息
TEST_AUTH_CONFIG = {
    "client_id": "368000",  # 你的clientId
    "client_secret": "3cc6efdf-6861-42e0-b9a5-874a0296640b",  # 你的clientSecret
    "auth_type": "oauth2"
}

# 更新API基础URL（如果需要）
TEST_API_CONFIG = {
    "base_url": "https://api.saihu-erp.com",
    # ... 其他配置
}
```

### 3. 运行测试

#### 方式一：运行完整测试套件（推荐）

```bash
# 运行完整的测试套件
python tests/test_runner.py

# 测试完成后会生成详细的HTML和JSON报告
```

#### 方式二：单独运行特定测试

```bash
# 只运行认证测试
python tests/integration/test_auth_flow.py

# 只运行数据抓取测试
python tests/integration/test_data_fetch.py

# 使用pytest运行（需要安装pytest）
pytest tests/integration/test_auth_flow.py -v
```

## 📊 测试说明

### 1. API认证测试 (`test_auth_flow.py`)

**测试内容：**
- OAuth2客户端凭证流程
- API Key认证流程  
- Bearer Token使用
- Token刷新机制
- 无效凭证处理
- API限流处理

**预期结果：**
```
=== OAuth2认证流程 ===
Client ID: 368000
Client Secret: 3cc6efdf...
发送认证请求到: https://api.saihu-erp.com/oauth/token
认证响应状态码: 200
✅ OAuth2认证测试通过
```

**常见问题：**
- `认证失败: 401` - 检查clientId和clientSecret是否正确
- `连接超时` - 检查网络连接和API服务器状态
- `403权限不足` - 检查账户权限和API访问范围

### 2. 数据抓取测试 (`test_data_fetch.py`)

**测试内容：**
- 产品分析数据抓取（前一天数据 + 前7天更新）
- FBA库存数据抓取（当天全量数据）
- 库存明细数据抓取（当天详细数据）
- 分页数据处理
- 错误处理和重试机制
- 限流遵守情况

**预期结果：**
```
=== 测试产品分析数据抓取 ===
1. 测试前一天数据抓取...
前一天数据数量: 15
2. 测试前7天历史数据抓取...
前7天数据数量: 105
✅ 产品分析数据抓取测试通过
```

**数据格式验证：**
- 产品分析数据必须包含：`product_id`, `data_date`, `sales_amount`等字段
- FBA库存数据必须包含：`sku`, `marketplace_id`, `available_quantity`等字段
- 库存明细数据必须包含：`item_id`, `warehouse_code`, `quantity`等字段

### 3. 系统集成测试 (`test_runner.py`)

**测试流程：**
1. **配置验证** - 检查系统配置的加载和有效性
2. **数据库连接** - 验证数据库连接和基本查询
3. **组件集成** - 验证各模块的协同工作
4. **认证功能** - 完整的API认证流程测试
5. **数据抓取** - 三类数据的抓取功能测试

**报告生成：**
- HTML报告：`tests/output/test_report_YYYYMMDD_HHMMSS.html`
- JSON报告：`tests/output/test_report_YYYYMMDD_HHMMSS.json`

## 🔧 测试配置

### 环境变量

可以通过环境变量覆盖测试配置：

```bash
# 设置测试数据库
export TEST_DB_HOST=localhost
export TEST_DB_PORT=3306
export TEST_DB_USER=test_user
export TEST_DB_PASSWORD=test_password
export TEST_DB_NAME=saihu_erp_sync_test

# 设置API基础URL
export TEST_API_BASE_URL=https://api-test.saihu-erp.com
```

### 测试数据配置

在 `tests/utils/test_config.py` 中可以配置：

```python
# 测试用的产品ID、SKU、市场ID等
TEST_DATA_CONFIG = {
    "sample_product_ids": ["PROD001", "PROD002", "PROD003"],
    "sample_skus": ["SKU001", "SKU002", "SKU003"], 
    "sample_marketplace_ids": ["ATVPDKIKX0DER", "A1PA6795UKMFR9"],
    "sample_warehouse_codes": ["WH001", "WH002"],
    "test_date_range": {
        "start_date": "2025-07-16",
        "end_date": "2025-07-22"
    }
}
```

## 📈 测试结果分析

### 成功标准

- **认证测试**：至少70%的测试用例通过
- **数据抓取测试**：至少80%的测试用例通过
- **集成测试**：至少80%的组件正常工作
- **整体测试**：至少80%的测试套件通过

### 常见失败原因及解决方案

#### 1. 认证失败
```
❌ OAuth2认证测试失败: 401 Unauthorized
```
**解决方案：**
- 检查clientId和clientSecret是否正确
- 确认API服务器地址是否正确
- 检查网络连接和防火墙设置

#### 2. 数据抓取失败
```
❌ 产品分析数据抓取测试失败: 403 Forbidden
```
**解决方案：**
- 检查API访问权限和范围
- 确认账户是否有相应的数据访问权限
- 检查API限流设置

#### 3. 数据库连接失败
```
❌ 数据库连接测试失败: Can't connect to MySQL server
```
**解决方案：**
- 检查数据库服务是否启动
- 验证数据库连接配置
- 确认数据库用户权限

#### 4. 组件导入失败
```
❌ 组件导入失败: ModuleNotFoundError
```
**解决方案：**
- 检查Python路径配置
- 确认所有依赖包已安装
- 验证项目目录结构

## 🔍 调试和排错

### 启用详细日志

```bash
# 设置详细日志级别
export LOG_LEVEL=DEBUG

# 运行测试时查看详细输出
python tests/test_runner.py
```

### 单步调试

```python
# 在测试代码中添加断点
import pdb; pdb.set_trace()

# 或使用print输出调试信息
print(f"API响应: {response.status_code} - {response.text}")
```

### 查看测试日志

```bash
# 查看测试日志
tail -f tests/output/logs/test.log

# 查看特定时间的日志
grep "2025-07-23 14:30" tests/output/logs/test.log
```

## 📝 添加新测试

### 1. 添加单元测试

```python
# tests/unit/test_new_feature.py
import pytest
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.your_module import YourClass

class TestNewFeature:
    def test_new_functionality(self):
        # 测试逻辑
        obj = YourClass()
        result = obj.new_method()
        assert result == expected_value
```

### 2. 添加集成测试

```python
# tests/integration/test_new_integration.py
from tests.utils.test_config import TEST_AUTH_CONFIG

class TestNewIntegration:
    def test_integration_scenario(self):
        # 集成测试逻辑
        pass
```

### 3. 更新测试运行器

在 `tests/test_runner.py` 的 `run_all_tests` 方法中添加新的测试：

```python
def run_all_tests(self):
    # 现有测试...
    
    # 添加新测试
    test_results["new_feature"] = self.run_new_feature_tests()
```

## 🤝 最佳实践

1. **测试独立性**：每个测试用例应该独立运行，不依赖其他测试的结果
2. **数据清理**：测试后清理临时数据，避免影响后续测试
3. **异常处理**：充分测试各种异常情况和边界条件
4. **性能考虑**：避免测试执行时间过长，合理设置超时时间
5. **文档更新**：新增功能时及时更新测试用例和文档

## 📞 支持和反馈

如果在测试过程中遇到问题：

1. 查看测试日志和错误信息
2. 检查配置文件和环境设置
3. 参考本文档的故障排除指南
4. 联系开发团队获取技术支持

---

**最后更新**: 2025-07-23  
**版本**: v1.0.0  
**维护者**: 数据同步系统开发团队