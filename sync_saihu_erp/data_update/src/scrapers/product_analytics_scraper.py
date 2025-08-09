"""
产品分析数据抓取器
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
from .base_scraper import BaseScraper
from ..models import ProductAnalytics
from ..auth.saihu_api_client import saihu_api_client

logger = logging.getLogger(__name__)

class ProductAnalyticsScraper(BaseScraper):
    """产品分析数据抓取器"""
    
    def __init__(self, api_template):
        """初始化产品分析数据抓取器"""
        super().__init__(api_template)
        self.data_type = 'product_analytics'
        logger.info("产品分析数据抓取器初始化完成")
    
    def fetch_data(self, params: Dict[str, Any] = None) -> List[ProductAnalytics]:
        """抓取产品分析数据"""
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
            logger.info(f"开始抓取产品分析数据: {url}")
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
            analytics_data = self._convert_to_models(response_data, params)
            
            logger.info(f"成功抓取到 {len(analytics_data)} 条产品分析数据")
            return analytics_data
            
        except Exception as e:
            logger.error(f"抓取产品分析数据失败: {e}")
            raise
    
    def fetch_yesterday_data(self, product_ids: List[str] = None) -> List[ProductAnalytics]:
        """抓取前一天的产品分析数据"""
        yesterday = date.today() - timedelta(days=1)
        
        params = {
            'date': yesterday.strftime('%Y-%m-%d'),
            'type': 'daily'
        }
        
        if product_ids:
            params['product_ids'] = ','.join(product_ids)
        
        return self.fetch_data(params)
    
    def fetch_last_7_days_data(self, product_ids: List[str] = None) -> List[ProductAnalytics]:
        """抓取前七天的产品分析数据"""
        end_date = date.today() - timedelta(days=1)
        start_date = end_date - timedelta(days=6)
        
        params = {
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'type': 'range'
        }
        
        if product_ids:
            params['product_ids'] = ','.join(product_ids)
        
        return self.fetch_data(params)
    
    def fetch_specific_date_data(self, target_date: date, product_ids: List[str] = None) -> List[ProductAnalytics]:
        """抓取指定日期的产品分析数据"""
        params = {
            'date': target_date.strftime('%Y-%m-%d'),
            'type': 'daily'
        }
        
        if product_ids:
            params['product_ids'] = ','.join(product_ids)
        
        return self.fetch_data(params)
    
    def fetch_data_by_date_range(self, 
                                start_date: date, 
                                end_date: date, 
                                product_ids: List[str] = None) -> List[ProductAnalytics]:
        """按日期范围抓取产品分析数据"""
        params = {
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'type': 'range'
        }
        
        if product_ids:
            params['product_ids'] = ','.join(product_ids)
        
        # 如果日期范围较大，使用分页抓取
        days_count = (end_date - start_date).days + 1
        if days_count > 30:  # 超过30天使用分页
            logger.info(f"日期范围较大({days_count}天)，使用分页抓取")
            return self.fetch_data_with_pagination(params, page_size=50)
        else:
            return self.fetch_data(params)
    
    def _convert_to_models(self, response_data: Any, request_params: Dict[str, Any] = None) -> List[ProductAnalytics]:
        """将API响应数据转换为ProductAnalytics模型列表"""
        analytics_list = []
        
        try:
            # 处理不同的响应格式
            if isinstance(response_data, dict):
                if 'data' in response_data:
                    data_list = response_data['data']
                elif 'items' in response_data:
                    data_list = response_data['items']
                elif 'results' in response_data:
                    data_list = response_data['results']
                else:
                    # 单个对象响应
                    data_list = [response_data]
            elif isinstance(response_data, list):
                data_list = response_data
            else:
                logger.error(f"不支持的响应格式: {type(response_data)}")
                return []
            
            # 转换每个数据项
            for item in data_list:
                try:
                    analytics = ProductAnalytics.from_api_response(item)
                    
                    # 验证数据有效性
                    if analytics.is_valid():
                        analytics_list.append(analytics)
                    else:
                        logger.warning(f"跳过无效的产品分析数据: {analytics.product_id}")
                        
                except Exception as e:
                    logger.error(f"转换产品分析数据失败: {e}, 数据: {item}")
                    continue
            
            logger.info(f"成功转换 {len(analytics_list)} 条有效的产品分析数据")
            
        except Exception as e:
            logger.error(f"数据转换过程失败: {e}")
        
        return analytics_list
    
    def get_product_list(self) -> List[str]:
        """获取可用的产品ID列表"""
        try:
            # 构建产品列表请求
            params = {'action': 'list_products'}
            url = self.api_template.build_request_url(self.base_config['base_url'], params)
            headers = self.api_template.build_request_headers()
            
            response = self._make_request_with_retry(url=url, headers=headers)
            response_data = self._parse_response(response)
            
            if isinstance(response_data, dict) and 'product_ids' in response_data:
                return response_data['product_ids']
            elif isinstance(response_data, list):
                return response_data
            else:
                logger.warning("无法获取产品列表")
                return []
                
        except Exception as e:
            logger.error(f"获取产品列表失败: {e}")
            return []
    
    def validate_date_range(self, start_date: date, end_date: date) -> bool:
        """验证日期范围的有效性"""
        if start_date > end_date:
            logger.error("开始日期不能晚于结束日期")
            return False
        
        if end_date > date.today():
            logger.error("结束日期不能超过今天")
            return False
        
        # 检查日期范围是否过大（例如不超过90天）
        days_diff = (end_date - start_date).days
        if days_diff > 90:
            logger.warning(f"日期范围过大({days_diff}天)，可能影响性能")
        
        return True
    
    def scrape_by_date(self, data_date: str, **kwargs) -> Dict[str, Any]:
        """
        按日期抓取产品分析数据的统一方法
        
        Args:
            data_date: 数据日期，格式YYYY-MM-DD
            **kwargs: 其他参数，如product_ids等
            
        Returns:
            包含抓取结果的字典
        """
        try:
            target_date = datetime.strptime(data_date, '%Y-%m-%d').date()

            # 使用签名API客户端抓取指定日期的数据（自动处理分页）
            rows = saihu_api_client.fetch_all_pages(
                fetch_func=saihu_api_client.fetch_product_analytics,
                start_date=data_date,
                end_date=data_date,
                page_size=100
            )

            analytics_list: List[ProductAnalytics] = []
            for item in rows:
                try:
                    analytics = ProductAnalytics.from_api_response(item, target_date)
                    if analytics.is_valid():
                        analytics_list.append(analytics)
                except Exception as ex:
                    logger.warning(f"转换产品分析数据失败: {ex}")

            return {
                'status': 'success',
                'data': [item.to_dict() for item in analytics_list],
                'data_count': len(analytics_list),
                'data_date': data_date
            }

        except Exception as e:
            logger.error(f"按日期抓取产品分析数据失败: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'data_date': data_date
            }

    def scrape(self, **kwargs) -> Dict[str, Any]:
        """
        抓取产品分析数据的统一方法
        
        Returns:
            包含抓取结果的字典
        """
        try:
            # 默认抓取昨天的数据（使用签名API客户端，自动分页）
            yesterday = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')

            rows = saihu_api_client.fetch_all_pages(
                fetch_func=saihu_api_client.fetch_product_analytics,
                start_date=yesterday,
                end_date=yesterday,
                page_size=100
            )

            analytics_list: List[ProductAnalytics] = []
            target_date = datetime.strptime(yesterday, '%Y-%m-%d').date()
            for item in rows:
                try:
                    analytics = ProductAnalytics.from_api_response(item, target_date)
                    if analytics.is_valid():
                        analytics_list.append(analytics)
                except Exception as ex:
                    logger.warning(f"转换产品分析数据失败: {ex}")

            return {
                'status': 'success',
                'data': [item.to_dict() for item in analytics_list],
                'data_count': len(analytics_list),
                'data_date': yesterday
            }

        except Exception as e:
            logger.error(f"抓取产品分析数据失败: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }

    def get_data_summary(self, analytics_list: List[ProductAnalytics]) -> Dict[str, Any]:
        """获取数据摘要统计"""
        if not analytics_list:
            return {}
        
        from collections import defaultdict
        from decimal import Decimal
        
        summary = {
            'total_records': len(analytics_list),
            'date_range': {
                'start': min(item.data_date for item in analytics_list).isoformat(),
                'end': max(item.data_date for item in analytics_list).isoformat()
            },
            'products': list(set(item.product_id for item in analytics_list)),
            'metrics': {
                'total_sales_amount': sum(item.sales_amount or Decimal('0') for item in analytics_list),
                'total_sales_quantity': sum(item.sales_quantity or 0 for item in analytics_list),
                'total_impressions': sum(item.impressions or 0 for item in analytics_list),
                'total_clicks': sum(item.clicks or 0 for item in analytics_list)
            }
        }
        
        # 计算平均值
        if summary['total_records'] > 0:
            summary['averages'] = {
                'avg_conversion_rate': sum(item.conversion_rate or Decimal('0') for item in analytics_list) / summary['total_records'],
                'avg_acos': sum(item.acos or Decimal('0') for item in analytics_list) / summary['total_records']
            }
        
        return summary