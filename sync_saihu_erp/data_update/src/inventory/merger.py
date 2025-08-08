"""
库存合并器核心模块

实现库存点合并的主要逻辑，协调各个子合并器的工作
"""

import logging
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class InventoryMerger:
    """库存点合并器主类"""
    
    # 欧盟国家代码（UK已脱欧，按非欧盟逻辑处理）
    EU_COUNTRIES = {
        'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'AT', 
        'DK', 'SE', 'FI', 'EE', 'HR', 'SI', 'CZ', 'RO', 'BG', 
        'GR', 'CY', 'MT', 'IS', 'LI', 'MC', 'SM', 'VA'
    }
    
    def __init__(self):
        """初始化合并器"""
        self.eu_merger = None  # 延迟导入避免循环依赖
        self.non_eu_merger = None
        self.ad_merger = None
        
    def _initialize_sub_mergers(self):
        """延迟初始化子合并器"""
        if self.eu_merger is None:
            from .eu_merger import EUMerger
            from .non_eu_merger import NonEUMerger
            from .ad_merger import AdMerger
            
            self.eu_merger = EUMerger()
            self.non_eu_merger = NonEUMerger()
            self.ad_merger = AdMerger()
    
    def merge_inventory_points(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        合并库存点数据
        
        Args:
            products: 原始产品数据列表
            
        Returns:
            合并后的库存点数据列表
        """
        if not products:
            logger.warning("输入产品列表为空")
            return []
        
        try:
            logger.info(f"开始合并库存点，原始产品数量: {len(products)}")
            
            # 初始化子合并器
            self._initialize_sub_mergers()
            
            # 数据预处理和验证
            valid_products = self._validate_and_clean_products(products)
            logger.info(f"有效产品数量: {len(valid_products)}")
            
            # 按ASIN分组
            asin_groups = self._group_by_asin(valid_products)
            logger.info(f"ASIN分组数量: {len(asin_groups)}")
            
            merged_points = []
            
            # 处理每个ASIN分组
            for asin, asin_products in asin_groups.items():
                try:
                    # 分离欧盟和非欧盟产品
                    eu_products, non_eu_products = self._separate_by_region(asin_products)
                    
                    # 合并欧盟地区库存
                    if eu_products:
                        eu_merged = self.eu_merger.merge(eu_products)
                        if eu_merged:
                            merged_points.append(eu_merged)
                            logger.debug(f"ASIN {asin} 欧盟地区合并完成")
                    
                    # 合并非欧盟地区库存
                    if non_eu_products:
                        non_eu_merged = self.non_eu_merger.merge(non_eu_products)
                        if non_eu_merged:
                            merged_points.extend(non_eu_merged)
                            logger.debug(f"ASIN {asin} 非欧盟地区合并完成")
                            
                except Exception as e:
                    logger.error(f"ASIN {asin} 合并失败: {e}")
                    continue
            
            # 合并广告数据
            for point in merged_points:
                try:
                    point = self.ad_merger.merge_ad_data(point)
                except Exception as e:
                    logger.error(f"广告数据合并失败: {e}")
                    continue
            
            logger.info(f"库存点合并完成，合并后数量: {len(merged_points)}")
            return merged_points
            
        except Exception as e:
            logger.error(f"库存点合并过程异常: {e}")
            raise
    
    def _validate_and_clean_products(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """验证和清洗产品数据"""
        valid_products = []
        required_fields = ['asin', 'product_name', 'store', 'marketplace']
        
        for i, product in enumerate(products):
            try:
                # 检查必需字段
                if not all(field in product and product[field] for field in required_fields):
                    logger.warning(f"产品 #{i} 缺少必需字段，跳过")
                    continue
                
                # 数据类型转换和清理
                cleaned_product = self._clean_product_data(product)
                valid_products.append(cleaned_product)
                
            except Exception as e:
                logger.warning(f"产品 #{i} 数据清理失败: {e}")
                continue
        
        return valid_products
    
    def _clean_product_data(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """清理单个产品数据"""
        cleaned = product.copy()
        
        # 数值字段标准化
        numeric_fields = [
            'fba_available', 'fba_inbound', 'local_available', 'fba_sellable',
            'sales_7days', 'average_sales', 'order_count', 'total_sales',
            'ad_impressions', 'ad_clicks', 'ad_spend', 'ad_order_count'
        ]
        
        for field in numeric_fields:
            if field in cleaned:
                try:
                    cleaned[field] = float(cleaned[field]) if cleaned[field] is not None else 0.0
                except (ValueError, TypeError):
                    cleaned[field] = 0.0
        
        # 字符串字段标准化
        string_fields = ['asin', 'product_name', 'store', 'marketplace', 'sku', 'category', 'sales_person', 'dev_name']
        for field in string_fields:
            if field in cleaned and cleaned[field] is not None:
                cleaned[field] = str(cleaned[field]).strip()
        
        return cleaned
    
    def _group_by_asin(self, products: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """按ASIN分组产品"""
        groups = {}
        for product in products:
            asin = product['asin']
            if asin not in groups:
                groups[asin] = []
            groups[asin].append(product)
        return groups
    
    def _separate_by_region(self, products: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """分离欧盟和非欧盟产品"""
        eu_products = []
        non_eu_products = []
        
        for product in products:
            try:
                # 从店铺名称提取国家代码
                country_code = self._extract_country_code(product['store'])
                if country_code in self.EU_COUNTRIES:
                    eu_products.append(product)
                else:
                    non_eu_products.append(product)
            except Exception as e:
                logger.warning(f"产品地区分离失败: {e}, 默认为非欧盟")
                non_eu_products.append(product)
        
        return eu_products, non_eu_products
    
    def _extract_country_code(self, store_name: str) -> str:
        """从店铺名称提取国家代码"""
        if not store_name:
            return ''
        
        # 店铺名称格式: "03 ZipCozy-UK" 或 "ZipCozy-UK"
        if '-' in store_name:
            return store_name.split('-')[-1].strip().upper()
        
        return ''
    
    def get_merge_statistics(self, original_count: int, merged_points: List[Dict[str, Any]]) -> Dict[str, Any]:
        """获取合并统计信息"""
        eu_count = sum(1 for point in merged_points if point.get('marketplace') == '欧盟')
        non_eu_count = len(merged_points) - eu_count
        
        return {
            'original_count': original_count,
            'merged_count': len(merged_points),
            'eu_points': eu_count,
            'non_eu_points': non_eu_count,
            'compression_ratio': round(len(merged_points) / original_count if original_count > 0 else 0, 2),
            'merge_time': datetime.now().isoformat()
        }