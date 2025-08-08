# 数据重新同步指南

## 🚨 当前状态
- ✅ 数据库表已成功清空
- ✅ 表结构验证完成，所有字段映射正确
- ❌ API认证失败（401错误），需要更新API凭据

## 📋 执行步骤

### 1. 更新API认证配置

**问题**：当前API返回401认证错误
**解决方案**：需要获取正确的API凭据

编辑 `config/config.yml` 中的认证部分：
```yaml
api:
  auth:
    type: "oauth2"
    client_id: "你的实际client_id"  # 从赛狐获取
    client_secret: "你的实际client_secret"  # 从赛狐获取
    sign_key: "你的实际签名密钥"  # 从赛狐获取
```

### 2. 获取正确的API凭据

**联系赛狐技术支持获取：**
- ✅ `client_id`（如：368000）
- ✅ `client_secret`（如：3cc6efdf-xxxx-xxxx-xxxx-xxxxxxxxxxxx）
- ✅ `sign_key`（用于签名计算的密钥）
- ✅ 确认API端点URL：/api/productAnalyze/new/pageList.json

### 3. 验证API连接

```bash
# 更新配置后，测试API连接
python test_new_api.py
```

### 4. 执行完整数据同步

**当API认证问题解决后，执行：**

```bash
# 重新同步产品分析数据（前7天）
python resync_data.py
```

### 5. 手动SQL验证脚本

已生成的SQL文件可用于验证：
- `sync_data.sql` - 数据同步验证
- `check_fields.sql` - 字段验证

## 📊 数据同步范围

| 数据类型 | 日期范围 | 说明 |
|---------|----------|------|
| product_analytics | 前7天（7月30日-8月5日） | 产品分析数据 |
| fba_inventory | 昨天（8月5日） | FBA库存数据 |
| inventory_details | 昨天（8月5日） | 库存明细数据 |

## 🔧 备用解决方案

如果API认证问题暂时无法解决，可以使用以下方法：

### 方案A：使用现有数据文件
```bash
# 检查是否有备份数据文件
ls -la data/backups/
```

### 方案B：联系赛狐技术支持
- 确认API访问权限
- 获取正确的OAuth2配置
- 验证签名算法

### 方案C：使用测试数据
```sql
-- 手动插入测试数据验证字段映射
INSERT INTO product_analytics (asin, sku, data_date, ad_cost, ad_sales, impressions, clicks) 
VALUES ('B08N5WRWNW', 'TEST-SKU', '2024-08-05', 75.50, 450.25, 5000, 150);
```

## 📈 验证查询

### 检查同步结果
```sql
-- 检查总记录数
SELECT COUNT(*) as total_records FROM product_analytics;

-- 检查广告数据不为0的记录
SELECT 
    data_date,
    COUNT(*) as total,
    SUM(CASE WHEN ad_cost > 0 THEN 1 ELSE 0 END) as has_ad_data,
    SUM(ad_cost) as total_ad_cost,
    SUM(ad_sales) as total_ad_sales
FROM product_analytics 
GROUP BY data_date
ORDER BY data_date;

-- 查看具体广告数据
SELECT asin, sku, data_date, ad_cost, ad_sales, impressions, clicks
FROM product_analytics 
WHERE ad_cost > 0
ORDER BY ad_cost DESC
LIMIT 10;
```

## 🎯 下一步行动

1. **立即**：联系赛狐技术支持获取正确的API凭据
2. **更新配置**：替换config.yml中的认证信息
3. **验证连接**：运行测试脚本确认API正常工作
4. **执行同步**：运行完整的数据同步脚本
5. **验证结果**：使用提供的SQL查询验证数据正确性

## 💡 关键发现

- ✅ 数据库表结构完全正确，包含所有必需的广告字段
- ✅ 字段映射逻辑正确，能正确处理广告数据
- ✅ 系统架构已完全更新支持新的API端点
- ❌ 仅API认证配置需要更新

## 📞 技术支持

如需帮助：
1. 联系赛狐官方技术支持获取API凭据
2. 确认OAuth2认证流程
3. 验证签名算法是否正确