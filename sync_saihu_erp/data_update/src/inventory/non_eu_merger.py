"""
非欧盟地区库存合并器

实现非欧盟地区（CA、US、UK、AU等）的库存合并逻辑：
- 识别同一ASIN在同一个国家的不同店名前缀下的库存和销量
- 将这些店铺的销量和库存进行加总
"""

import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class NonEUMerger:
    """非欧盟地区库存合并器"""
    
    def __init__(self):
        """初始化非欧盟合并器"""
        self.logger = logger
    
    def merge(self, non_eu_products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        合并非欧盟地区库存数据
        
        Args:
            non_eu_products: 非欧盟地区产品数据列表
            
        Returns:
            合并后的非欧盟库存点数据列表
        """
        if not non_eu_products:
            self.logger.warning("非欧盟产品列表为空")
            return []
        
        try:
            self.logger.debug(f"开始非欧盟地区合并，产品数量: {len(non_eu_products)}")
            
            # 按国家和ASIN分组
            country_groups = self._group_by_country_and_asin(non_eu_products)
            self.logger.debug(f"国家-ASIN分组数量: {len(country_groups)}")
            
            merged_points = []
            
            # 处理每个国家-ASIN分组
            for group_key, products in country_groups.items():
                try:
                    merged_point = self._merge_country_products(products, group_key)
                    if merged_point:
                        merged_points.append(merged_point)
                        
                except Exception as e:
                    self.logger.error(f"国家分组 {group_key} 合并失败: {e}")
                    continue
            
            self.logger.debug(f"非欧盟地区合并完成，合并后数量: {len(merged_points)}")
            return merged_points
            
        except Exception as e:
            self.logger.error(f"非欧盟地区合并异常: {e}")
            raise
    
    def _group_by_country_and_asin(self, products: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """按国家和ASIN分组产品"""
        groups = {}
        
        for product in products:
            try:
                # 修复：从store字段提取国家，而不是marketplace字段
                country = self._extract_country_from_store(product.get('store', ''))
                asin = product.get('asin', '')
                
                if not country or not asin:
                    self.logger.warning(f"无法提取国家或ASIN: {product}")
                    continue
                
                # 使用 "国家-ASIN" 作为分组键
                group_key = f"{country}-{asin}"
                
                if group_key not in groups:
                    groups[group_key] = []
                groups[group_key].append(product)
                
            except Exception as e:
                self.logger.warning(f"产品分组失败: {e}")
                continue
        
        return groups
    
    def _extract_country_from_store(self, store_name: str) -> str:
        """
        从店铺名称提取国家代码
        
        例如: "03 ZipCozy-UK" -> "UK"
              "01VivaJoy-CA" -> "CA"
        """
        if not store_name:
            return ''
        
        # 店铺名称格式: "03 ZipCozy-UK" 或 "ZipCozy-UK"
        if '-' in store_name:
            return store_name.split('-')[-1].strip().upper()
        
        return ''
    
    def _extract_country_from_marketplace(self, marketplace: str) -> str:
        """从marketplace提取国家代码"""
        if not marketplace:
            return ''
        
        # 标准化marketplace名称
        marketplace = marketplace.strip().upper()
        
        # 直接映射常见的marketplace名称
        country_mapping = {
            'US': 'US',
            'UK': 'UK', 
            'CA': 'CA',
            'AU': 'AU',
            'JP': 'JP',
            'MX': 'MX',
            'BR': 'BR',
            'IN': 'IN',
            'SG': 'SG',
            'AE': 'AE',
            'SA': 'SA',
            'EG': 'EG',
            'TR': 'TR',
            'PL': 'PL',
            'SE': 'SE',
            'BE': 'BE',
            'NL': 'NL'
        }
        
        return country_mapping.get(marketplace, marketplace)
    
    def _merge_country_products(self, products: List[Dict[str, Any]], group_key: str) -> Dict[str, Any]:
        """
        合并同一国家下的产品数据
        
        Args:
            products: 同一国家-ASIN下的产品列表
            group_key: 分组键 "国家-ASIN"
            
        Returns:
            合并后的库存点数据
        """
        if not products:
            return None
        
        try:
            # 使用第一个产品作为基础模板
            base_product = products[0]
            country, asin = group_key.split('-', 1)
            
            # 基础信息
            merged_data = {
                'asin': asin,
                'product_name': base_product.get('product_name', ''),
                'sku': base_product.get('sku', ''),
                'category': base_product.get('category', ''),
                'sales_person': base_product.get('sales_person', ''),
                'product_tag': base_product.get('product_tag', ''),
                'dev_name': base_product.get('dev_name', ''),  # 新增dev_name字段
                'marketplace': country,
                'store': self._get_merged_store_name(products, country),
                
                # 价格信息使用第一个产品的信息
                'average_price': base_product.get('average_price', ''),
                'sales_amount': base_product.get('sales_amount', ''),
                'net_sales': base_product.get('net_sales', ''),
                'refund_rate': base_product.get('refund_rate', ''),
            }
            
            # 合并库存数据（累加）
            merged_data.update({
                'fba_available': sum(p.get('fba_available', 0) or 0 for p in products),
                'fba_inbound': sum(p.get('fba_inbound', 0) or 0 for p in products),
                'fba_sellable': sum(p.get('fba_sellable', 0) or 0 for p in products),
                'fba_unsellable': sum(p.get('fba_unsellable', 0) or 0 for p in products),
                'inbound_shipped': sum(p.get('inbound_shipped', 0) or 0 for p in products),
                'local_available': sum(p.get('local_available', 0) or 0 for p in products),
            })
            
            # 合并销售数据（累加）
            merged_data.update({
                'sales_7days': sum(p.get('sales_7days', 0) or 0 for p in products),
                'total_sales': sum(p.get('total_sales', 0) or 0 for p in products),
                'average_sales': sum(p.get('average_sales', 0) or 0 for p in products),
                'order_count': sum(p.get('order_count', 0) or 0 for p in products),
                'promotional_orders': sum(p.get('promotional_orders', 0) or 0 for p in products),
            })
            
            # 合并广告数据（累加）
            merged_data.update({
                'ad_impressions': sum(p.get('ad_impressions', 0) or 0 for p in products),
                'ad_clicks': sum(p.get('ad_clicks', 0) or 0 for p in products),
                'ad_spend': sum(p.get('ad_spend', 0) or 0 for p in products),
                'ad_order_count': sum(p.get('ad_order_count', 0) or 0 for p in products),
                'ad_sales': sum(p.get('ad_sales', 0) or 0 for p in products),
            })
            
            # 添加合并元数据
            merged_data.update({
                '_merge_type': 'non_eu_merged',
                '_merged_stores': [p.get('store', '') for p in products],
                '_store_count': len(products),
                '_country': country
            })
            
            # 计算库存点名称
            merged_data['inventory_point_name'] = self._format_inventory_point_name(merged_data)
            
            self.logger.debug(f"非欧盟合并完成: {group_key} - {len(products)}个店铺")
            
            return merged_data
            
        except Exception as e:
            self.logger.error(f"合并国家产品失败: {e}")
            return None
    
    def _get_merged_store_name(self, products: List[Dict[str, Any]], country: str) -> str:
        """获取合并后的店铺名称"""
        if len(products) == 1:
            return products[0].get('store', '')
        
        # 提取所有店铺前缀
        store_prefixes = set()
        for product in products:
            store_name = product.get('store', '')
            if store_name and '-' in store_name:
                prefix = store_name.split('-')[0].strip()
                if prefix:
                    store_prefixes.add(prefix)
        
        if store_prefixes:
            # 如果有多个店铺前缀，显示为"多店铺汇总"
            if len(store_prefixes) > 1:
                return f"{country}多店铺汇总"
            else:
                # 只有一个店铺前缀，显示该前缀
                return f"{list(store_prefixes)[0]}-{country}"
        
        return f"{country}汇总"
    
    def _format_inventory_point_name(self, merged_data: Dict[str, Any]) -> str:
        """格式化库存点显示名称"""
        asin = merged_data.get('asin', '')
        marketplace = merged_data.get('marketplace', '')
        return f"{asin}-{marketplace}" if asin and marketplace else ''
    
    def get_merge_statistics(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """获取合并统计信息"""
        if not products:
            return {}
        
        country_stats = {}
        
        # 按国家统计
        for product in products:
            # 修复：统一使用store字段提取国家
            country = self._extract_country_from_store(product.get('store', ''))
            if country not in country_stats:
                country_stats[country] = {
                    'product_count': 0,
                    'store_count': 0,
                    'stores': set(),
                    'asins': set()
                }
            
            country_stats[country]['product_count'] += 1
            country_stats[country]['stores'].add(product.get('store', ''))
            country_stats[country]['asins'].add(product.get('asin', ''))
        
        # 转换set为list以便序列化
        for country, stats in country_stats.items():
            stats['stores'] = list(stats['stores'])
            stats['asins'] = list(stats['asins'])
            stats['store_count'] = len(stats['stores'])
        
        return {
            'total_products': len(products),
            'country_count': len(country_stats),
            'country_stats': country_stats
        }