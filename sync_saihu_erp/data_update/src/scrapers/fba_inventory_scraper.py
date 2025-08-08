"""
FBA库存数据抓取器
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, date
from .base_scraper import BaseScraper
from ..models import FbaInventory

logger = logging.getLogger(__name__)

class FbaInventoryScraper(BaseScraper):
    """FBA库存数据抓取器"""
    
    def __init__(self, api_template):
        """初始化FBA库存数据抓取器"""
        super().__init__(api_template)
        self.data_type = 'fba_inventory'
        logger.info("FBA库存数据抓取器初始化完成")
    
    def fetch_data(self, params: Dict[str, Any] = None) -> List[FbaInventory]:
        """抓取FBA库存数据"""
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
            logger.info(f"开始抓取FBA库存数据: {url}")
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
            
            logger.info(f"成功抓取到 {len(inventory_data)} 条FBA库存数据")
            return inventory_data
            
        except Exception as e:
            logger.error(f"抓取FBA库存数据失败: {e}")
            raise
    
    def fetch_current_inventory(self, 
                               marketplace_ids: List[str] = None, 
                               skus: List[str] = None,
                               shop_ids: List[str] = None,
                               asins: List[str] = None,
                               commodity_ids: List[str] = None,
                               product_ids: List[str] = None,
                               hide_zero: bool = True,
                               hide_deleted_prd: bool = True,
                               need_merge_share: bool = False,
                               page_no: int = 1,
                               page_size: int = 100,
                               currency: str = "USD") -> List[FbaInventory]:
        """抓取当前FBA库存数据 - 使用签名认证的API客户端"""
        try:
            # 导入签名API客户端
            from ..auth.saihu_api_client import saihu_api_client
            from datetime import datetime
            
            # 构建API参数（符合官方文档）
            api_params = {
                "page_no": page_no,
                "page_size": page_size,
                "hide_zero": hide_zero,
                "currency": currency,
                "hide_deleted_prd": hide_deleted_prd,
                "need_merge_share": need_merge_share
            }
            
            # 添加可选的数组参数
            if skus:
                api_params["skus"] = skus
            if asins:
                api_params["asins"] = asins
            if commodity_ids:
                api_params["commodityIds"] = commodity_ids
            if product_ids:
                api_params["productIds"] = product_ids
            if shop_ids:
                api_params["shopIdList"] = shop_ids
            if marketplace_ids:
                api_params["productDevIds"] = ",".join(marketplace_ids)
            
            logger.info(f"开始抓取FBA库存数据，页码: {page_no}, 页大小: {page_size}")
            
            # 使用签名API客户端
            result = saihu_api_client.fetch_fba_inventory(**api_params)
            
            if not result:
                logger.warning("FBA库存API返回空结果")
                return []
            
            # 提取数据行
            rows = result.get('rows', [])
            if not rows:
                logger.info("FBA库存API返回无数据")
                return []
            
            # 转换为FbaInventory模型
            inventory_list = []
            snapshot_date = datetime.now().date()
            
            for item in rows:
                try:
                    inventory = FbaInventory.from_api_response(item, snapshot_date)
                    if inventory.is_valid():
                        inventory_list.append(inventory)
                    else:
                        logger.warning(f"跳过无效的FBA库存数据: {item}")
                except Exception as e:
                    logger.error(f"转换FBA库存数据失败: {e}, 数据: {item}")
                    continue
            
            logger.info(f"成功抓取到 {len(inventory_list)} 条FBA库存数据")
            return inventory_list
            
        except Exception as e:
            logger.error(f"抓取FBA库存数据失败: {e}")
            return []
    
    def fetch_inventory_by_marketplace(self, marketplace_id: str) -> List[FbaInventory]:
        """按市场ID抓取FBA库存数据"""
        params = {
            'marketplace_id': marketplace_id,
            'snapshot_date': date.today().strftime('%Y-%m-%d')
        }
        
        return self.fetch_data(params)
    
    def fetch_inventory_by_skus(self, skus: List[str], marketplace_ids: List[str] = None) -> List[FbaInventory]:
        """按SKU列表抓取FBA库存数据"""
        if not skus:
            logger.warning("SKU列表为空")
            return []
        
        params = {
            'skus': ','.join(skus),
            'snapshot_date': date.today().strftime('%Y-%m-%d')
        }
        
        if marketplace_ids:
            params['marketplace_ids'] = ','.join(marketplace_ids)
        
        # 如果SKU数量较多，使用分页抓取
        if len(skus) > 100:
            logger.info(f"SKU数量较多({len(skus)})，使用分页抓取")
            return self.fetch_data_with_pagination(params, page_size=100)
        else:
            return self.fetch_data(params)
    
    def fetch_low_stock_inventory(self, threshold: int = 10, marketplace_ids: List[str] = None) -> List[FbaInventory]:
        """抓取低库存的FBA商品"""
        params = {
            'filter': 'low_stock',
            'threshold': threshold,
            'snapshot_date': date.today().strftime('%Y-%m-%d')
        }
        
        if marketplace_ids:
            params['marketplace_ids'] = ','.join(marketplace_ids)
        
        return self.fetch_data(params)
    
    def fetch_out_of_stock_inventory(self, marketplace_ids: List[str] = None) -> List[FbaInventory]:
        """抓取缺货的FBA商品"""
        params = {
            'filter': 'out_of_stock',
            'snapshot_date': date.today().strftime('%Y-%m-%d')
        }
        
        if marketplace_ids:
            params['marketplace_ids'] = ','.join(marketplace_ids)
        
        return self.fetch_data(params)
    
    def _convert_to_models(self, response_data: Any, request_params: Dict[str, Any] = None) -> List[FbaInventory]:
        """将API响应数据转换为FbaInventory模型列表"""
        inventory_list = []
        
        try:
            # 处理不同的响应格式
            if isinstance(response_data, dict):
                if 'data' in response_data:
                    data_list = response_data['data']
                elif 'inventory' in response_data:
                    data_list = response_data['inventory']
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
                    inventory = FbaInventory.from_api_response(item, snapshot_date)
                    
                    # 验证数据有效性
                    if inventory.is_valid():
                        inventory_list.append(inventory)
                    else:
                        logger.warning(f"跳过无效的FBA库存数据: {inventory.sku}")
                        
                except Exception as e:
                    logger.error(f"转换FBA库存数据失败: {e}, 数据: {item}")
                    continue
            
            logger.info(f"成功转换 {len(inventory_list)} 条有效的FBA库存数据")
            
        except Exception as e:
            logger.error(f"数据转换过程失败: {e}")
        
        return inventory_list
    
    def get_marketplace_list(self) -> List[Dict[str, str]]:
        """获取可用的市场列表"""
        try:
            # 构建市场列表请求
            params = {'action': 'list_marketplaces'}
            url = self.api_template.build_request_url(self.base_config['base_url'], params)
            headers = self.api_template.build_request_headers()
            
            response = self._make_request_with_retry(url=url, headers=headers)
            response_data = self._parse_response(response)
            
            if isinstance(response_data, dict) and 'marketplaces' in response_data:
                return response_data['marketplaces']
            elif isinstance(response_data, list):
                return response_data
            else:
                logger.warning("无法获取市场列表")
                return []
                
        except Exception as e:
            logger.error(f"获取市场列表失败: {e}")
            return []
    
    def get_sku_list(self, marketplace_id: str = None) -> List[str]:
        """获取可用的SKU列表"""
        try:
            params = {'action': 'list_skus'}
            if marketplace_id:
                params['marketplace_id'] = marketplace_id
            
            url = self.api_template.build_request_url(self.base_config['base_url'], params)
            headers = self.api_template.build_request_headers()
            
            response = self._make_request_with_retry(url=url, headers=headers)
            response_data = self._parse_response(response)
            
            if isinstance(response_data, dict) and 'skus' in response_data:
                return response_data['skus']
            elif isinstance(response_data, list):
                return response_data
            else:
                logger.warning("无法获取SKU列表")
                return []
                
        except Exception as e:
            logger.error(f"获取SKU列表失败: {e}")
            return []
    
    def get_inventory_summary(self, inventory_list: List[FbaInventory]) -> Dict[str, Any]:
        """获取库存数据摘要统计"""
        if not inventory_list:
            return {}
        
        from collections import defaultdict
        
        # 按市场统计
        marketplace_stats = defaultdict(lambda: {
            'total_skus': 0,
            'total_quantity': 0,
            'available_quantity': 0,
            'low_stock_count': 0,
            'out_of_stock_count': 0
        })
        
        total_stats = {
            'total_skus': len(inventory_list),
            'total_quantity': 0,
            'available_quantity': 0,
            'low_stock_count': 0,
            'out_of_stock_count': 0,
            'marketplaces': set()
        }
        
        for item in inventory_list:
            marketplace = item.marketplace_id or 'unknown'
            total_stats['marketplaces'].add(marketplace)
            
            # 总计统计
            total_stats['total_quantity'] += item.total_quantity or 0
            total_stats['available_quantity'] += item.available_quantity or 0
            
            if item.is_low_stock():
                total_stats['low_stock_count'] += 1
            
            if item.is_out_of_stock():
                total_stats['out_of_stock_count'] += 1
            
            # 市场统计
            marketplace_stats[marketplace]['total_skus'] += 1
            marketplace_stats[marketplace]['total_quantity'] += item.total_quantity or 0
            marketplace_stats[marketplace]['available_quantity'] += item.available_quantity or 0
            
            if item.is_low_stock():
                marketplace_stats[marketplace]['low_stock_count'] += 1
            
            if item.is_out_of_stock():
                marketplace_stats[marketplace]['out_of_stock_count'] += 1
        
        total_stats['marketplaces'] = list(total_stats['marketplaces'])
        
        return {
            'total': total_stats,
            'by_marketplace': dict(marketplace_stats)
        }
    
    def scrape(self, **kwargs) -> Dict[str, Any]:
        """
        抓取FBA库存数据的统一方法
        
        Returns:
            包含抓取结果的字典
        """
        try:
            # 使用签名API客户端抓取当前FBA库存
            inventory_data = self.fetch_current_inventory(**kwargs)
            
            return {
                'status': 'success',
                'data': [item.to_dict() for item in inventory_data],
                'data_count': len(inventory_data),
                'snapshot_date': date.today().strftime('%Y-%m-%d')
            }
            
        except Exception as e:
            logger.error(f"抓取FBA库存数据失败: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }

    def scrape_by_date(self, data_date: str, **kwargs) -> Dict[str, Any]:
        """
        按日期抓取FBA库存数据的统一方法
        
        Args:
            data_date: 数据日期，格式YYYY-MM-DD
            **kwargs: 其他参数，如marketplace_ids, skus等
            
        Returns:
            包含抓取结果的字典
        """
        try:
            snapshot_date = datetime.strptime(data_date, '%Y-%m-%d').date()
            
            # 调用现有的按日期抓取方法
            inventory_data = self.fetch_data(params={
                'snapshot_date': data_date,
                'marketplace_ids': kwargs.get('marketplace_ids'),
                'skus': kwargs.get('skus')
            })
            
            return {
                'status': 'success',
                'data': [item.to_dict() for item in inventory_data],
                'data_count': len(inventory_data),
                'data_date': data_date
            }
            
        except Exception as e:
            logger.error(f"按日期抓取FBA库存数据失败: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'data_date': data_date
            }

    def filter_inventory_by_status(self, inventory_list: List[FbaInventory], status: str) -> List[FbaInventory]:
        """按状态筛选库存数据"""
        if status == 'low_stock':
            return [item for item in inventory_list if item.is_low_stock()]
        elif status == 'out_of_stock':
            return [item for item in inventory_list if item.is_out_of_stock()]
        elif status == 'normal':
            return [item for item in inventory_list if not item.is_low_stock() and not item.is_out_of_stock()]
        else:
            return inventory_list