# 库存点权限系统设计方案

基于现有product_analysis2（inventory_deals表）构建的库存点权限管理系统。

## 系统架构概述

### 核心表结构
- **inventorypoints_right**: 库存点权限表
- **operator_visibility**: 操作员可见性配置表
- **inventory_deals**: 现有的product_analysis2数据表

### 权限控制维度
1. **按操作员**: 基于`operator_name`控制访问权限
2. **按库存点**: 控制可访问的`warehouse_location`
3. **按产品**: 控制可访问的`asin`和`product_name`
4. **按业务员**: 控制可查看的`sales_person`数据
5. **按时间**: 通过`effective_date`和`expiry_date`控制权限有效期

## 快速开始

### 1. 应用数据库迁移

```bash
# 生成迁移文件
pnpm db:generate

# 执行迁移
pnpm db:migrate

# 验证表结构
pnpm db:push
```

### 2. 配置权限管理

#### 配置操作员权限
```typescript
import { assignPermission } from '@/lib/auth/inventory-permission';

await assignPermission({
  operator_name: "zhangsan",
  operator_uuid: "uuid-of-zhangsan",
  warehouse_location: "US-USA",
  access_level: "full",
  view_sensitivity_data: true,
  granted_by: "admin"
});
```

#### 配置操作员可见性
```typescript
import { configureOperatorVisibility } from '@/lib/auth/inventory-permission';

await configureOperatorVisibility({
  operator_uuid: "uuid-of-operator",
  operator_name: "lisi",
  visible_warehouses: ["US-USA", "EU-DE"],
  visible_sales_persons: ["wangwu", "zhaoliu"],
  visible_asins: ["B08N5WRWNW", "B07P8Q6W5W"],
  updated_by: "admin"
});
```

### 3. 访问权限过滤数据

#### API使用示例
```bash
# 检查用户权限
curl -X GET "/api/inventory-permissions/check?operator_name=zhangsan&warehouse_location=US-USA"

# 获取可见数据
curl -X POST "/api/inventory-permissions" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "filter-data",
    "operator_name": "zhangsan",
    "page": 1,
    "limit": 20,
    "warehouse": "US-USA"
  }'
```

## 权限级别说明

| 权限级别 | 描述 | 数据访问 |
|----------|------|----------|
| `full` | 完全权限 | 所有原始数据，包括敏感信息 |
| `masked` | 脱敏权限 | 关键字段被脱敏处理 |
| `restricted` | 限制权限 | 仅基本统计数据，敏感信息隐藏 |

### 脱敏规则

#### 产品名称脱敏
- `完整数据`: "Apple iPhone 14 Pro Max 128GB Silver"
- `脱敏数据`: "Apple iPho...***"

#### ASIN脱敏
- `完整数据`: "B09G9FPHYK"
- `脱敏数据`: "B09****YK"

#### 销售金额脱敏
- `完整数据`: $15,234.56
- `脱敏数据`: $15,200.00 (模糊到百位)

## 数据库结构

### inventorypoints_right表

| 字段 | 类型 | 描述 |
|------|------|------|
| `operator_name` | varchar(100) | 操作员名称 |
| `operator_uuid` | varchar(255) | 关联users.uuid |
| `warehouse_location` | varchar(50) | 仓库地点 |
| `asin` | varchar(20) | 产品ASIN (可选) |
| `product_name` | varchar(500) | 完整品名 |
| `product_name_masked` | varchar(500) | 脱敏后品名 |
| `access_level` | varchar(20) | 访问级别 |
| `view_sensitivity_data` | boolean | 是否可看敏感数据 |

### operator_visibility表

| 字段 | 类型 | 描述 |
|------|------|------|
| `visible_warehouses` | text(JSON) | 可见仓库列表 |
| `visible_sales_persons` | text(JSON) | 可见业务员列表 |
| `visible_asins` | text(JSON) | 可见ASIN列表 |
| `masking_rules` | text(JSON) | 脱敏规则配置 |

## API接口

