"""
库存明细数据抓取器
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, date
from .base_scraper import BaseScraper
from ..models import InventoryDetails

logger = logging.getLogger(__name__)

class InventoryDetailsScraper(BaseScraper):
    """库存明细数据抓取器"""
    
    def __init__(self, api_template):
        """初始化库存明细数据抓取器"""
        super().__init__(api_template)
        self.data_type = 'inventory_details'
        logger.info("库存明细数据抓取器初始化完成")
    
    def fetch_data(self, params: Dict[str, Any] = None) -> List[InventoryDetails]:
        """抓取库存明细数据"""
        try:
            # 构建请求URL和参数
            url = self.api_template.build_request_url(self.base_config['base_url'], params)
            headers = self.api_template.build_request_headers()
            
            # 验证参数
            if params:
                is_valid, errors = self.api_template.validate_params(params)
                if not is_valid:
                    logger.error(f"参数验证失败: {', '.join(errors)}")
                    return []
            
            # 发起HTTP请求
            logger.info(f"开始抓取库存明细数据: {url}")
            response = self._make_request_with_retry(
                url=url,
                method=self.api_template.method,
                params=params if self.api_template.method.upper() == 'GET' else None,
                data=self.api_template.build_request_body(params),
                headers=headers
            )
            
            # 解析响应
            response_data = self._parse_response(response)
            if not self._validate_response_data(response_data):
                return []
            
            # 转换为数据模型
            inventory_data = self._convert_to_models(response_data, params)
            
            logger.info(f"成功抓取到 {len(inventory_data)} 条库存明细数据")
            return inventory_data
            
        except Exception as e:
            logger.error(f"抓取库存明细数据失败: {e}")
            raise
    
    def fetch_current_inventory(self, warehouse_codes: List[str] = None, skus: List[str] = None) -> List[InventoryDetails]:
        """抓取当前库存明细数据"""
        params = {
            'snapshot_date': date.today().strftime('%Y-%m-%d'),
            'type': 'current'
        }
        
        if warehouse_codes:
            params['warehouse_codes'] = ','.join(warehouse_codes)
        
        if skus:
            params['skus'] = ','.join(skus)
        
        return self.fetch_data(params)
    
    def fetch_inventory_by_warehouse(self, warehouse_code: str) -> List[InventoryDetails]:
        """按仓库代码抓取库存明细数据"""
        params = {
            'warehouse_code': warehouse_code,
            'snapshot_date': date.today().strftime('%Y-%m-%d')
        }
        
        return self.fetch_data(params)
    
    def fetch_inventory_by_skus(self, skus: List[str], warehouse_codes: List[str] = None) -> List[InventoryDetails]:
        """按SKU列表抓取库存明细数据"""
        if not skus:
            logger.warning("SKU列表为空")
            return []
        
        params = {
            'skus': ','.join(skus),
            'snapshot_date': date.today().strftime('%Y-%m-%d')
        }
        
        if warehouse_codes:
            params['warehouse_codes'] = ','.join(warehouse_codes)
        
        # 如果SKU数量较多，使用分页抓取
        if len(skus) > 100:
            logger.info(f"SKU数量较多({len(skus)})，使用分页抓取")
            return self.fetch_data_with_pagination(params, page_size=100)
        else:
            return self.fetch_data(params)
    
    def fetch_low_stock_inventory(self, threshold: int = 10, warehouse_codes: List[str] = None) -> List[InventoryDetails]:
        """抓取低库存的商品明细"""
        params = {
            'filter': 'low_stock',
            'threshold': threshold,
            'snapshot_date': date.today().strftime('%Y-%m-%d')
        }
        
        if warehouse_codes:
            params['warehouse_codes'] = ','.join(warehouse_codes)
        
        return self.fetch_data(params)
    
    def fetch_expiring_inventory(self, days_to_expiry: int = 30, warehouse_codes: List[str] = None) -> List[InventoryDetails]:
        """抓取即将过期的商品明细"""
        params = {
            'filter': 'expiring',
            'days_to_expiry': days_to_expiry,
            'snapshot_date': date.today().strftime('%Y-%m-%d')
        }
        
        if warehouse_codes:
            params['warehouse_codes'] = ','.join(warehouse_codes)
        
        return self.fetch_data(params)
    
    def fetch_inventory_by_status(self, status: str, warehouse_codes: List[str] = None) -> List[InventoryDetails]:
        """按状态抓取库存明细数据"""
        params = {
            'status': status,
            'snapshot_date': date.today().strftime('%Y-%m-%d')
        }
        
        if warehouse_codes:
            params['warehouse_codes'] = ','.join(warehouse_codes)
        
        return self.fetch_data(params)
    
    def _convert_to_models(self, response_data: Any, request_params: Dict[str, Any] = None) -> List[InventoryDetails]:
        """将API响应数据转换为InventoryDetails模型列表"""
        inventory_list = []
        
        try:
            # 处理不同的响应格式
            if isinstance(response_data, dict):
                if 'data' in response_data:
                    data_list = response_data['data']
                elif 'inventory' in response_data:
                    data_list = response_data['inventory']
                elif 'details' in response_data:
                    data_list = response_data['details']
                elif 'items' in response_data:
                    data_list = response_data['items']
                else:
                    # 单个对象响应
                    data_list = [response_data]
            elif isinstance(response_data, list):
                data_list = response_data
            else:
                logger.error(f"不支持的响应格式: {type(response_data)}")
                return []
            
            # 获取快照日期
            snapshot_date = date.today()
            if request_params and 'snapshot_date' in request_params:
                try:
                    snapshot_date = datetime.strptime(request_params['snapshot_date'], '%Y-%m-%d').date()
                except ValueError:
                    pass
            
            # 转换每个数据项
            for item in data_list:
                try:
                    inventory = InventoryDetails.from_api_response(item, snapshot_date)
                    
                    # 验证数据有效性
                    if inventory.is_valid():
                        inventory_list.append(inventory)
                    else:
                        logger.warning(f"跳过无效的库存明细数据: {inventory.item_id}")
                        
                except Exception as e:
                    logger.error(f"转换库存明细数据失败: {e}, 数据: {item}")
                    continue
            
            logger.info(f"成功转换 {len(inventory_list)} 条有效的库存明细数据")
            
        except Exception as e:
            logger.error(f"数据转换过程失败: {e}")
        
        return inventory_list
    
    def get_warehouse_list(self) -> List[Dict[str, str]]:
        """获取可用的仓库列表"""
        try:
            # 构建仓库列表请求
            params = {'action': 'list_warehouses'}
            url = self.api_template.build_request_url(self.base_config['base_url'], params)
            headers = self.api_template.build_request_headers()
            
            response = self._make_request_with_retry(url=url, headers=headers)
            response_data = self._parse_response(response)
            
            if isinstance(response_data, dict) and 'warehouses' in response_data:
                return response_data['warehouses']
            elif isinstance(response_data, list):
                return response_data
            else:
                logger.warning("无法获取仓库列表")
                return []
                
        except Exception as e:
            logger.error(f"获取仓库列表失败: {e}")
            return []
    
    def get_item_list(self, warehouse_code: str = None) -> List[str]:
        """获取可用的商品ID列表"""
        try:
            params = {'action': 'list_items'}
            if warehouse_code:
                params['warehouse_code'] = warehouse_code
            
            url = self.api_template.build_request_url(self.base_config['base_url'], params)
            headers = self.api_template.build_request_headers()
            
            response = self._make_request_with_retry(url=url, headers=headers)
            response_data = self._parse_response(response)
            
            if isinstance(response_data, dict) and 'item_ids' in response_data:
                return response_data['item_ids']
            elif isinstance(response_data, list):
                return response_data
            else:
                logger.warning("无法获取商品列表")
                return []
                
        except Exception as e:
            logger.error(f"获取商品列表失败: {e}")
            return []
    
    def get_inventory_summary(self, inventory_list: List[InventoryDetails]) -> Dict[str, Any]:
        """获取库存明细数据摘要统计"""
        if not inventory_list:
            return {}
        
        from collections import defaultdict
        from decimal import Decimal
        
        # 按仓库统计
        warehouse_stats = defaultdict(lambda: {
            'total_items': 0,
            'total_quantity': 0,
            'available_quantity': 0,
            'reserved_quantity': 0,
            'total_value': Decimal('0.00'),
            'low_stock_count': 0,
            'expiring_count': 0,
            'expired_count': 0
        })
        
        # 按状态统计
        status_stats = defaultdict(int)
        
        total_stats = {
            'total_items': len(inventory_list),
            'total_quantity': 0,
            'available_quantity': 0,
            'reserved_quantity': 0,
            'total_value': Decimal('0.00'),
            'low_stock_count': 0,
            'expiring_count': 0,
            'expired_count': 0,
            'warehouses': set(),
            'unique_skus': set()
        }
        
        for item in inventory_list:
            warehouse = item.warehouse_code or 'unknown'
            total_stats['warehouses'].add(warehouse)
            total_stats['unique_skus'].add(item.sku)
            
            # 状态统计
            status_stats[item.status] += 1
            
            # 总计统计
            total_stats['total_quantity'] += item.quantity or 0
            total_stats['available_quantity'] += item.available_quantity or 0
            total_stats['reserved_quantity'] += item.reserved_quantity or 0
            total_stats['total_value'] += item.calculate_total_value()
            
            if item.is_low_stock():
                total_stats['low_stock_count'] += 1
            
            if item.is_expired():
                total_stats['expired_count'] += 1
            elif item.days_to_expiry() is not None and item.days_to_expiry() <= 30:
                total_stats['expiring_count'] += 1
            
            # 仓库统计
            warehouse_stats[warehouse]['total_items'] += 1
            warehouse_stats[warehouse]['total_quantity'] += item.quantity or 0
            warehouse_stats[warehouse]['available_quantity'] += item.available_quantity or 0
            warehouse_stats[warehouse]['reserved_quantity'] += item.reserved_quantity or 0
            warehouse_stats[warehouse]['total_value'] += item.calculate_total_value()
            
            if item.is_low_stock():
                warehouse_stats[warehouse]['low_stock_count'] += 1
            
            if item.is_expired():
                warehouse_stats[warehouse]['expired_count'] += 1
            elif item.days_to_expiry() is not None and item.days_to_expiry() <= 30:
                warehouse_stats[warehouse]['expiring_count'] += 1
        
        total_stats['warehouses'] = list(total_stats['warehouses'])
        total_stats['unique_skus'] = len(total_stats['unique_skus'])
        
        return {
            'total': total_stats,
            'by_warehouse': dict(warehouse_stats),
            'by_status': dict(status_stats)
        }
    
    def scrape(self, **kwargs) -> Dict[str, Any]:
        """
        抓取库存明细数据的统一方法
        
        Returns:
            包含抓取结果的字典
        """
        try:
            # 使用fetch_current_inventory抓取当前库存明细
            inventory_data = self.fetch_current_inventory(**kwargs)
            
            return {
                'status': 'success',
                'data': [item.to_dict() for item in inventory_data],
                'data_count': len(inventory_data),
                'snapshot_date': date.today().strftime('%Y-%m-%d')
            }
            
        except Exception as e:
            logger.error(f"抓取库存明细数据失败: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }

    def scrape_by_date(self, data_date: str, **kwargs) -> Dict[str, Any]:
        """
        按日期抓取库存明细数据的统一方法
        
        Args:
            data_date: 数据日期，格式YYYY-MM-DD
            **kwargs: 其他参数，如warehouse_codes, skus等
            
        Returns:
            包含抓取结果的字典
        """
        try:
            snapshot_date = datetime.strptime(data_date, '%Y-%m-%d').date()
            
            # 调用现有的按日期抓取方法
            inventory_data = self.fetch_data(params={
                'snapshot_date': data_date,
                'warehouse_codes': kwargs.get('warehouse_codes'),
                'skus': kwargs.get('skus')
            })
            
            return {
                'status': 'success',
                'data': [item.to_dict() for item in inventory_data],
                'data_count': len(inventory_data),
                'data_date': data_date
            }
            
        except Exception as e:
            logger.error(f"按日期抓取库存明细数据失败: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'data_date': data_date
            }

    def filter_inventory_by_criteria(self, 
                                   inventory_list: List[InventoryDetails],
                                   criteria: Dict[str, Any]) -> List[InventoryDetails]:
        """按条件筛选库存明细数据"""
        filtered_list = inventory_list
        
        # 按仓库筛选
        if 'warehouse_codes' in criteria:
            warehouse_codes = criteria['warehouse_codes']
            filtered_list = [item for item in filtered_list if item.warehouse_code in warehouse_codes]
        
        # 按状态筛选
        if 'status' in criteria:
            status = criteria['status']
            filtered_list = [item for item in filtered_list if item.status == status]
        
        # 按库存水平筛选
        if 'stock_level' in criteria:
            level = criteria['stock_level']
            if level == 'low_stock':
                filtered_list = [item for item in filtered_list if item.is_low_stock()]
            elif level == 'out_of_stock':
                filtered_list = [item for item in filtered_list if item.available_quantity <= 0]
            elif level == 'normal':
                filtered_list = [item for item in filtered_list if not item.is_low_stock() and item.available_quantity > 0]
        
        # 按过期状态筛选
        if 'expiry_status' in criteria:
            expiry_status = criteria['expiry_status']
            if expiry_status == 'expired':
                filtered_list = [item for item in filtered_list if item.is_expired()]
            elif expiry_status == 'expiring_soon':
                filtered_list = [item for item in filtered_list 
                               if not item.is_expired() and item.days_to_expiry() is not None and item.days_to_expiry() <= 30]
            elif expiry_status == 'normal':
                filtered_list = [item for item in filtered_list 
                               if not item.is_expired() and (item.days_to_expiry() is None or item.days_to_expiry() > 30)]
        
        return filtered_list