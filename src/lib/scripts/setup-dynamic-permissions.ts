/**
 * 动态operator权限系统设置脚本
 * 基于数据库表的operator字段进行权限配置
 */

import { db } from '@/db/config';
import { inventorypermissions, operatorpermissionrules, warehouseoperatormapping } from '@/db/schema';
import { configureOperatorPermission } from '@/lib/auth/dynamic-operator-permission';

/**
 * 检查并创建管理员权限
 */
async function setupAdminPermissions() {
  const admin_permissions = [
    {
      operator: 'admin',
      rule_type: 'custom',
      rule_config: {
        can_view_all: true,
        can_view_delegated: true,
        can_view_team: true,
        no_restriction: true
      },
      description: '管理员完全权限'
    }
  ];

  for (const config of admin_permissions) {
    await configureOperatorPermission('admin', {
      rule_type: config.rule_type,
      rule_config: config.rule_config,
      created_by: 'system'
    });
  }
}

/**
 * 创建基于销售团队的权限结构
 */
async function setupSalesTeamPermissions() {
  const sales_team_members = [
    'sales_user1', 'sales_user2', 'sales_user3',
    'manager1', 'manager2', 'lead_user'
  ];

  const team_permissions = [
    {
      operator: 'sales_user1',
      rule_type: 'filter_by_operator',
      rule_config: {
        mode: 'only_own',
        view_other_by_condition: ['same_team', 'same_region'],
        allow_aggregate: true
      },
      masking_config: {
        product_name: { type: 'truncate', visible_length: 8 },
        sales_amount: { type: 'range', approximate: true }
      },
      description: '销售用户1 - 只能看自己的数据'
    },
    {
      operator: 'team_lead',
      rule_type: 'team_view',
      rule_config: {
        team_members: ['sales_user1', 'sales_user2', 'sales_user3'],
        view_subordinates: true,
        view_analytics: true,
        exclude_masking: ['ranking', 'comparison']
      },
      masking_config: {
        sales_person: { type: 'none' }, // 团队成员间可见姓名
        warehouse_location: { type: 'none' }
      },
      description: '团队负责人 - 可看团队成员数据'
    }
  ];

  for (const config of team_permissions) {
    if (sales_team_members.includes(config.operator) || config.operator === 'team_lead') {
      await configureOperatorPermission(config.operator, {
        rule_type: config.rule_type,
        rule_config: config.rule_config,
        masking_config: config.masking_config,
        created_by: 'system'
      });
    }
  }
}

/**
 * 创建基于仓库的权限映射
 */
async function setupWarehouseBasedPermissions() {
  const warehouse_operators = [
    { warehouse: 'US-USA', operators: ['us_manager', 'us_sales1', 'us_sales2'] },
    { warehouse: 'EU-DE', operators: ['eu_manager', 'eu_sales1', 'eu_sales2'] },
    { warehouse: 'CN-CN', operators: ['cn_manager', 'cn_sales1', 'cn_sales2'] }
  ];

  for (const warehouse_config of warehouse_operators) {
    for (const operator of warehouse_config.operators) {
      await configureOperatorPermission(operator, {
        rule_type: 'custom',
        rule_config: {
          warehouse_scope: [warehouse_config.warehouse],
          view_all_in_warehouse: true,
          cross_warehouse_access: false
        },
        warehouse_location: warehouse_config.warehouse,
        created_by: 'system'
      });
    }
  }
}

/**
 * 创建委派模式权限
 */
async function setupDelegatedPermissions() {
  const delegated_configs = [
    {
      operator: 'delegated_viewer',
      rule_type: 'custom',
      rule_config: {
        delegated_operators: ['sales_user1', 'sales_user2', 'sales_user3'],
        view_mode: 'readonly',
        no_modification: true
      },
      description: '委派查看者 - 只可查看委派的数据'
    },
    {
      operator: 'delegate_admin',
      rule_type: 'custom',
      rule_config: {
        can_assign_permissions: true,
        can_create_delegations: true,
        can_view_all: true
      },
      description: '权限管理员 - 可管理委派权限'
    }
  ];

  for (const config of delegated_configs) {
    await configureOperatorPermission(config.operator, {
      rule_type: config.rule_type,
      rule_config: config.rule_config,
      created_by: 'system'
    });
  }
}

/**
 * 插入示例数据权限配置
 */
