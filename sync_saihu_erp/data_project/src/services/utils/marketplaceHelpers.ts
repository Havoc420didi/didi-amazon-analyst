// 站点和地区相关处理函数
import { ProductData } from '@/types/product';
import { EU_MARKETPLACES } from './constants';

/**
 * 获取标准化的站点名称
 */
export function getNormalizedMarketplace(product: ProductData): string {
  // 直接使用站点字段
  return product.站点 || '未知站点';
}

/**
 * 获取店铺前缀
 * 从店铺名称中提取前缀，用于欧盟地区合并
 */
export function getStorePrefix(store: string): string {
  // 假设店铺前缀格式为：前缀-xx或前缀_xx，取第一个连字符前的内容
  const match = store.match(/^([^-_]+)[-_]/);
  return match ? match[1] : store;
}

/**
 * 判断是否为欧盟地区
 */
export function isEUMarketplace(marketplace: string): boolean {
  // 如果直接使用欧盟国家集合中的值
  if (EU_MARKETPLACES.has(marketplace)) {
    return true;
  }
  
  // 如果marketplace是二字母国家代码，需要转换
  // 一些常见的欧盟国家代码判断
  const euCountryCodes = [
    'FR', 'DE', 'IT', 'ES', 'NL', 'PL', 'SE', 
    'BE', 'PT', 'AT', 'DK', 'FI', 'IE', 'LU',
    'GR', 'CZ', 'RO', 'BG', 'HR', 'SI', 'SK', 
    'HU', 'MT', 'CY', 'EE', 'LV', 'LT'
  ];
  
  return euCountryCodes.includes(marketplace);
}

/**
 * 生成库存点名称
 */
export function formatInventoryPointName(product: ProductData): string {
  if (isEUMarketplace(product.marketplace)) {
    // 欧盟地区显示为"欧盟-店铺前缀"格式
    const storePrefix = getStorePrefix(product.store);
    return `欧盟-${storePrefix}`;
  } else {
    // 非欧盟地区直接显示国家/站点名称
    return product.marketplace;
  }
}
