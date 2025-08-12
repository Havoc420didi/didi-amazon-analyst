/**
 * 基于operator字段的动态脱敏配置
 * 支持多operator模式的个性化脱敏规则
 */

export interface OperatorMaskingConfig {
  global_rules: {
    [operator: string]: {
      fields: { [field: string]: FieldMaskingRule };
      level: 'none' | 'low' | 'medium' | 'high' | 'complete';
      exceptions?: string[]; // 例外的operators
    };
  };
  
  operator_specific: {
    [operator: string]: {
      custom_rules: { [field: string]: FieldMaskingRule };
      whitelist_operators?: string[]; // 可见的operators列表
      blacklist_operators?: string[]; // 不可见的operators列表
    };
  };

  field_mappings: {
    [field: string]: {
      masking_types: string[];
      sensitive_levels: { [operator: string]: number };
    };
  };

  template_rules: {
    'none': FieldMaskingRule;
    'low': FieldMaskingRule;
    'medium': FieldMaskingRule;
    'high': FieldMaskingRule;
    'complete': FieldMaskingRule;
  };
}

export interface FieldMaskingRule {
  type: 'none' | 'truncate' | 'hash' | 'range' | 'pattern' | 'replacement';
  visible_length?: number;
  hash_length?: number;
  range_config?: RangeMaskingConfig;
  pattern?: string;
  replacement?: string;
  preserve_special?: boolean;
}

export interface RangeMaskingConfig {
  ranges: {
    min: number;
    max: number;
    label: string;
  }[];
  approximate: boolean;
}

// 默认模板
const defaultMaskingTemplates: Record<string, FieldMaskingRule> = {
  'none': { type: 'none' },
  
  'low': {
    type: 'truncate',
    visible_length: 5,
    preserve_special: true
  },
  
  'medium': {
    type: 'truncate', 
    visible_length: 3,
    preserve_special: false
  },
  
  'high': {
    type: 'hash',
    hash_length: 8
  },
  
  'complete': {
    type: 'replacement',
    replacement: '[权限受限]'
  }
};

// 动态脱敏配置
export const dynamicOperatorMaskingConfig: OperatorMaskingConfig = {
  global_rules: {
    'admin': {
      fields: {}, // 管理员不使用脱敏
      level: 'none',
      exceptions: []
    },
    'manager': {
      fields: {
        'total_sales_amount': { type: 'range', range_config: {
          ranges: [
            { min: 0, max: 1000, label: '低' },
            { min: 1000, max: 10000, label: '中' },
            { min: 10000, max: Infinity, label: '高' }
          ],
          approximate: true
        }},
        'product_name': { type: 'truncate', visible_length: 10 }
      },
      level: 'low',
      exceptions: ['internal_manager']
    },
    'sales_team': {
      fields: {
        'sales_person': { type: 'none' },
        'warehouse_location': { type: 'none' },
        'total_inventory': { type: 'range', range_config: {
          ranges: [
            { min: 0, max: 100, label: '库存少' },
            { min: 100, max: 1000, label: '库存中' },
            { min: 1000, max: Infinity, label: '库存多' }
          ],
          approximate: true
        }}, 
        'asin': { type: 'pattern', pattern: '^(...)(.*)$', replacement: '$1***' },
        'product_name': { type: 'truncate', visible_length: 8 }
      },
      level: 'medium',
      exceptions: ['team_lead']
    },
    'external_viewer': {
      fields: {
        'total_sales_amount': { type: 'replacement', replacement: '*敏感数据*' },
        'warehouse_location': { type: 'pattern', pattern: '^(.*?)(-.*)$', replacement: '$1-***' },
        'sales_person': { type: 'hash', hash_length: 4 },
        'product_name': { type: 'replacement', replacement: '产品已隐藏' },
        'asin': { type: 'replacement', replacement: 'ASIN已隐藏' }
      },
      level: 'complete',
      exceptions: []
    }
  },

  operator_specific: {
    'zhangsan': {
      custom_rules: {
        'product_name': { type: 'truncate', visible_length: 12 },
        'total_daily_sales': { type: 'none' }
      },
      whitelist_operators: ['zhangsan', 'lisi', 'wangwu'],
      blacklist_operators: ['admin', 'system']
    },
    
    'lisi': {
      custom_rules: {
        'warehouse_location': { type: 'none' },
        'sales_person': { type: 'none', 
          exceptions_when: { operator: 'same_team' }
        }
      },
      whitelist_operators: ['lisi', 'sales_team']
    }
  },

  field_mappings: {
    'product_name': {
      masking_types: ['truncate', 'replacement'],
      sensitive_levels: {
        'admin': 0,
        'manager': 1,
        'sales_team': 2,
        'external_viewer': 3
      }
    },
    'total_sales_amount': {
      masking_types: ['range', 'replacement', 'pattern'],
      sensitive_levels: {
        'admin': 0,
        'manager': 1,
        'sales_team': 2,
        'external_viewer': 3
      }
    },
    'warehouse_location': {
      masking_types: ['truncate', 'pattern'],
      sensitive_levels: {
        'admin': 0,
        'manager': 1,
        'sales_team': 1,
        'external_viewer': 2
      }
    },
    'sales_person': {
      masking_types: ['truncate', 'hash', 'replacement'],
      sensitive_levels: {
        'admin': 0,
        'manager': 0,
        'sales_team': 1,
        'external_viewer': 2
      }
    }
  },

  template_rules: defaultMaskingTemplates
};

