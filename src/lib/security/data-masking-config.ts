/**
 * 数据脱敏配置和策略
 * 为库存数据提供可配置的脱敏规则
 */

export interface MaskingRule {
  field: string;
  type: 'partial' | 'full' | 'hash' | 'replacement';
  pattern?: RegExp;
  replacement?: string;
  visibleChars: 'none' | 'start' | 'end' | 'both';
  keepLength: boolean;
}

export interface DataMaskingConfig {
  product_name: {
    max_visible_length: number;
    suffix_replacement: string;
    preserve_keywords?: string[];
  };
  asin: {
    visible_prefix: number;
    visible_suffix: number;
    mask_char: string;
  };
  sales_person: {
    show_initial: boolean;
    mask_middle: boolean;
    preserve_length: boolean;
  };
  warehouse: {
    region_mapping: Record<string, string>;
    mask_specific: boolean;
  };
}

export const defaultMaskingConfig: DataMaskingConfig = {
  product_name: {
    max_visible_length: 10,
    suffix_replacement: '***',
    preserve_keywords: ['Amazon', 'Premium', 'Professional', 'Advanced', 'Basic']
  },
  asin: {
    visible_prefix: 3,
    visible_suffix: 2,
    mask_char: '×'
  },
  sales_person: {
    show_initial: true,
    mask_middle: true,
    preserve_length: false
  },
  warehouse: {
    region_mapping: {
      'US-': '美国',
      'CN-': '中国',
      'EU-': '欧洲',
      'JP-': '日本'
    },
    mask_specific: false
  }
};

/**
 * 通用脱敏函数
 */
export function maskText(
  text: string, 
  rule: MaskingRule
): string {
  if (!text || text.length === 0) return '';

  switch (rule.type) {
    case 'partial':
      return applyPartialMasking(text, rule);
    case 'full':
      return rule.replacement || '***';
    case 'hash':
      return createHashMask(text);
    case 'replacement':
      return applyReplacementMask(text, rule);
    default:
      return text;
  }
}

/**
 * 产品名称脱敏
 */
export function maskProductName(productName: string, config = defaultMaskingConfig): string {
  if (!productName || productName.length <= config.product_name.max_visible_length) {
    return productName;
  }

  // 保留关键词
  const keywords = config.product_name.preserve_keywords || [];
  for (const keyword of keywords) {
    if (productName.includes(keyword)) {
      // 保留关键词并脱敏其余部分
      const keywordIndex = productName.indexOf(keyword);
      const before = maskWord(productName.substring(0, keywordIndex), 2);
      const after = maskWord(productName.substring(keywordIndex + keyword.length), 2);
      return before + keyword + after;
    }
  }

  // 标准脱敏：显示前n个字符+***
  const visibleName = productName.substring(0, config.product_name.max_visible_length);
  return `${visibleName}${config.product_name.suffix_replacement}`;
}

/**
 * ASIN脱敏
 */
export function maskAsin(asin: string, config = defaultMaskingConfig.asin): string {
  if (!asin || asin.length !== 10) return '***';

  const prefix = asin.substring(0, config.visible_prefix);
  const suffix = asin.substring(asin.length - config.visible_suffix);
  const maskedLength = asin.length - config.visible_prefix - config.visible_suffix;
  
  return `${prefix}${config.mask_char.repeat(maskedLength)}${suffix}`;
}

/**
 * 销售人员姓名脱敏
 */
export function maskSalesPerson(name: string, config = defaultMaskingConfig.sales_person): string {
  if (!name || name.length <= 1) return name;

  if (name.length === 2) {
    return config.show_initial ? 
      `${name.charAt(0)}*` : 
      `${name.charAt(0)}${'*'.repeat(name.length - 1)}`;
  }

  if (name.length === 3) {
    return `${name.charAt(0)}*${name.charAt(2)}`;
  }

  const visibleCount = Math.max(2, Math.floor(name.length * 0.3));
  const start = name.substring(0, 1);
  const end = name.substring(name.length - 1);
  
  if (config.mask_middle) {
    const maskedLength = visibleCount > 2 ? name.length - 2 : name.length - visibleCount;
    return `${start}${'*'.repeat(maskedLength)}${end}`;
  }
  
  return `${start}${'*'.repeat(name.length - 1)}`;
}

/**
 * 仓库位置脱敏
 */
export function maskWarehouseLocation(
  location: string, 
  config = defaultMaskingConfig.warehouse
): string {
  if (!location) return '***';

  // 替换地区代码为中文
  let masked = location;
  Object.entries(config.region_mapping).forEach(([code, text]) => {
    masked = masked.replace(code, text);
  });

  return masked;
}

/**
 * 销售金额脱敏（根据用户权限级别）
 */
