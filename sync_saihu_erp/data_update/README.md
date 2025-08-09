# 赛狐ERP数据同步系统

一个基于Python的高性能数据同步系统，用于从赛狐ERP接口抓取和处理三类业务数据：产品分析数据、FBA库存数据和库存明细数据。

## 功能特性

- 🚀 **高性能抓取**: 支持并发请求、限流控制、自动重试
- 📊 **智能数据处理**: 数据清洗、去重、验证和转换
- ⏰ **定时任务调度**: 基于APScheduler的灵活任务调度
- 🔄 **增量更新**: 产品分析数据支持前7天历史数据更新
- 💾 **数据持久化**: MySQL数据库存储，支持事务处理
- 📝 **完善日志**: 结构化日志记录，支持多级别输出
- 🔧 **灵活配置**: YAML配置文件，支持环境变量覆盖

## 系统架构

```
数据同步系统
├── 接口解析层 (parsers/)      # MD文档解析，生成API模板
├── 数据抓取层 (scrapers/)     # HTTP请求，数据获取
├── 数据处理层 (processors/)   # 数据清洗，转换，验证
├── 数据库操作层 (database/)   # 连接池，事务处理，CRUD操作
├── 调度层 (scheduler/)        # 定时任务管理
├── 配置管理 (config/)         # 配置加载，环境变量处理
└── 工具层 (utils/)           # 日志，监控，通用工具
```

## 快速开始

### 1. 环境要求

- Python 3.9+
- MySQL 5.7+
- 内存: 1GB+
- 磁盘: 10GB+

### 2. 安装依赖

```bash
# 进入项目目录
cd /home/hudi_data/sync_saihu_erp/data_update

# 安装Python依赖
pip install -r requirements.txt
```

### 3. 数据库初始化

```bash
# 登录MySQL
mysql -u root -p

# 执行建表脚本
source sql/init.sql
```

### 4. 配置系统

```bash
# 复制配置文件
cp config/config.yml.example config/config.yml

# 编辑配置文件
vim config/config.yml
```

**关键配置项：**

```yaml
# 数据库配置
database:
  host: localhost
  port: 3306
  user: root
  password: "your_password"
  database: amazon_analyst

# API配置
api:
  base_url: "https://api.saihu-erp.com"
  auth:
    type: "bearer"
    token: "your_api_token"
```

### 5. 运行系统

```bash
# 测试模式 - 验证配置和组件
python main.py test

# 交互模式 - 手动控制
python main.py interactive

# 服务模式 - 后台运行
python main.py start
```

## 详细使用说明

### 数据同步逻辑

#### 1. 产品分析数据
- **每日01:00**: 抓取前一天的新数据
- **每日02:00**: 更新前7天的历史数据
- **特点**: 支持增量更新，数据去重，指标计算

#### 2. FBA库存数据
- **每日06:00**: 抓取当天的全量库存数据
- **特点**: 全量替换，支持低库存监控

#### 3. 库存明细数据
- **每日06:30**: 抓取当天的详细库存信息
- **特点**: 支持多仓库，过期提醒，批次管理

### 命令行操作

```bash
# 启动服务
python main.py start

# 交互式控制台
python main.py interactive

# 测试配置
python main.py test
```

### 交互式命令

在交互模式下，支持以下操作：

1. **查看任务状态** - 显示所有定时任务的执行状态
2. **立即执行同步** - 手动触发特定数据类型的同步
3. **查看系统状态** - 显示调度器和系统运行状态
4. **退出系统** - 安全关闭所有组件

### API文档解析

系统会自动查找并解析以下路径的API文档：

- `/home/hudi_data/赛狐ERP_API接口文档.md`
- `docs/api.md`
- `docs/接口文档.md`
- `api_doc.md`

**支持的文档格式：**

