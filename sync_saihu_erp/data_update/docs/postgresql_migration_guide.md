# PostgreSQL迁移指南

## 📋 迁移概述

从MySQL迁移到PostgreSQL的核心变更列表。

## 🔧 主要技术差异

### 1. 数据库驱动
- **MySQL**: `PyMySQL>=1.0.2` → **PostgreSQL**: `psycopg2-binary>=2.9.0`

### 2. 连接参数差异
```diff
-- MySQL配置
database:
  host: localhost
  port: 3306
  user: root
  password: ""
  database: saihu_erp_sync
  charset: utf8mb4

++ PostgreSQL配置
database:
  host: localhost
  port: 5432
  user: postgres
  password: ""
  database: saihu_erp_sync
  sslmode: prefer
  max_overflow: 20
```

### 3. SQL语法差异

#### 数据类型映射
| MySQL类型 | PostgreSQL类型 | 说明 |
|-----------|-------------|------|
| `INT`/`INTEGER` | `INTEGER` | 标准整数 |
| `BIGINT` | `BIGINT` | 大整数 |
| `DECIMAL(10,2)` | `DECIMAL(10,2)` | 定点数 |
| `VARCHAR(255)` | `VARCHAR(255)` | 变长字符串 |
| `TEXT` | `TEXT` | 大文本 |
| `DATETIME` | `TIMESTAMP` | 时间戳 |
| `TINYINT(1)` | `BOOLEAN` | 布尔值 |
| `AUTO_INCREMENT` | `SERIAL`/`BIGSERIAL` | 自增ID |

#### 日期时间函数
| MySQL函数 | PostgreSQL函数 | 用途 |
|-----------|-------------|------|
| `NOW()` | `CURRENT_TIMESTAMP` | 当前时间 |
| `CURDATE()` | `CURRENT_DATE` | 当前日期 |
| `DATEDIFF(d1,d2)` | `d1 - d2` | 日期差 |
| `DATE_FORMAT()` | `TO_CHAR()` | 日期格式化 |

#### UPSERT(插入或更新)
```sql
-- MySQL写法
INSERT INTO table (...) VALUES (...)
ON DUPLICATE KEY UPDATE
  col1 = VALUES(col1),
  col2 = VALUES(col2);

-- PostgreSQL写法
INSERT INTO table (...) VALUES (...)
ON CONFLICT (唯一键) DO UPDATE
  SET col1 = EXCLUDED.col1,
      col2 = EXCLUDED.col2;
```

### 4. 连接查询差异

#### 表存在检查
```python
# MySQL
"SHOW TABLES LIKE %s"

# PostgreSQL
"""
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = %s
)
"""
```

## 🚀 迁移步骤

### Step 1: 安装PostgreSQL驱动
```bash
pip install psycopg2-binary>=2.9.0
```

### Step 2: 创建PostgreSQL数据库
```bash
# 连接到PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE saihu_erp_sync WITH OWNER postgres;

# 退出
\q
```

### Step 3: 执行PostgreSQL初始化脚本
```bash
# 使用psql执行初始化
psql -U postgres -d saihu_erp_sync -f sql/postgresql_init.sql
```

### Step 4: 更新环境变量
```bash
# 修改.env文件或环境变量
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=your_password
export DB_NAME=saihu_erp_sync
```

## 📊 数据验证

### 检查表是否创建
```sql
-- 查看所有表
\dt

-- 查看表结构
\d fba_inventory
\d product_analytics
\d inventory_details
```

### 测试连接
```python
from src.database.connection import db_manager

# 测试连接
if db_manager.test_connection():
    print("✅ PostgreSQL连接成功")
else:
    print("❌ PostgreSQL连接失败")

# 检查表存在
print("fba_inventory表存在:", db_manager.table_exists('fba_inventory'))
print("product_analytics表存在:", db_manager.table_exists('product_analytics'))
```

## 🔍 常见问题排查

### 1. 端口冲突
如果PostgreSQL默认5432端口被占用，可以在配置文件中修改端口。

### 2. 身份验证问题
```bash
# 修改PostgreSQL配置文件 pg_hba.conf
# trust -> 无需密码
# md5 -> 需要密码
local   all             postgres                                md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5

# 重启PostgreSQL服务
sudo systemctl restart postgresql
```

### 3. psycopg2安装问题
如果在某些系统上安装失败：
```bash
# Ubuntu/Debian
sudo apt-get install libpq-dev

# CentOS/RHEL
sudo yum install postgresql-devel

# macOS
brew install postgresql
```

## 🔄 迁移验证检查表

- [ ] PostgreSQL服务运行正常
- [ ] 数据库创建成功
- [ ] 所有表结构创建完成
- [ ] 索引建立成功
- [ ] 测试连接通过
- [ ] UPSERT语法测试通过
- [ ] 数据同步功能正常运行
- [ ] 定时任务正常工作

## 📚 参考资料

- [PostgreSQL官方文档](https://www.postgresql.org/docs/)
- [psycopg2文档](https://www.psycopg.org/docs/)
- [SQLAlchemy PostgreSQL指南](https://docs.sqlalchemy.org/en/14/dialects/postgresql.html)

## 💡 性能优化建议

1. **连接池配置**：调整pool_size和max_overflow参数
2. **查询优化**：利用PostgreSQL的查询计划器
3. **索引策略**：合理使用复合索引和GIN索引
4. **分区表**：对于大数据量可考虑使用表分区