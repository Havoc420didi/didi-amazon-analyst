"""
欧盟地区库存合并器

实现欧盟地区复杂的两步合并逻辑：
1. 每个店铺选出FBA可用+FBA在途最大的国家作为代表
2. 将所有店铺代表合并为欧盟库存点
"""

import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class EUMerger:
    """欧盟地区库存合并器"""
    
    def __init__(self):
        """初始化欧盟合并器"""
        self.logger = logger
    
    def merge(self, eu_products: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        合并欧盟地区库存数据
        
        实现两步合并逻辑：
        1. 每个店铺选出FBA可用+FBA在途最大的国家作为代表
        2. 将所有店铺代表合并为欧盟库存点
        
        Args:
            eu_products: 欧盟地区产品数据列表
            
        Returns:
            合并后的欧盟库存点数据，如果无有效数据则返回None
        """
        if not eu_products:
            self.logger.warning("欧盟产品列表为空")
            return None
        
        try:
            self.logger.debug(f"开始欧盟地区合并，产品数量: {len(eu_products)}")
            
            # 第一步：按店铺前缀分组
            store_groups = self._group_by_store_prefix(eu_products)
            self.logger.debug(f"店铺前缀分组数量: {len(store_groups)}")
            
            # 第二步：每个店铺选择最佳库存代表
            store_representatives = []
            for store_prefix, products in store_groups.items():
                representative = self._select_best_inventory_representative(products, store_prefix)
                if representative:
                    store_representatives.append(representative)
            
            self.logger.debug(f"店铺代表数量: {len(store_representatives)}")
            
            # 第三步：合并所有店铺代表
            if store_representatives:
                merged_result = self._merge_store_representatives(store_representatives)
                self.logger.debug("欧盟地区合并完成")
                return merged_result
            
            self.logger.warning("没有有效的店铺代表，合并失败")
            return None
            
        except Exception as e:
            self.logger.error(f"欧盟地区合并异常: {e}")
            raise
    
    def _group_by_store_prefix(self, products: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """按店铺前缀分组"""
        groups = {}
        
        for product in products:
            try:
                store_prefix = self._extract_store_prefix(product['store'])
                if not store_prefix:
                    self.logger.warning(f"无法提取店铺前缀: {product['store']}")
                    continue
                
                if store_prefix not in groups:
                    groups[store_prefix] = []
                groups[store_prefix].append(product)
                
            except Exception as e:
                self.logger.warning(f"店铺分组失败: {e}")
                continue
        
        return groups
    
    def _extract_store_prefix(self, store_name: str) -> str:
        """
        提取店铺前缀
        
        例如: "03 ZipCozy-UK" -> "03 ZipCozy"
        """
        if not store_name:
            return ''
        
        # 按 '-' 分割，取前面部分作为店铺前缀
        if '-' in store_name:
            return store_name.split('-')[0].strip()
        
        return store_name.strip()
    
    def _select_best_inventory_representative(self, products: List[Dict[str, Any]], store_prefix: str) -> Optional[Dict[str, Any]]:
        """
        选择FBA可用+FBA在途最大的产品作为该店铺的代表
        
        Args:
            products: 同一店铺前缀下的产品列表
            store_prefix: 店铺前缀
            
        Returns:
            最佳库存代表产品
        """
        if not products:
            return None
        
        try:
            best_product = None
            max_inventory = -1
            
            for product in products:
                # 计算FBA可用 + FBA在途
                fba_available = product.get('fba_available', 0) or 0
                fba_inbound = product.get('fba_inbound', 0) or 0
                total_fba_inventory = fba_available + fba_inbound
                
                if total_fba_inventory > max_inventory:
                    max_inventory = total_fba_inventory
                    best_product = product
            
            if best_product:
                self.logger.debug(f"店铺 {store_prefix} 最佳代表: 总FBA库存 {max_inventory}")
                
                # 为代表产品添加店铺合并标识
                representative = best_product.copy()
                representative['_store_prefix'] = store_prefix
                representative['_selected_inventory'] = max_inventory
                
                return representative
            
            return None
            
        except Exception as e:
            self.logger.error(f"选择最佳库存代表失败: {e}")
            return None
    
    def _merge_store_representatives(self, representatives: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        合并所有店铺代表为欧盟库存点
        
        Args:
            representatives: 店铺代表列表
            
        Returns:
            合并后的欧盟库存点
        """
        if not representatives:
            raise ValueError("店铺代表列表为空")
        
        base_product = representatives[0]
        
        # 基础信息使用第一个代表的信息
        merged_data = {
            'asin': base_product['asin'],
            'product_name': base_product['product_name'],
            'sku': base_product['sku'],
            'category': base_product.get('category', ''),
            'sales_person': base_product.get('sales_person', ''),
            'product_tag': base_product.get('product_tag', ''),
            'dev_name': base_product.get('dev_name', ''),  # 新增dev_name字段
            'marketplace': '欧盟',
            'store': '欧盟汇总',
            
            # 价格信息使用第一个代表的信息
            'average_price': base_product.get('average_price', ''),
            'sales_amount': base_product.get('sales_amount', ''),
            'net_sales': base_product.get('net_sales', ''),
            'refund_rate': base_product.get('refund_rate', ''),
        }
        
        # 合并库存数据（累加）
        merged_data.update({
            'fba_available': sum(rep.get('fba_available', 0) or 0 for rep in representatives),
            'fba_inbound': sum(rep.get('fba_inbound', 0) or 0 for rep in representatives),
            'fba_sellable': sum(rep.get('fba_sellable', 0) or 0 for rep in representatives),
            'fba_unsellable': sum(rep.get('fba_unsellable', 0) or 0 for rep in representatives),
            'inbound_shipped': sum(rep.get('inbound_shipped', 0) or 0 for rep in representatives),
        })
        
        # 本地仓库存不累加（同一个仓库），取最大值
        local_available_values = [rep.get('local_available', 0) or 0 for rep in representatives]
        merged_data['local_available'] = max(local_available_values) if local_available_values else 0
        
        # 合并销售数据（累加）
        merged_data.update({
            'sales_7days': sum(rep.get('sales_7days', 0) or 0 for rep in representatives),
            'total_sales': sum(rep.get('total_sales', 0) or 0 for rep in representatives),
            'average_sales': sum(rep.get('average_sales', 0) or 0 for rep in representatives),
            'order_count': sum(rep.get('order_count', 0) or 0 for rep in representatives),
            'promotional_orders': sum(rep.get('promotional_orders', 0) or 0 for rep in representatives),
        })
        
        # 合并广告数据（累加）
        merged_data.update({
            'ad_impressions': sum(rep.get('ad_impressions', 0) or 0 for rep in representatives),
            'ad_clicks': sum(rep.get('ad_clicks', 0) or 0 for rep in representatives),
            'ad_spend': sum(rep.get('ad_spend', 0) or 0 for rep in representatives),
            'ad_order_count': sum(rep.get('ad_order_count', 0) or 0 for rep in representatives),
            'ad_sales': sum(rep.get('ad_sales', 0) or 0 for rep in representatives),
        })
        
        # 添加合并元数据
        merged_data.update({
            '_merge_type': 'eu_merged',
            '_merged_stores': [rep.get('_store_prefix', '') for rep in representatives],
            '_representative_count': len(representatives),
            '_total_selected_inventory': sum(rep.get('_selected_inventory', 0) for rep in representatives)
        })
        
        # 计算库存点名称
        merged_data['inventory_point_name'] = self._format_inventory_point_name(merged_data)
        
        self.logger.debug(f"欧盟合并完成: {merged_data['asin']} - {len(representatives)}个店铺代表")
        
        return merged_data
    
    def _format_inventory_point_name(self, merged_data: Dict[str, Any]) -> str:
        """格式化库存点显示名称"""
        asin = merged_data.get('asin', '')
        marketplace = merged_data.get('marketplace', '')
        return f"{asin}-{marketplace}" if asin and marketplace else ''
    
    def get_merge_info(self, representatives: List[Dict[str, Any]]) -> Dict[str, Any]:
        """获取合并详细信息"""
        if not representatives:
            return {}
        
        total_inventory = sum(
            (rep.get('fba_available', 0) or 0) + (rep.get('fba_inbound', 0) or 0) 
            for rep in representatives
        )
        
        return {
            'store_count': len(representatives),
            'store_prefixes': [rep.get('_store_prefix', '') for rep in representatives],
            'total_fba_inventory': total_inventory,
            'representative_inventories': [rep.get('_selected_inventory', 0) for rep in representatives]
        }