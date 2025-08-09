# 项目笔记和备忘

## 重要配置信息

### 数据库连接
```bash
# 统一数据库配置
DATABASE_URL="postgresql://amazon_analyst:amazon_analyst_2024@localhost:5432/amazon_analyst"

# 连接测试
psql -h localhost -U amazon_analyst -d amazon_analyst
```

### 开发环境设置
```bash
# 启动开发服务器
pnpm dev

# 数据库操作
pnpm db:studio      # 打开数据库管理界面
pnpm db:generate    # 生成迁移文件
pnpm db:migrate     # 应用迁移
```

## 常见问题解决方案

### PostgreSQL连接问题 ✅ 已解决
**问题**: `FATAL: no pg_hba.conf entry for host "113.71.250.72", user "amazon_analyst", database "amazon_analyst", SSL encryption`

**完整解决方案**:
1. **服务器端配置** (需要管理员权限):
   ```bash
   # 编辑 pg_hba.conf 文件
   sudo nano /etc/postgresql/15/main/pg_hba.conf
   
   # 添加IP白名单
   host    amazon_analyst    amazon_analyst    113.71.250.72/32    md5
   
   # 重启PostgreSQL服务
   sudo systemctl restart postgresql
   ```

2. **DBeaver客户端配置**:
   ```
   Host: localhost (或服务器地址)
   Port: 5432
   Database: amazon_analyst
   Username: amazon_analyst
   Password: amazon_analyst_2024
   SSL Mode: disable (首选) 或 require
   ```

3. **高级连接参数**:
   ```
   在Driver Properties中添加:
   sslmode = disable
   ```

### Cursor CLI记忆保存 ✅ 已实现
**需求**: 手动保存Cursor AI的项目记忆

**解决方案**:
1. **Memory Bank系统** (主要方案):
   - 创建 `memory-bank/` 目录
   - 7个核心记忆文件
   - 使用 `initialize memory bank` 和 `update memory bank` 命令

2. **.cursorrules文件** (辅助方案):
   - 项目根目录的规则文件
   - 快速上下文加载

3. **手动维护策略**:
   - 定期更新活跃上下文
   - 记录重要配置和解决方案
   - 维护项目进度和变更日志

## 有用的命令和脚本

### 数据库管理
```bash
# 检查数据库状态
./manage_postgres.sh status

# 创建备份
./manage_postgres.sh backup

# 测试连接
python3 test_database.py

# 重置数据库 (慎用)
./manage_postgres.sh reset
```

### 赛狐ERP同步
```bash
# 即时同步
cd sync_saihu_erp/data_update
python run_sync_now.py

# 检查同步状态
python continuous_sync_4hours.py --status
```

### Memory Bank管理
```bash
# 在Cursor聊天中使用的命令
initialize memory bank      # 初始化记忆库
update memory bank         # 更新记忆库
update memory bank for [specific topic]  # 针对特定主题更新

# 手动文件维护
ls memory-bank/           # 查看记忆文件
code memory-bank/         # 编辑记忆文件
```

## 项目资源链接

### 文档
- 架构文档: `ARCHITECTURE.md`
- 环境设置: `ENVIRONMENT_SETUP.md`
- Claude指南: `CLAUDE.md`

### 重要文件路径
- 数据库模式: `src/db/schema.ts`
- 赛狐ERP模式: `src/db/saihu_erp_schema.sql`
- 配置文件: `sync_saihu_erp/data_update/config/config.yml`

## 开发提示

### 性能优化
- 使用React Server Components减少客户端JavaScript
- 实现适当的缓存策略
- 优化数据库查询和索引

### 安全注意事项
- 所有用户输入必须验证和清理
- API端点需要适当的身份验证
- 敏感信息使用环境变量

### 测试策略
- 单元测试覆盖核心业务逻辑
- 集成测试验证API端点
- 端到端测试确保用户流程正常

## 待研究的技术
- [ ] Redis缓存集成
- [ ] Elasticsearch搜索优化
- [ ] WebSocket实时通信
- [ ] GraphQL API设计
- [ ] 微服务架构迁移