### 权限检查
```typescript
GET /api/inventory-permissions/check
Params: operator_name, warehouse_location, [asin]
```

### 权限分配
```typescript
POST /api/inventory-permissions
Body: {
  type: "assign-permission",
  operator_name: string,
  warehouse_location: string,
  access_level: "full" | "masked" | "restricted",
  ...
}
```

### 数据过滤
```typescript
POST /api/inventory-permissions
Body: {
  type: "filter-data",
  operator_name: string,
  page?: number,
  limit?: number,
  warehouse?: string,
  asin?: string,
  date_range?: object
}
```

## 集成现有系统

### Next.js应用集成
在需要权限控制的路由或API中添加：

```typescript
// 在页面组件中使用
import { getUserVisibleWarehouses } from '@/lib/auth/inventory-permission';

const warehouses = await getUserVisibleWarehouses(session.user.username);

// 服务端组件中使用
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

### React Hook集成
```typescript
import { useState, useEffect } from 'react';

function useInventoryPermission(operatorName: string) {
  const [warehouses, setWarehouses] = useState<string[]>([]);
  
  useEffect(() => {
    fetch('/api/inventory-permissions/warehouses', {
      method: 'POST',
      body: JSON.stringify({ 
        type: 'visible-warehouses',
        operator_name: operatorName 
      })
    })
    .then(res => res.json())
    .then(data => setWarehouses(data.warehouses || []));
  }, [operatorName]);
  
  return warehouses;
}
```

## 数据迁移策略

### 批量权限分配
```sql
-- 为所有用户分配基础权限
INSERT INTO inventorypoints_right (operator_name, operator_uuid, warehouse_location, access_level, view_sensitivity_data, granted_by)
SELECT u.username, u.uuid, 'ALL', 'full', true, 'system'
FROM users u WHERE u.role = 'admin';

-- 为业务用户分配可见性配置
INSERT INTO operator_visibility (
    operator_uuid, 
    operator_name, 
    visible_warehouses, 
    visible_sales_persons, 
    default_access_level
)
SELECT 
    uuid,
    username,
    '["US-USA", "US-CA", "EU-DE", "EU-UK"]',
    '[]',  -- 可访问所有业务员数据
    'full'
FROM users 
WHERE role = 'business_user';
```

## 监控与审计

### 权限变更日志
每个权限分配都有完整的审计记录：
- 操作记录
- 权限变更时间
- 授权人信息
- 生效与过期日期

### 数据访问监控
通过API响应头可以追踪访问权限：
```
X-Permissions-Status: masked
X-Visible-Warehouses: US-USA,US-CA
```

## 故障排查

### 常见问题

1. **权限检查失败**
   - 检查operator_name是否正确
   - 确认有效期设置
   - 验证is_active状态

2. **数据脱敏不正确**
   - 检查masking_rules配置
   - 验证access_level设置
   - 确认skip_masking设置

3. **数据访问为空**
   - 检查visible_warehouses配置
   - 确认visible_sales_persons范围
   - 验证visible_asins列表

### 调试工具
```typescript
// 权限调试函数
async function debugPermission(operator_name: string) {
  const config = await getOperatorVisibilityConfig(operator_uuid);
  const permissions = await checkUserPermission(operator_name, 'US-USA');
  console.log({ config, permissions });
}
```

## 扩展功能

### 角色权限继承
可以实现角色的权限继承和批量管理。

### 动态脱敏规则
根据数据敏感度动态调整脱敏级别。

### 实时权限更新
支持实时权限变更，无需重新登录。

## 安全建议

1. **最小权限原则**: 给用户分配最少必要权限
2. **权限审核**: 定期检查权限分配合理性
3. **访问日志**: 记录权限使用和变更历史
4. **敏感字段**: 对关键业务数据设置额外保护
5. **时效控制**: 设置合理的权限有效期

## 版本说明

- **版本**: 1.0.0
- **创建**: 2024年8月
- **维护**: Tepin Team
- **部署状态**: 就绪