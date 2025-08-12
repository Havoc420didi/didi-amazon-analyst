-- Migration: 0006_add_inventory_permissions.sql
-- Description: 添加库存点权限管理系统

-- 创建库存点权限表
CREATE TABLE "inventorypoints_right" (
    "id" SERIAL PRIMARY KEY,
    "operator_name" VARCHAR(100) NOT NULL,
    "operator_uuid" VARCHAR(255) NOT NULL,
    "warehouse_location" VARCHAR(50) NOT NULL,
    "warehouse_name" VARCHAR(100),
    "asin" VARCHAR(20),
    "product_name" VARCHAR(500),
    "product_name_masked" VARCHAR(500),
    "access_level" VARCHAR(20) NOT NULL DEFAULT 'full',
    "view_sensitivity_data" BOOLEAN NOT NULL DEFAULT FALSE,
    "sales_person" VARCHAR(100),
    "effective_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "expiry_date" DATE,
    "granted_by" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "remarks" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建操作员可见性视图配置表
CREATE TABLE "operator_visibility" (
    "id" SERIAL PRIMARY KEY,
    "operator_uuid" VARCHAR(255) NOT NULL,
    "operator_name" VARCHAR(100) NOT NULL,
    "visible_warehouses" TEXT NOT NULL,
    "visible_sales_persons" TEXT NOT NULL,
    "visible_asins" TEXT,
    "masking_rules" TEXT,
    "skip_masking_for_assigned" BOOLEAN NOT NULL DEFAULT TRUE,
    "default_access_level" VARCHAR(20) NOT NULL DEFAULT 'full',
    "last_updated" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_by" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引优化查询性能
CREATE INDEX "idx_inventory_rights_operator" 
    ON "inventorypoints_right" ("operator_uuid", "operator_name");

CREATE INDEX "idx_inventory_rights_warehouse" 
    ON "inventorypoints_right" ("warehouse_location", "is_active");

CREATE INDEX "idx_inventory_rights_asin" 
    ON "inventorypoints_right" ("asin", "operator_uuid");

CREATE INDEX "idx_inventory_rights_access" 
    ON "inventorypoints_right" ("operator_uuid", "warehouse_location", "is_active", "effective_date");

CREATE INDEX "idx_inventory_rights_sales_person" 
    ON "inventorypoints_right" ("sales_person", "operator_uuid");

CREATE INDEX "idx_visibility_operator" 
    ON "operator_visibility" ("operator_uuid");

-- 创建唯一约束
CREATE UNIQUE INDEX "unique_operator_warehouse_asin" 
    ON "inventorypoints_right" ("operator_uuid", "warehouse_location", "asin")
    WHERE "asin" IS NOT NULL;

CREATE UNIQUE INDEX "unique_operator_visibility" 
    ON "operator_visibility" ("operator_uuid");

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_inventorypoints_right_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventorypoints_right_timestamp 
    BEFORE UPDATE ON "inventorypoints_right" 
    FOR EACH ROW EXECUTE FUNCTION update_inventorypoints_right_timestamp();

CREATE OR REPLACE FUNCTION update_operator_visibility_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_operator_visibility_timestamp 
    BEFORE UPDATE ON "operator_visibility" 
    FOR EACH ROW EXECUTE FUNCTION update_operator_visibility_timestamp();

-- 添加外键约束（可选 - 取决于是否需要严格的数据一致性）
ALTER TABLE "inventorypoints_right" 
    ADD CONSTRAINT "fk_inventory_rights_users" 
    FOREIGN KEY ("operator_uuid") REFERENCES "users"("uuid")
    ON DELETE CASCADE;

-- 插入默认权限配置示例（所有用户可访问所有仓库的基础权限）
INSERT INTO "operator_visibility" (
    operator_uuid, 
    operator_name, 
    visible_warehouses, 
    visible_sales_persons,
    default_access_level
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    '[]',
    '[]',
    'full'
);

-- 说明注释
COMMENT ON TABLE "inventorypoints_right" IS '库存点权限表 - 控制操作员对库存数据的访问权限';
COMMENT ON TABLE "operator_visibility" IS '操作员数据可见性配置表 - 集中管理用户的可见性范围和脱敏规则';