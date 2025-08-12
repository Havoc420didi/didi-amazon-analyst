/**
 * 默认权限配置脚本
 * 运行此脚本设置初始权限配置
 */

import { db } from '@/db/config';
import { inventorypointsRight, operatorVisibility, users } from '@/db/schema';
import { assignPermission, configureOperatorVisibility } from '@/lib/auth/inventory-permission';
import { eq } from 'drizzle-orm';

/**
 * 设置管理员默认权限
 */
async function setupAdminPermissions() {
  const adminUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@example.com'));

  for (const admin of adminUsers) {
    await configureOperatorVisibility({
      operator_uuid: admin.uuid,
      operator_name: admin.username || 'admin',
      visible_warehouses: ['ALL'], // 所有仓库
      visible_sales_persons: ['ALL'], // 所有业务员
      updated_by: 'system'
    });

    // 为管理员分配所有库存点的完整权限
    await assignPermission({
      operator_name: admin.username || 'admin',
      operator_uuid: admin.uuid,
      warehouse_location: 'ALL',
      access_level: 'full',
      view_sensitivity_data: true,
      granted_by: 'system',
      remarks: '管理员默认完整权限'
    });
  }
}

/**
 * 设置业务用户默认权限
 */
async function setupBusinessUserPermissions() {
  const businessUsers = await db
    .select()
    .from(users)
    .where(
      eq(users.email, 'business.user@example.com')
    );

  const commonWarehouses = [
    'US-USA',
    'US-CA', 
    'EU-DE',
    'EU-UK',
    'EU-FR',
    'JP-JPN',
    'CA-CA'
  ];

  for (const user of businessUsers) {
    await configureOperatorVisibility({
      operator_uuid: user.uuid,
      operator_name: user.username || user.email.split('@')[0],
      visible_warehouses: commonWarehouses,
      visible_sales_persons: [], // 默认可见所有人
      default_access_level: 'full',
      masking_rules: {
        product_name: {
          max_visible_length: 15,
          preserve_keywords: ['Apple', 'Amazon', 'Brand']
        },
        asin: {
          visible_prefix: 4,
          mask_char: '*'
        },
        sales_person: {
          show_initial: true,
          full_name: false
        }
      },
      updated_by: 'system'
    });
  }
}

/**
 * 设置受限用户默认权限
 */
async function setupRestrictedUserPermissions() {
  const restrictedUsers = await db
    .select()
    .from(users)
    .where(
      eq(users.email, 'limited.user@example.com')
    );

  for (const user of restrictedUsers) {
    await configureOperatorVisibility({
      operator_uuid: user.uuid,
      operator_name: user.username || user.email.split('@')[0],
      visible_warehouses: ['US-USA', 'US-CA'],
      visible_sales_persons: ['assigned_only'], // 只可见分配给自己的业务员
      default_access_level: 'masked',
      updated_by: 'system'
    });

    // 为受限用户分配特定权限
    await assignPermission({
      operator_name: user.username || user.email.split('@')[0],
      operator_uuid: user.uuid,
      warehouse_location: 'US-USA',
      access_level: 'masked',
      view_sensitivity_data: false,
      granted_by: 'system',
      remarks: '受限用户权限 - 仅可见US和CA仓库'
    });

    await assignPermission({
      operator_name: user.username || user.email.split('@')[0],
      operator_uuid: user.uuid,
      warehouse_location: 'US-CA',
      access_level: 'masked',
      view_sensitivity_data: false,
      granted_by: 'system',
      remarks: '受限用户权限 - 仅可见US和CA仓库'
    });
  }
}

/**
 * 插入示例权限数据
 */
async function insertSamplePermissions() {
  console.log('正在插入示例权限数据...');

  const sampleData = [
    {
      operator_name: 'manager1',
      operator_uuid: 'manager-uuid-123',
      warehouse_location: 'US-USA',
      warehouse_name: '美国仓-美国本土',
      access_level: 'full',
      view_sensitivity_data: true,
      granted_by: 'system',
      remarks: '美国区域经理权限'
    },
    {
      operator_name: 'sales1',
      operator_uuid: 'sales-uuid-456',
      warehouse_location: 'EU-DE',
      warehouse_name: '欧洲仓-德国',
      sales_person: 'alice',
      access_level: 'masked',
      view_sensitivity_data: false,
      granted_by: 'system',
      remarks: '欧洲销售专员权限'
    },
    {
      operator_name: 'analyst1',
      operator_uuid: 'analyst-uuid-789',
      warehouse_location: 'JP-JPN',
      warehouse_name: '日本仓-日本本土',
      asin: 'B09G9FPHYK',
      access_level: 'full',
      view_sensitivity_data: true,
      granted_by: 'system',
      remarks: '特定产品分析权限'
    }
  ];

  for (const data of sampleData) {
    try {
      await assignPermission(data);
      console.log(`✓ 已添加权限: ${data.operator_name} -> ${data.warehouse_location}`);
    } catch (error) {
      console.error(`✗ 添加权限失败:`, data.operator_name, error);
    }
  }
}