```markdown
## 产品分析数据接口

**URL**: `/api/v1/analytics/products`
**方法**: GET

### 参数
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| date | string | 是 | 查询日期 YYYY-MM-DD |
| product_ids | string | 否 | 产品ID列表，逗号分隔 |

### 响应示例
```json
{
  "code": 200,
  "data": [
    {
      "productId": "PROD001",
      "date": "2025-07-22",
      "salesAmount": 1250.50,
      "salesQuantity": 25
    }
  ]
}
```

## 配置说明

### 环境变量

支持通过环境变量覆盖配置：

```bash
# 数据库配置
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=amazon_analyst

# API配置
export API_BASE_URL=https://api.saihu-erp.com
export API_TOKEN=your_api_token
```

### 配置文件结构

```yaml
database:          # 数据库配置
api:              # API接口配置
sync:             # 同步任务配置
scheduler:        # 任务调度配置
logging:          # 日志配置
monitoring:       # 监控告警配置
```

## 监控和维护

### 日志文件

- **应用日志**: `logs/sync.log`
- **错误日志**: `logs/error.log`
- **调度日志**: `logs/scheduler.log`

### 数据库监控

```sql
-- 查看同步任务执行记录
SELECT * FROM sync_task_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- 查看任务成功率
SELECT 
    task_type,
    COUNT(*) as total_tasks,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_tasks,
    ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM sync_task_logs 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY task_type;
```

### 性能优化

1. **调整批处理大小**
   ```yaml
   sync:
     batch_size: 1000  # 根据内存情况调整
   ```

2. **优化并发数量**
   ```yaml
   sync:
     parallel_workers: 8  # 根据CPU核数调整
   ```

3. **数据库连接池**
   ```yaml
   database:
     pool_size: 20
     max_overflow: 30
   ```

## 故障排查

### 常见问题

#### 1. 数据库连接失败
```
错误: Can't connect to MySQL server
解决: 检查数据库配置、网络连接、防火墙设置
```

#### 2. API调用失败
```
错误: HTTP 401 Unauthorized
解决: 检查API token是否正确，是否过期
```

#### 3. 任务调度异常
```
错误: Job execution failed
解决: 查看logs/scheduler.log，检查任务函数定义
```

#### 4. 内存不足
```
错误: Out of memory
解决: 减少batch_size，增加系统内存
```

### 日志分析

```bash
# 查看错误日志
tail -f logs/sync.log | grep ERROR

# 统计同步成功率
grep "数据处理完成" logs/sync.log | tail -20

# 监控任务执行时间
grep "执行时长" logs/sync.log | tail -10
```

### 数据修复

```sql
-- 重置失败的任务状态
UPDATE sync_task_logs 
SET status = 'failed', error_message = '手动重置'
WHERE status = 'running' AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- 删除重复数据
DELETE p1 FROM product_analytics p1
INNER JOIN product_analytics p2 
WHERE p1.id > p2.id 
AND p1.product_id = p2.product_id 
AND p1.data_date = p2.data_date;
```

## 扩展开发

### 添加新的数据类型

1. **创建数据模型** (`src/models/`)
2. **实现抓取器** (`src/scrapers/`)
3. **实现处理器** (`src/processors/`)
4. **更新调度配置** (`src/scheduler/`)
5. **添加数据库表** (`sql/`)

### 自定义处理逻辑

```python
from src.processors import BaseProcessor

class CustomProcessor(BaseProcessor):
    def _clean_data(self, data_list):
        # 自定义数据清洗逻辑
        return cleaned_data
    
    def _transform_data(self, data_list):
        # 自定义数据转换逻辑
        return transformed_data
    
    def _persist_data(self, data_list):
        # 自定义数据持久化逻辑
        return result
```

## 安全考虑

- ✅ API密钥加密存储
- ✅ 敏感信息脱敏记录
- ✅ 数据库连接加密
- ✅ 访问日志记录
- ✅ 参数验证和过滤

## 支持和反馈

如遇到问题或需要技术支持，请：

1. 查看日志文件定位问题
2. 检查配置文件是否正确
3. 验证网络和数据库连接
4. 联系技术支持团队

---

**项目版本**: v1.0.0  
**最后更新**: 2025-07-23  
**Python版本**: 3.9+  
**许可证**: MIT License