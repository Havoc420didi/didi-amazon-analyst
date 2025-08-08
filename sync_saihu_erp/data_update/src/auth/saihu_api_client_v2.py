"""
赛狐ERP API客户端V2版本
支持新的产品分析接口和OAuth2+签名认证
"""
import hashlib
import hmac
import json
import time
import logging
import requests
from datetime import datetime
from typing import Dict, Any, Optional, List
from urllib.parse import urlencode, urlparse

logger = logging.getLogger(__name__)

class SaihuApiClientV2:
    """赛狐ERP API客户端V2版本"""
    
    def __init__(self, config: Dict[str, Any]):
        """初始化API客户端"""
        self.base_url = config.get('base_url', 'https://openapi.sellfox.com')
        self.timeout = config.get('timeout', 60)
        self.retry_count = config.get('retry_count', 3)
        self.retry_delay = config.get('retry_delay', 1)
        
        # 认证配置
        self.auth_config = config.get('auth', {})
        self.client_id = self.auth_config.get('client_id')
        self.client_secret = self.auth_config.get('client_secret')
        self.sign_key = self.auth_config.get('sign_key', '')
        self.timestamp_key = self.auth_config.get('timestamp_key', 'timestamp')
        self.sign_key_param = self.auth_config.get('sign_key_param', 'sign')
        
        # 会话配置
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': config.get('user_agent', 'SaihuERP-DataSync/1.0'),
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
    
    def _generate_signature(self, params: Dict[str, Any], timestamp: int) -> str:
        """生成请求签名"""
        # 按照API文档要求生成签名
        # 1. 对参数进行排序
        sorted_params = sorted(params.items())
        
        # 2. 构建参数字符串
        param_string = '&'.join([f"{k}={v}" for k, v in sorted_params if v != ''])
        
        # 3. 添加时间戳
        sign_string = f"{param_string}&{self.timestamp_key}={timestamp}"
        
        # 4. 使用HMAC-SHA256生成签名
        if self.sign_key:
            signature = hmac.new(
                self.sign_key.encode('utf-8'),
                sign_string.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
        else:
            # 如果没有签名密钥，使用简单的MD5
            signature = hashlib.md5(sign_string.encode('utf-8')).hexdigest()
            
        return signature
    
    def _prepare_request_params(self, endpoint: str, method: str, 
                               query_params: Dict[str, Any] = None,
                               json_data: Dict[str, Any] = None) -> tuple:
        """准备请求参数"""
        
        # 基础参数
        params = {
            'client_id': self.client_id,
            self.timestamp_key: str(int(time.time()))
        }
        
        # 添加查询参数
        if query_params:
            params.update(query_params)
        
        # 生成签名
        signature = self._generate_signature(params, int(params[self.timestamp_key]))
        params[self.sign_key_param] = signature
        
        # 构建完整URL
        url = f"{self.base_url.rstrip('/')}{endpoint}"
        
        return url, params, json_data
    
    def _make_request(self, endpoint: str, method: str = 'GET',
                     query_params: Dict[str, Any] = None,
                     json_data: Dict[str, Any] = None,
                     timeout: Optional[int] = None) -> Dict[str, Any]:
        """发送HTTP请求"""
        
        url, params, json_body = self._prepare_request_params(
            endpoint, method, query_params, json_data
        )
        
        timeout = timeout or self.timeout
        
        for attempt in range(self.retry_count + 1):
            try:
                logger.info(f"🔄 请求尝试 {attempt + 1}/{self.retry_count + 1}: {method} {url}")
                
                if method.upper() == 'GET':
                    response = self.session.get(
                        url, 
                        params=params, 
                        timeout=timeout
                    )
                elif method.upper() == 'POST':
                    # POST请求：查询参数在URL，JSON数据在body
                    response = self.session.post(
                        url,
                        params=params,
                        json=json_body,
                        timeout=timeout
                    )
                else:
                    raise ValueError(f"不支持的HTTP方法: {method}")
                
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"✅ 请求成功: {response.status_code}")
                return result
                
            except requests.exceptions.RequestException as e:
                logger.warning(f"⚠️ 请求失败 (尝试 {attempt + 1}): {e}")
                if attempt < self.retry_count:
                    time.sleep(self.retry_delay * (attempt + 1))
                else:
                    logger.error(f"❌ 所有重试都失败: {e}")
                    raise
    
    def get_product_analytics(self, date_str: str, 
                            marketplace: str = None,
                            asin_list: List[str] = None,
                            page: int = 1,
                            page_size: int = 100) -> Dict[str, Any]:
        """获取产品分析数据"""
        
        # 构建查询参数
        query_params = {
            'date': date_str,
            'page': str(page),
            'pageSize': str(page_size)
        }
        
        if marketplace:
            query_params['marketplace'] = marketplace
        
        # 构建请求体
        json_data = {}
        if asin_list:
            json_data['asinList'] = asin_list
        
        # 导入原有的OAuth客户端
        from .oauth_client import oauth_client
        
        return oauth_client.make_authenticated_request(
            method='GET',
            endpoint='/api/productAnalyze/new/pageList.json',
            params=query_params
        )
    
    def test_connection(self) -> bool:
        """测试API连接"""
        try:
            # 使用一个小的日期测试连接
            test_date = datetime.now().strftime('%Y-%m-%d')
            result = self.get_product_analytics(test_date, page=1, page_size=1)
            
            if result and 'code' in result:
                return str(result['code']) == '200'
            
            return False
            
        except Exception as e:
            logger.error(f"连接测试失败: {e}")
            return False
    
    def validate_advertising_fields(self, response_data: Dict[str, Any]) -> Dict[str, Any]:
        """验证广告字段是否存在于响应中"""
        
        validation_result = {
            'has_ad_data': False,
            'ad_fields_found': [],
            'ad_fields_missing': [],
            'sample_data': None
        }
        
        if not response_data or 'data' not in response_data:
            return validation_result
        
        data = response_data['data']
        if not isinstance(data, list) or not data:
            return validation_result
        
        # 广告字段映射
        ad_fields = [
            'adCostThis', 'adTotalSalesThis', 'cpcThis', 'cpaThis',
            'adOrderNumThis', 'adConversionRateThis', 'adImpressionsThis', 'adClicksThis'
        ]
        
        # 检查第一条记录
        first_item = data[0]
        found_fields = []
        missing_fields = []
        
        for field in ad_fields:
            if field in first_item:
                found_fields.append(field)
            else:
                missing_fields.append(field)
        
        validation_result.update({
            'has_ad_data': len(found_fields) > 0,
            'ad_fields_found': found_fields,
            'ad_fields_missing': missing_fields,
            'sample_data': first_item if found_fields else None
        })
        
        return validation_result
    
    def get_advertising_summary(self, date_str: str) -> Dict[str, Any]:
        """获取广告数据汇总"""
        
        try:
            response = self.get_product_analytics(date_str, page_size=1000)
            
            if not response or 'data' not in response:
                return {'error': '无法获取数据'}
            
            data = response['data']
            if not data:
                return {'error': '数据为空'}
            
            # 统计广告数据
            total_records = len(data)
            ad_cost_sum = 0.0
            ad_sales_sum = 0.0
            records_with_ad_data = 0
            
            for item in data:
                ad_cost = float(item.get('adCostThis', 0) or 0)
                ad_sales = float(item.get('adTotalSalesThis', 0) or 0)
                
                if ad_cost > 0 or ad_sales > 0:
                    records_with_ad_data += 1
                    ad_cost_sum += ad_cost
                    ad_sales_sum += ad_sales
            
            return {
                'date': date_str,
                'total_records': total_records,
                'records_with_ad_data': records_with_ad_data,
                'ad_coverage_rate': (records_with_ad_data / total_records * 100) if total_records > 0 else 0,
                'total_ad_cost': ad_cost_sum,
                'total_ad_sales': ad_sales_sum,
                'avg_ad_cost': ad_cost_sum / records_with_ad_data if records_with_ad_data > 0 else 0,
                'avg_ad_sales': ad_sales_sum / records_with_ad_data if records_with_ad_data > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"获取广告汇总失败: {e}")
            return {'error': str(e)}