/**
 * 设置测试数据权限
 */
async function setupTestPermissions() {
  console.log('正在设置测试权限...');

  await insertSamplePermissions();

  // 创建测试可见性配置
  const testVisibilityConfigs = [
    {
      operator_uuid: 'test-manager-uuid',
      operator_name: 'test-manager',
      visible_warehouses: ['US-USA', 'EU-DE', 'UK-GB'],
      visible_sales_persons: ['sales1', 'sales2', 'sales3'],
      masking_rules: {
        product_name: { max_visible_length: 12, suffix_replacement: '...' },
        sales_amount: { show_approximate: true }
      },
      updated_by: 'system-test'
    }
  ];

  for (const config of testVisibilityConfigs) {
    try {
      await configureOperatorVisibility(config);
      console.log(`✓ 已配置可见性: ${config.operator_name}`);
    } catch (error) {
      console.error(`✗ 配置可见性失败:`, config.operator_name, error);
    }
  }
}

/**
 * 验证权限设置
 */
async function validatePermissions() {
  console.log('正在验证权限设置...');

  const validationQueries = [
    "SELECT COUNT(*) as permission_count FROM inventorypoints_right",
    "SELECT COUNT(*) as visibility_count FROM operator_visibility",
    "SELECT operator_name, warehouse_location, access_level FROM inventorypoints_right LIMIT 5",
    "SELECT operator_uuid, default_access_level FROM operator_visibility LIMIT 3"
  ];

  for (const query of validationQueries) {
    try {
      const result = await db.execute({ sql: query as any });
      console.log(`✓ 验证查询: ${query}`, result);
    } catch (error) {
      console.error(`✗ 验证查询失败: ${query}`, error);
    }
  }
}

/**
 * 主函数：运行所有设置
 */
export async function setupDefaultPermissions() {
  console.log('🚀 开始设置库存点权限系统...\n');

  const steps = [
    { name: '管理员权限', func: setupAdminPermissions },
    { name: '业务用户权限', func: setupBusinessUserPermissions },
    { name: '受限用户权限', func: setupRestrictedUserPermissions },
    { name: '示例权限数据', func: insertSamplePermissions },
    { name: '测试权限配置', func: setupTestPermissions },
    { name: '权限验证', func: validatePermissions }
  ];

  for (const step of steps) {
    console.log(`⏳ 正在执行: ${step.name}`);
    try {
      await step.func();
      console.log(`✅ ${step.name} 完成\n`);
    } catch (error) {
      console.error(`❌ ${step.name} 失败:`, error, '\n');
    }
  }

  console.log('🎉 库存点权限系统设置完成！');
}

/**
 * 清理权限数据（用于测试重置）
 */
export async function cleanupPermissions() {
  console.log('🧹 正在清理权限数据...');

  try {
    await db.execute({ sql: 'DELETE FROM inventorypoints_right' });
    await db.execute({ sql: 'DELETE FROM operator_visibility' });
    console.log('✅ 所有权限数据已清理');
  } catch (error) {
    console.error('❌ 清理数据失败:', error);
  }
}

/**
 * 显示帮助信息
 */
export function showUsageInstructions() {
  console.log(`
使用方法：
1. 开发环境: import { setupDefaultPermissions } from '@/lib/scripts/setup-default-permissions';
   await setupDefaultPermissions();

2. CLI执行: npx ts-node src/lib/scripts/setup-default-permissions.ts [command]
   命令: setup | cleanup | test

3. 手动配置：
   - 在数据库中运行 0006_add_inventory_permissions.sql
   - 调用权限管理API进行配置
`);
}

// CLI执行
if (require.main === module) {
  const command = process.argv[2] || 'setup';
  
  switch (command) {
    case 'setup':
      setupDefaultPermissions();
      break;
    case 'cleanup':
      cleanupPermissions();
      break;
    case 'test':
      setupTestPermissions();
      break;
    case 'help':
    default:
      showUsageInstructions();
      break;
  }
}