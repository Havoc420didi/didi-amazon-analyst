-- Migration: 0007_dynamic_operator_permissions.sql
-- Description: 基于operator字段的动态权限管理系统

-- 删除旧的权限表
DROP TABLE IF EXISTS inventorypoints_right CASCADE;
DROP TABLE IF EXISTS operator_visibility CASCADE;

-- 创建动态权限表
CREATE TABLE "inventorypermissions" (
    "id" SERIAL PRIMARY KEY,
    "operator" VARCHAR(100) NOT NULL,
    "operator_uuid" VARCHAR(255),
    "data_source" VARCHAR(50) NOT NULL DEFAULT 'inventory_deals',
    "warehouse_location" VARCHAR(50),
    "asin" VARCHAR(20),
    "sales_person" VARCHAR(100),
    "permission_rule" TEXT NOT NULL,
    "data_access_level" VARCHAR(30) NOT NULL DEFAULT 'all',
    "visible_fields" TEXT,
    "masked_fields" TEXT,
    "masking_config" TEXT,
    "can_view_delegated" BOOLEAN NOT NULL DEFAULT FALSE,
    "can_view_team" BOOLEAN NOT NULL DEFAULT FALSE,
    "can_view_all" BOOLEAN NOT NULL DEFAULT FALSE,
    "conditions" TEXT,
    "effective_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "expiry_date" DATE,
    "config_author" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "description" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建操作员权限规则表
CREATE TABLE "operatorpermissionrules" (
    "id" SERIAL PRIMARY KEY,
    "operator" VARCHAR(100) NOT NULL,
    "rule_name" VARCHAR(50) NOT NULL,
    "rule_type" VARCHAR(30) NOT NULL,
    "rule_config" TEXT NOT NULL,
    "filter_criteria" TEXT,
    "masking_strategy" TEXT,
    "access_mapping" TEXT,
    "inherits_from" VARCHAR(100),
    "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_by" VARCHAR(255) NOT NULL,
    "last_updated" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "description" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建仓库操作员映射表
CREATE TABLE "warehouseoperatormapping" (
    "id" SERIAL PRIMARY KEY,
    "warehouse_location" VARCHAR(50) NOT NULL,
    "operator" VARCHAR(100) NOT NULL,
    "primary_operator" VARCHAR(100),
    "secondary_operators" TEXT,
    "inherit_permissions" BOOLEAN NOT NULL DEFAULT TRUE,
    "custom_permissions" TEXT,
    "hierarchy_level" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引优化查询性能
CREATE INDEX "idx_operator_permissions" ON "inventorypermissions" ("operator", "data_source");
CREATE INDEX "idx_permissions_warehouse" ON "inventorypermissions" ("warehouse_location", "is_active");
CREATE INDEX "idx_permissions_asin" ON "inventorypermissions" ("asin", "operator", "is_active");
CREATE INDEX "idx_permissions_query" ON "inventorypermissions" ("operator", "data_source", "warehouse_location", "is_active", "effective_date");

CREATE INDEX "idx_operator_rules" ON "operatorpermissionrules" ("operator", "rule_type", "is_active");
CREATE INDEX "idx_rule_priority" ON "operatorpermissionrules" ("priority", "is_primary");

CREATE INDEX "idx_warehouse_mapping" ON "warehouseoperatormapping" ("warehouse_location", "operator", "is_active");
CREATE INDEX "idx_hierarchy_mapping" ON "warehouseoperatormapping" ("primary_operator", "hierarchy_level");

-- 创建唯一约束
CREATE UNIQUE INDEX "unique_operator_permission_rule" ON "inventorypermissions" (
    "operator", 
    "data_source", 
    "warehouse_location", 
    "asin", 
    "sales_person"
);

CREATE UNIQUE INDEX "unique_operator_rule" ON "operatorpermissionrules" (
    "operator", 
    "rule_name", 
    "is_active"
);

CREATE UNIQUE INDEX "unique_warehouse_operator" ON "warehouseoperatormapping" (
    "warehouse_location", 
    "operator"
);

-- 更新权限字段
ALTER TABLE "inventorypermissions" 
    ADD CONSTRAINT "unique_operator_data_access" UNIQUE (
        "operator", "data_source", "warehouse_location", "asin", "sales_person"
    );

-- 创建触发器更新时间戳
CREATE OR REPLACE FUNCTION update_inventory_permissions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_permissions_timestamp 
    BEFORE UPDATE ON "inventorypermissions" 
    FOR EACH ROW EXECUTE FUNCTION update_inventory_permissions_timestamp();

CREATE OR REPLACE FUNCTION update_operator_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_operator_rules_timestamp 
    BEFORE UPDATE ON "operatorpermissionrules" 
    FOR EACH ROW EXECUTE FUNCTION update_operator_rules_timestamp();

CREATE OR REPLACE FUNCTION update_warehouse_mapping_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_warehouse_mapping_timestamp 
    BEFORE UPDATE ON "warehouseoperatormapping" 
    FOR EACH ROW EXECUTE FUNCTION update_warehouse_mapping_timestamp();

-- 插入系统默认权限配置
INSERT INTO operatorpermissionrules (
    operator, rule_name, rule_type, rule_config, created_by, description
) VALUES 
    ('admin', 'all_access', 'custom', '{"can_view_all": true, "data_access": "full", "exceptions": []}', 'system', '管理员完全访问权限'),
    ('system', 'all_access', 'custom', '{"can_view_all": true, "data_access": "full", "exceptions": []}', 'system', '系统完全访问权限'),
    ('default', 'filter_by_operator', 'filter_by_operator', '{"mode": "only_own", "include_team": false}', 'system', '默认只能看到operator字段相同的数据');

-- 插入示例权限规则
INSERT INTO inventorypermissions (
    operator, data_access_level, permission_rule, data_source, config_author, description
) VALUES 
    ('zhangsan', 'filter_by_operator', '{"strict_mode": true, "allow_same_team": false}', 'inventory_deals', 'system', '张三只能看到自己的数据'),
    ('sales_team', 'team_view', '{"team_members": ["lisi", "wangwu", "zhangsan"], "hierarchy": true}', 'inventory_deals', 'system', '销售团队成员可以互相查看数据'),
    ('manager', 'custom', '{"view_own": true, "view_team": true, "view_subordinates": true, "mask_external": true}', 'inventory_deals', 'system', '经理可以查看团队成员和部分脱敏数据');

-- 创建视图：操作员权限汇总
CREATE OR REPLACE VIEW operator_permissions_summary AS
SELECT 
    p.operator,
    p.data_source,
    p.data_access_level,
    COUNT(*) as permission_count,
    STRING_AGG(
        CASE 
            WHEN p.warehouse_location IS NOT NULL THEN p.warehouse_location 
            WHEN p.asin IS NOT NULL THEN p.asin
            WHEN p.sales_person IS NOT NULL THEN p.sales_person
            ELSE 'all'
        END, ', '
    ) as configured_dimensions
FROM inventorypermissions p
WHERE p.is_active = true
  AND (p.expiry_date IS NULL OR p.expiry_date > CURRENT_DATE)
GROUP BY p.operator, p.data_source, p.data_access_level;

-- 创建视图：当前活跃权限
CREATE OR REPLACE VIEW current_active_permissions AS
SELECT 
    p.*,
    CASE 
        WHEN p.data_access_level = 'filter_by_operator' THEN '仅查看相同operator'
        WHEN p.data_access_level = 'all' THEN '查看所有数据'
        WHEN p.data_access_level = 'team_view' THEN '查看团队成员数据'
        WHEN p.data_access_level = 'custom' THEN '自定义权限'
        ELSE p.data_access_level
    END AS display_level_description
FROM inventorypermissions p
WHERE p.is_active = true 
  AND (p.expiry_date IS NULL OR p.expiry_date > CURRENT_DATE);

-- 记录创建信息
COMMENT ON TABLE inventorypermissions IS '基于operator字段的动态权限管理表';
COMMENT ON TABLE operatorpermissionrules IS '操作员权限规则配置表';
COMMENT ON TABLE warehouseoperatormapping IS '仓库操作员映射关系表';