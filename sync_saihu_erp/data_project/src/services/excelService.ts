import * as XLSX from 'xlsx';
import { ProductData } from '@/types/product';

// 首先定义一个字符串字段的联合类型
type StringFieldKey = 
  | 'ASIN'
  | 'SKU'
  | 'STORE'
  | 'MARKETPLACE'
  | 'CATEGORY'
  | 'SALES_PERSON'
  | 'PRODUCT_NAME'
  | 'PRODUCT_TAG';

// 修改 DEFAULT_VALUES 的类型定义
const DEFAULT_VALUES = {
  STRING: {
    ASIN: '空',
    SKU: '空',
    STORE: '未知店铺',
    MARKETPLACE: '未知站点',
    CATEGORY: '未分类',
    SALES_PERSON: '未知业务员',
    PRODUCT_NAME: '未知商品',
    PRODUCT_TAG: '无标签'
  },
  NUMBER: 0
} as const;

// 修改验证函数，添加类型检查
function validateString(value: any): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  // 检查是否是有效的字段键
  if (typeof value === 'string' && value in DEFAULT_VALUES.STRING) {
    return DEFAULT_VALUES.STRING[value as StringFieldKey];
  }
  // 默认返回 PRODUCT_NAME 的默认值
  return DEFAULT_VALUES.STRING['PRODUCT_NAME'];
}

// 验证并处理缺失的数字数据的辅助函数
function validateNumber(value: any): number {
  const numberValue = Number(value);
  if (!isNaN(numberValue) && numberValue !== null) {
    return numberValue;
  }
  return DEFAULT_VALUES.NUMBER;
}

// 格式化销售金额
function formatAmount(value: any): string {
  if (value != null) {
    return `US$${parseFloat(String(value).replace(/[^0-9.-]+/g, '')).toFixed(2)}`;
  }
  return 'US$0.00';
}

// 格式化百分比
function formatPercentage(value: any): string {
  if (value != null) {
    return `${parseFloat(String(value).replace(/[^0-9.-]+/g, '')).toFixed(2)}%`;
  }
  return '0.00 %';
}

/**
 * 解析并验证 Excel 文件的主函数
 */
export async function parseExcelFile(file: File): Promise<ProductData[]> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // 将工作表数据转换为 JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: true,
      defval: null,
    });

    // 对每一行数据进行处理，并返回标准化后的 ProductData 数组
    const products = data.map((row: any, index: number) => { // 添加 index 用于日志
      const product: ProductData = {
        // 处理缺失或空字段并提供默认值
        asin: validateString(row['ASIN']),
        sku: validateString(row['SKU']),
        productName: validateString(row['品名']),
        store: validateString(row['店铺']),
        marketplace: validateString(row['站点']),
        category: validateString(row['分类']),
        salesPerson: validateString(row['业务员']),
        productTag: validateString(row['产品标签']),

        // 处理数值字段，若无效则使用默认值
        sales7Days: validateNumber(row['7天销量']),
        totalSales: validateNumber(row['销量']),
        averageSales: validateNumber(row['平均销量']),
        orderCount: validateNumber(row['订单量']),
        promotionalOrders: validateNumber(row['促销订单量']),
        adImpressions: validateNumber(row['广告曝光量']),
        adClicks: validateNumber(row['广告点击量']),
        adSpend: validateNumber(row['广告花费']),
        adSales: validateNumber(row['广告销量']),
        adOrderCount: validateNumber(row['广告订单量']),
        salesAmount: formatAmount(row['销售额']),
        netSales: formatAmount(row['净销售额']),
        averagePrice: formatAmount(row['平均售价']),
        refundRate: formatPercentage(row['退款率']),

        // 处理 FBA 相关数值字段
        fbaSellable: validateNumber(row['FBA可售']),
        inboundShipped: validateNumber(row['入库已发货']),
        fbaUnsellable: validateNumber(row['FBA不可售']),
        fbaAvailable: validateNumber(row['FBA可用']),
        fbaInbound: validateNumber(row['FBA在途']),
        localAvailable: validateNumber(row['本地仓可用']),
        fbaSellableDays: validateNumber(row['FBA可售天数']),

        // 保留原有的中文字段用于参考
        站点: validateString(row['站点']),
        品名: validateString(row['品名']),
        店铺: validateString(row['店铺']),
        分类: validateString(row['分类']),
        业务员: validateString(row['业务员']),
        产品标签: validateString(row['产品标签'])
      };

      // 只打印前几个产品的数据以避免控制台信息过多
      if (index < 3) { // 比如打印前3条记录
        console.log(`Parsed ProductData (index ${index}):`, {
          asin: product.asin,
          adImpressions: product.adImpressions,
          adClicks: product.adClicks,
          adSpend: product.adSpend,
          adSales: product.adSales,
          adOrderCount: product.adOrderCount,
        });
      }

      return product;
    });
    console.log('Total products parsed:', products.length); // 打印总解析数量
    return products; // 返回 products 而不是 data.map(...)

  } catch (error) {
    console.error('Excel 解析错误:', error);
    throw new Error('Excel 文件解析失败');
  }
}