"""
安全API客户端 - 带重试机制和错误处理
"""
import requests
import time
import logging
from typing import Optional, Dict, Any, List
from functools import wraps
from src.config.secure_config import config

class SecureAPIClient:
    """带重试、错误处理和日志记录的安全API客户端"""
    
    def __init__(self):
        self.config = config.get_sync_config()
        self.api_creds = config.get_api_credentials()
        self.logger = logging.getLogger(__name__)
        self._access_token: Optional[str] = None
        self._token_expires: int = 0
    
    def _authenticate(self) -> bool:
        """重新认证并获取访问令牌"""
        try:
            params = {
                "client_id": self.api_creds.client_id,
                "client_secret": self.api_creds.client_secret,
                "grant_type": "client_credentials"
            }
            
            response = requests.get(
                f"{self.api_creds.base_url}/api/oauth/v2/token.json",
                params=params,
                timeout=30
            )
            
            data = response.json()
            
            if data.get("code") == 0:
                self._access_token = data["data"]["access_token"]
                expires_in = data["data"].get("expires_in", 3600)
                self._token_expires = int(time.time()) + expires_in - 60  # 提前60秒过期
                self.logger.info("🔑 OAuth认证成功")
                return True
            else:
                self.logger.error(f"❌ OAuth失败: {data.get('msg')}")
                return False
                
        except Exception as e:
            self.logger.error(f"OAuth异常: {e}")
            return False
    
    def _ensure_token(self, force_refresh: bool = False) -> bool:
        """确保有有效令牌"""
        if force_refresh or not self._access_token or time.time() >= self._token_expires:
            return self._authenticate()
        return True
    
    def _retry_with_backoff(self, func, max_retries: int = None):
        """带重试的装饰器"""
        max_retries = max_retries or self.config.max_retries
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    # 确保有有效令牌
                    if not self._ensure_token(attempt > 0):
                        raise Exception("身份验证失败")
                    
                    # 执行函数
                    result = func(*args, **kwargs)
                    
                    # 验证响应
                    if isinstance(result, dict) and result.get("code") == 0:
                        return result
                    elif isinstance(result, dict):
                        raise Exception(f"API返回错误: {result.get('msg')}")
                    else:
                        return result
                        
                except (requests.Timeout, requests.ConnectionError) as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt * self.config.rate_limit_delay
                        self.logger.warning(f"第{attempt+1}次重试前等待{wait_time:.1f}s: {e}")
                        time.sleep(wait_time)
                    else:
                        self.logger.error(f"❌ 最终重试失败: {e}")
                        raise
                except requests.HTTPError as e:
                    last_exception = e
                    if e.response.status_code in [429, 503]:  # 限流或服务不可用
                        if attempt < max_retries - 1:
                            time.sleep(5)  # 更长等待时间
                            continue
                    raise
                
            if last_exception:
                raise last_exception
                
        return wrapper
    
    @_retry_with_backoff
    def get_oauth_token(self) -> Dict[str, Any]:
        """获取OAuth令牌"""
        params = {
            "client_id": self.api_creds.client_id,
            "client_secret": self.api_creds.client_secret,
            "grant_type": "client_credentials"
        }
        
        response = requests.get(
            f"{self.api_creds.base_url}/api/oauth/v2/token.json",
            params=params,
            timeout=self.config.timeout
        )
        return response.json()
    
    @_retry_with_backoff
    def post_data(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """POST请求封装"""
        if not self._access_token:
            raise Exception("未认证或令牌过期")
            
        headers = {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{self.api_creds.base_url}{endpoint}",
            json=data,
            headers=headers,
            timeout=self.config.timeout
        )
        
        # 检查响应状态
        response.raise_for_status()
        result = response.json()
        
        # 验证响应格式
        if isinstance(result, dict) and "code" in result:
            return result
        
        # 兼容旧API格式
        return {"code": 0, "data": result}
    
    def fetch_paginated_data(self, endpoint: str, params: Dict[str, Any],
                           page_size: int = 100) -> List[Dict[str, Any]]:
        """分页获取所有数据"""
        all_records = []
        page_no = 1
        total_records = 0
        
        while True:
            request_params = {
                **params,
                "pageNo": page_no,
                "pageSize": page_size
            }
            
            try:
                result = self.post_data(endpoint, request_params)
                
                if result.get("code") == 0:
                    records = result["data"]["rows"]
                    if not records:
                        break
                    
                    all_records.extend(records)
                    total_records += len(records)
                    
                    # 检查分页信息
                    total_page = result["data"].get("totalPage", 1)
                    if page_no >= total_page:
                        break
                        
                    page_no += 1
                    
                    # 控制请求频率
                    time.sleep(self.config.rate_limit_delay)
                    
                else:
                    raise Exception(f"API返回错误: {result.get('msg')}")
                    
            except Exception as e:
                self.logger.error(f"分页获取数据失败: {e}")
                raise
        
        self.logger.info(f"✅ 成功获取{len(all_records)}条记录")
        return all_records

# 全局客户端实例
api_client = SecureAPIClient()