export function maskSalesAmount(
  amount: number, 
  accessLevel: string
): string {
  switch (accessLevel) {
    case 'full':
      return `$${amount.toFixed(2)}`;
    case 'masked':
      // 模糊额度，四舍五入到百位
      const rounded = Math.round(amount / 100) * 100;
      return `$${rounded.toFixed(0)}`;
    case 'restricted':
      // 只显示范围
      if (amount < 1000) return '<$1K';
      else if (amount < 10000) return '$1K-$10K';
      else if (amount < 100000) return '$10K-$100K';
      else return '>$100K';
    default:
      return '***';
  }
}

/**
 * 日期范围脱敏
 */
export function maskDateRange(
  startDate: Date, 
  endDate: Date, 
  accessLevel: string
): { start: string; end: string } {
  if (accessLevel === 'full') {
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  }

  // 季度级别脱敏
  const quarters = [
    'Q1', 'Q2', 'Q3', 'Q4'
  ];
  
  const startQuarter = quarters[Math.floor((startDate.getMonth()) / 3)];
  const endQuarter = quarters[Math.floor((endDate.getMonth()) / 3)];
  
  return {
    start: `${startDate.getFullYear()} ${startQuarter}`,
    end: `${endDate.getFullYear()} ${endQuarter}`
  };
}

// 私有工具函数
function applyPartialMasking(text: string, rule: MaskingRule): string {
  const length = text.length;
  const visibleChars = rule.visibleChars as 'none' | 'start' | 'end' | 'both';
  
  switch (visibleChars) {
    case 'none':
      return rule.mask_char ? 
        rule.mask_char.repeat(rule.keepLength ? length : 3) : 
        '***';
    
    case 'start':
      const endHidden = rule.keepLength ? length - 3 : 3;
      return text.substring(0, 3) + '*'.repeat(Math.max(1, endHidden));
    
    case 'end':
      const startHidden = rule.keepLength ? length - 3 : 3;
      return '*'.repeat(Math.max(1, startHidden)) + text.substring(-3);
    
    case 'both':
      if (length <= 4) return '*'.repeat(length);
      return text.charAt(0) + '*'.repeat(length - 2) + text.charAt(length - 1);
    
    default:
      return text;
  }
}

function applyReplacementMask(text: string, rule: MaskingRule): string {
  if (rule.pattern && rule.replacement) {
    return text.replace(rule.pattern, rule.replacement);
  }
  return rule.replacement || '***';
}

function createHashMask(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const hashHex = Math.abs(hash).toString(16);
  return `hash_${hashHex.substring(0, 6)}`;
}

function maskWord(word: string, keepChars: number): string {
  if (word.length <= keepChars) return '*'.repeat(word.length);
  return word.substring(0, keepChars) + '*'.repeat(word.length - keepChars);
}

/**
 * 字段级权限控制配置
 */
export const fieldPermissionRules = {
  full_access: [],
  
  masked_access: [
    'product_name',
    'sales_person',
    'warehouse_location'
  ] as const,
  
  restricted_access: [
    'total_sales_amount',
    'avg_daily_revenue',
    'total_ad_spend',
    'acos'
  ] as const
};

type FieldName = typeof fieldPermissionRules.masked_access[number] | 
                typeof fieldPermissionRules.restricted_access[number] | 
                'product_name' | 'asin' | 'sales_person';

/**
 * 根据用户权限级别获取可访问的字段
 */
export function getAccessibleFields(
  accessLevel: 'full' | 'masked' | 'restricted'
): string[] {
  const baseFields = [
    'snapshot_date',
    'time_window',
    'total_inventory',
    'fba_available',
    'inventory_status'
  ];

  switch (accessLevel) {
    case 'full':
      return [...baseFields, '*']; // 所有字段
    
    case 'masked':
      return [...baseFields, ...fieldPermissionRules.restricted_access];
    
    case 'restricted':
      return baseFields;
    
    default:
      return baseFields;
  }
}

/**
 * 创建上下文特定的脱敏配置
 */
export function createContextMaskingConfig(
  userRole: string,
  businessUnit?: string,
  securityLevel?: string
): DataMaskingConfig {
  const baseConfig = { ...defaultMaskingConfig };
  
  switch (securityLevel) {
    case 'high':
      return {
        ...baseConfig,
        product_name: {
          ...baseConfig.product_name,
          max_visible_length: 5,
          suffix_replacement: '*****'
        },
        asin: {
          ...baseConfig.asin,
          visible_prefix: 2,
          visible_suffix: 1
        }
      };
    
    case 'medium':
      return baseConfig;
    
    case 'low':
      return {
        ...baseConfig,
        product_name: {
          ...baseConfig.product_name,
          max_visible_length: 15
        },
        sales_person: {
          ...baseConfig.sales_person,
          show_initial: true,
          mask_middle: false
        }
      };
    
    default:
      return baseConfig;
  }
}