/**
 * 获取操作员的脱敏配置
 */
export function getOperatorMaskingConfig(
  requesting_operator: string,
  target_operator: string,
  field_name: string
): FieldMaskingRule {
  
  // 检查操作员特定的规则
  if (dynamicOperatorMaskingConfig.operator_specific[requesting_operator]) {
    const specific_config = dynamicOperatorMaskingConfig.operator_specific[requesting_operator];
    
    // 检查黑名单
    if (specific_config.blacklist_operators?.includes(target_operator)) {
      return { type: 'replacement', replacement: '[无权限查看]' };
    }
    
    // 检查白名单
    if (specific_config.whitelist_operators && 
        !specific_config.whitelist_operators.includes(target_operator)) {
      return { type: 'replacement', replacement: '[权限受限]' };
    }
    
    // 应用特定规则
    if (specific_config.custom_rules && specific_config.custom_rules[field_name]) {
      return specific_config.custom_rules[field_name];
    }
  }
  
  // 检查全局规则
  const global_config = dynamicOperatorMaskingConfig.global_rules[requesting_operator];
  if (global_config && global_config.fields && global_config.fields[field_name]) {
    return global_config.fields[field_name];
  }
  
  // 根据敏感级别选择模板
  const sensitivity_level = getSensitivityLevel(requesting_operator, target_operator, field_name);
  return getTemplateByLevel(sensitivity_level);
}

/**
 * 获取敏感度级别
 */
function getSensitivityLevel(
  requesting_operator: string,
  target_operator: string,
  field_name: string
): string {
  const field_config = dynamicOperatorMaskingConfig.field_mappings[field_name];
  if (!field_config) return 'low';
  
  const level = field_config.sensitive_levels[requesting_operator] || 2;
  const levels = ['none', 'low', 'medium', 'high', 'complete'];
  return levels[Math.min(level, levels.length - 1)];
}

/**
 * 根据级别获取模板
 */
function getTemplateByLevel(level: string): FieldMaskingRule {
  return dynamicOperatorMaskingConfig.template_rules[level] || defaultMaskingTemplates.low;
}

/**
 * 应用动态脱敏到数据
 */
export function applyDynamicMasking(
  data: any,
  requesting_operator: string,
  target_operator: string,
  specific_config?: any
): any {
  let masked_data = { ...data };
  
  const fields_to_mask = Object.keys(dynamicOperatorMaskingConfig.field_mappings);
  
  for (const field of fields_to_mask) {
    if (data[field] !== undefined) {
      const masking_rule = specific_config?.[field] || 
                          getOperatorMaskingConfig(requesting_operator, target_operator, field);
      
      masked_data[field] = applyFieldMaskingRule(data[field], masking_rule, requesting_operator, target_operator);
    }
  }
  
  return masked_data;
}