async function setupExampleConfigurations() {
  const example_configs = [
    {
      operator: 'zhangsan',
      rule_type: 'filter_by_operator',
      warehouse_location: 'US-USA',
      rule_config: {
        mode: 'only_own_with_exceptions',
        exceptions: ['manager_view'],
        include_aggregates: true
      },
      masking_config: {
        product_name: { type: 'truncate', visible_length: 5 },
        total_sales_amount: { type: 'range', range_config: {
          ranges: [
            { min: 0, max: 1000, label: '低销量' },
            { min: 1000, max: 10000, label: '中销量' },
            { min: 10000, max: Infinity, label: '高销量' }
          ]
        }}
      }
    },
    {
      operator: 'lisi',
      rule_type: 'team_view',
      rule_config: {
        team_filter: 'warehouse=EU-DE',
        team_members: ['lisi', 'wanger', 'mazhi'],
        hierarchy_level: 2
      },
      description: '李思 - 欧洲团队经理'
    },
    {
      operator: 'wanger',
      rule_type: 'custom',
      rule_config: {
        data_filter: "sales_person IN ('wanger', 'mazhi') OR warehouse_location = 'CN-CN'",
        special_access: ['cross_region_comparison', 'trend_analysis']
      },
      description: '王二 - 跨区域分析用户'
    }
  ];

  for (const config of example_configs) {
    await configureOperatorPermission(config.operator, {
      rule_type: config.rule_type,
      rule_config: config.rule_config,
      warehouse_location: config.warehouse_location,
      masking_config: config.masking_config,
      created_by: 'system'
    });
  }
}

/**
 * 创建映射关系
 */
async function setupWarehouseMappings() {
  const mappings = [
    {
      warehouse: 'US-USA',
      operator: 'us_manager',
      primary_operator: 'us_manager',
      secondary_operators: JSON.stringify(['us_sales1', 'us_sales2', 'us_sales3']),
      hierarchy_level: 1,
      inherit_permissions: true
    },
    {
      warehouse: 'EU-DE',
      operator: 'eu_manager',
      primary_operator: 'eu_manager',
      secondary_operators: JSON.stringify(['eu_sales1', 'eu_sales2']),
      hierarchy_level: 1,
      inherit_permissions: true
    }
  ];

  for (const mapping of mappings) {
    await db.insert(warehouseoperatormapping).values({
      warehouse_location: mapping.warehouse,
      operator: mapping.operator,
      primary_operator: mapping.primary_operator,
      secondary_operators: mapping.secondary_operators,
      hierarchy_level: mapping.hierarchy_level,
      inherit_permissions: mapping.inherit_permissions
    });
  }
}

/**
 * 主设置函数
 */
export async function setupDynamicOperatorPermissions() {
  console.log('🚀 开始设置基于operator的动态权限系统...\n');

  const steps = [
    { name: '管理员权限', func: setupAdminPermissions },
    { name: '销售团队权限', func: setupSalesTeamPermissions },
    { name: '仓库权限映射', func: setupWarehouseBasedPermissions },
    { name: '委派权限配置', func: setupDelegatedPermissions },
    { name: '示例权限配置', func: setupExampleConfigurations },
    { name: '仓库映射关系', func: setupWarehouseMappings }
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

  console.log('🎉 动态权限系统设置完成！');

  // 验证设置结果
  await validateSetup();
}

/**
 * 验证设置结果
 */
async function validateSetup() {
  console.log('🔍 验证权限配置...');

  const validation_queries = [
    "SELECT COUNT(*) as total_permissions FROM inventorypermissions",
    "SELECT COUNT(*) as total_rules FROM operatorpermissionrules",
    "SELECT COUNT(*) as total_mappings FROM warehouseoperatormapping",
    "SELECT operator, data_access_level, COUNT(*) FROM inventorypermissions GROUP BY operator, data_access_level"
  ];

  for (const query of validation_queries) {
    try {
      const result = await db.execute({ sql: query as any });
      console.log('✅', query, '->', result);
    } catch (error) {
      console.error('❌ 验证失败:', query, error);
    }
  }
}

/**
 * 查询当前权限配置
 */
export async function getCurrentPermissionConfiguration() {
  const [permissions_count] = await db.execute({ sql: 'SELECT COUNT(*) as count FROM inventorypermissions WHERE is_active = true' });
  const [rules_count] = await db.execute({ sql: 'SELECT COUNT(*) as count FROM operatorpermissionrules WHERE is_active = true' });
  const [mapping_count] = await db.execute({ sql: 'SELECT COUNT(*) as count FROM warehouseoperatormapping WHERE is_active = true' });
  
  const permission_types = await db.execute({ sql: 'SELECT data_access_level, COUNT(*) FROM inventorypermissions WHERE is_active = true GROUP BY data_access_level' });
  
  return {
    permissions: permissions_count,
    rules: rules_count,
    mappings: mapping_count,
    permission_types: permission_types
  };
}

// CLI执行
if (require.main === module) {
  const command = process.argv[2] || 'setup';
  
  switch (command) {
    case 'setup':
      setupDynamicOperatorPermissions().then(() => {
        getCurrentPermissionConfiguration().then(config => {
          console.log('当前配置:', config);
        });
      });
      break;
      
    case 'clear':
      console.log('正在清理权限数据...');
      // 可选的清理逻辑
      break;
      
    case 'query':
      getCurrentPermissionConfiguration().then(config => {
        console.log('当前配置:', config);
      });
      break;
      
    default:
      console.log(`
使用方法：
npx ts-node src/lib/scripts/setup-dynamic-permissions.ts [command]

命令：
- setup:     设置全部权限配置
- clear:     清理现有权限
- query:     查询当前配置
- help:      显示帮助
`);
      break;
  }
}