/**
 * 应用字段级脱敏规则
 */
function applyFieldMaskingRule(
  value: any, 
  rule: FieldMaskingRule, 
  requesting_operator: string,
  target_operator: string
): any {
  if (!value) return value;
  
  switch (rule.type) {
    case 'none':
      return value;
      
    case 'truncate':
      const str_value = String(value);
      return str_value.substring(0, rule.visible_length || 3) + 
             (rule.visible_length && str_value.length > rule.visible_length ? '...' : '');
      
    case 'hash':
      return createOperatorHash(String(value), requesting_operator, rule.hash_length);
      
    case 'range':
      if (rule.range_config && typeof value === 'number') {
        return maskNumericRange(value, rule.range_config);
      }
      return createOperatorHash(String(value), requesting_operator, 4);
      
    case 'pattern':
      if (rule.pattern && rule.replacement) {
        const regex = new RegExp(rule.pattern);
        return String(value).replace(regex, rule.replacement);
      }
      return value;
      
    case 'replacement':
      return rule.replacement || '[数据已脱敏]';
      
    default:
      return value;
  }
}

/**
 * 创建基于操作员的哈希
 */
function createOperatorHash(text: string, operator: string, length: number = 8): string {
  const seed = operator; // 基于操作员生成变化哈希
  let hash = stringToHash(text + seed, length);
  return hash.substring(0, length);
}

/**
 * 简单哈希函数
 */
function stringToHash(text: string, length: number): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & 0xfffffff; // 32bit整数
  }
  
  const hashHex = Math.abs(hash).toString(36);
  return hashHex.padStart(length, '0');
}

/**
 * 数值范围脱敏
 */
function maskNumericRange(value: number, range_config: RangeMaskingConfig): string {
  const ranges = range_config.ranges;
  
  for (const range of ranges) {
    if (value >= range.min && value < range.max) {
      if (range_config.approximate && range.max !== Infinity) {
        return `约${range.label}`;
      }
      return range.label;
    }
  }
  
  return ranges[ranges.length - 1]?.label || "[数值已脱敏]";
}

/**
 * 创建新的脱敏配置模板
 */
export function createDynamicMaskingConfig(
  base_config?: Partial<OperatorMaskingConfig>
): OperatorMaskingConfig {
  return {
    ...dynamicOperatorMaskingConfig,
    ...base_config,
    global_rules: { ...dynamicOperatorMaskingConfig.global_rules, ...base_config?.global_rules },
    operator_specific: { ...dynamicOperatorMaskingConfig.operator_specific, ...base_config?.operator_specific },
    template_rules: { ...dynamicOperatorMaskingConfig.template_rules, ...base_config?.template_rules }
  };
}

/**
 * 验证脱敏配置
 */
export function validateDynamicMasking(config: OperatorMaskingConfig): {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 验证字段映射
  const valid_fields = ['product_name', 'asin', 'sales_person', 'warehouse_location', 'total_inventory', 'total_sales_amount'];
  
  Object.keys(config.field_mappings).forEach(field => {
    if (!valid_fields.includes(field)) {
      warnings.push(`未知的字段: ${field}`);
    }
  });

  // 验证操作员特定配置格式
  Object.entries(config.operator_specific).forEach(([operator, config]) => {
    if (config.custom_rules) {
      Object.entries(config.custom_rules).forEach(([field, rule]) => {
        if (!['none', 'truncate', 'hash', 'range', 'pattern', 'replacement'].includes(rule.type)) {
          errors.push(`操作员${operator}的字段${field}有无效规则类型: ${rule.type}`);
        }
      });
    }
  });

  return {
    is_valid: errors.length === 0,
    errors,
    warnings
  };
}