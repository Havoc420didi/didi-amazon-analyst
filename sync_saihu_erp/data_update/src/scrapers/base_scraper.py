"""
基础数据抓取器
提供通用的HTTP请求功能和错误处理
"""
import time
import requests
import logging
from typing import Dict, Any, Optional, List
from abc import ABC, abstractmethod
from datetime import datetime, date
from ..config import ApiConfig
from ..parsers import ApiTemplate
from ..auth import OAuthClient

logger = logging.getLogger(__name__)

class BaseScraper(ABC):
    """基础数据抓取器抽象类"""
    
    def __init__(self, api_template: ApiTemplate):
        """初始化抓取器"""
        self.api_template = api_template
        self.session = requests.Session()
        self.base_config = ApiConfig.get_base_config()
        self.auth_config = ApiConfig.get_auth_config()
        self.rate_limit_config = ApiConfig.get_rate_limit_config()
        
        # 初始化OAuth客户端
        self.oauth_client = OAuthClient()
        
        # 设置会话配置
        self.session.headers.update(ApiConfig.get_headers())
        self.session.verify = self.base_config.get('verify_ssl', True)
        
        # 限流控制
        self._last_request_time = 0
        self._request_count = 0
        self._request_window_start = time.time()
        
        logger.info(f"初始化抓取器: {self.__class__.__name__}")
    
    def _check_rate_limit(self) -> None:
        """检查限流控制"""
        current_time = time.time()
        
        # 重置计数窗口
        if current_time - self._request_window_start >= 60:
            self._request_count = 0
            self._request_window_start = current_time
        
        # 检查请求频率
        requests_per_minute = self.rate_limit_config.get('requests_per_minute', 100)
        if self._request_count >= requests_per_minute:
            sleep_time = 60 - (current_time - self._request_window_start)
            if sleep_time > 0:
                logger.info(f"达到限流限制，等待 {sleep_time:.1f} 秒")
                time.sleep(sleep_time)
                self._request_count = 0
                self._request_window_start = time.time()
        
        # 控制请求间隔
        min_interval = 60.0 / requests_per_minute
        time_since_last = current_time - self._last_request_time
        if time_since_last < min_interval:
            sleep_time = min_interval - time_since_last
            time.sleep(sleep_time)
        
        self._request_count += 1
        self._last_request_time = time.time()
    
    def _make_request(self, 
                     url: str, 
                     method: str = 'GET',
                     params: Optional[Dict[str, Any]] = None,
                     data: Optional[str] = None,
                     headers: Optional[Dict[str, str]] = None,
                     timeout: Optional[int] = None) -> requests.Response:
        """发起HTTP请求"""
        self._check_rate_limit()
        
        # 设置超时
        request_timeout = timeout or self.api_template.timeout or self.base_config.get('timeout', 30)
        
        # 获取相对端点（去掉base_url部分）
        if url.startswith(self.base_config.get('base_url', '')):
            endpoint = url[len(self.base_config.get('base_url', '')):]
        else:
            endpoint = url
        
        try:
            # 处理请求体数据格式
            request_data = None
            if method.upper() in ['POST', 'PUT', 'PATCH'] and data:
                if isinstance(data, str):
                    try:
                        import json
                        request_data = json.loads(data)
                    except json.JSONDecodeError:
                        logger.error(f"无法解析请求体JSON: {data}")
                        request_data = {}
                else:
                    request_data = data
            
            # 使用OAuth客户端发起认证请求
            response = self.oauth_client.make_authenticated_request(
                method=method,
                endpoint=endpoint,
                params=params,
                data=request_data,
                timeout=request_timeout
            )
            
            if response is None:
                raise Exception("OAuth认证请求失败")
            
            logger.debug(f"API请求: {method} {url} -> {response.status_code}")
            return response
            
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP请求失败: {e}")
            raise
    
    def _make_request_with_retry(self,
                               url: str,
                               method: str = 'GET', 
                               params: Optional[Dict[str, Any]] = None,
                               data: Optional[str] = None,
                               headers: Optional[Dict[str, str]] = None,
                               timeout: Optional[int] = None) -> requests.Response:
        """带重试的HTTP请求"""
        retry_count = self.api_template.retry_count or self.base_config.get('retry_count', 3)
        retry_delay = self.base_config.get('retry_delay', 1)
        
        last_exception = None
        
        for attempt in range(retry_count + 1):
            try:
                response = self._make_request(url, method, params, data, headers, timeout)
                
                # 检查HTTP状态码
                if response.status_code == 200:
                    return response
                elif response.status_code == 429:  # Too Many Requests
                    if attempt < retry_count:
                        retry_after = int(response.headers.get('Retry-After', retry_delay * (2 ** attempt)))
                        logger.warning(f"请求被限流 (429)，等待 {retry_after} 秒后重试")
                        time.sleep(retry_after)
                        continue
                elif response.status_code >= 500:  # Server Error
                    if attempt < retry_count:
                        wait_time = retry_delay * (2 ** attempt)  # 指数退避
                        logger.warning(f"服务器错误 ({response.status_code})，{wait_time} 秒后重试")
                        time.sleep(wait_time)
                        continue
                
                # 其他错误状态码
                response.raise_for_status()
                return response
                
            except requests.exceptions.Timeout as e:
                last_exception = e
                if attempt < retry_count:
                    wait_time = retry_delay * (2 ** attempt)
                    logger.warning(f"请求超时，{wait_time} 秒后重试 (第 {attempt + 1} 次)")
                    time.sleep(wait_time)
                else:
                    logger.error(f"请求超时，已达到最大重试次数: {e}")
            
            except requests.exceptions.ConnectionError as e:
                last_exception = e
                if attempt < retry_count:
                    wait_time = retry_delay * (2 ** attempt)
                    logger.warning(f"连接错误，{wait_time} 秒后重试 (第 {attempt + 1} 次)")
                    time.sleep(wait_time)
                else:
                    logger.error(f"连接错误，已达到最大重试次数: {e}")
            
            except Exception as e:
                last_exception = e
                logger.error(f"请求失败: {e}")
                break
        
        # 所有重试都失败
        if last_exception:
            raise last_exception
        else:
            raise Exception("HTTP请求失败，已达到最大重试次数")
    
    def _parse_response(self, response: requests.Response) -> Any:
        """解析响应数据"""
        try:
            content_type = response.headers.get('Content-Type', '').lower()
            
            if 'application/json' in content_type:
                return response.json()
            elif 'text/' in content_type:
                return response.text
            else:
                return response.content
                
        except ValueError as e:
            logger.error(f"响应解析失败: {e}")
            return response.text
    
    def _validate_response_data(self, data: Any) -> bool:
        """验证响应数据的有效性"""
        if data is None:
            return False
        
        # 检查是否为错误响应
        if isinstance(data, dict):
            if data.get('error') or data.get('code') != 200:
                error_msg = data.get('message', data.get('error', '未知错误'))
                logger.error(f"API返回错误: {error_msg}")
                return False
        
        return True
    
    @abstractmethod
    def fetch_data(self, params: Dict[str, Any] = None) -> List[Any]:
        """抓取数据的抽象方法，子类必须实现"""
        pass
    
    def fetch_data_with_pagination(self, 
                                 params: Dict[str, Any] = None,
                                 page_size: int = 100,
                                 max_pages: int = None) -> List[Any]:
        """支持分页的数据抓取"""
        all_data = []
        page = 1
        
        while True:
            # 构建分页参数
            page_params = (params or {}).copy()
            page_params.update({
                'page': page,
                'page_size': page_size
            })
            
            try:
                page_data = self.fetch_data(page_params)
                
                if not page_data:
                    break
                
                all_data.extend(page_data)
                
                # 检查是否还有更多数据
                if len(page_data) < page_size:
                    break
                
                # 检查最大页数限制
                if max_pages and page >= max_pages:
                    logger.warning(f"已达到最大页数限制: {max_pages}")
                    break
                
                page += 1
                
            except Exception as e:
                logger.error(f"获取第 {page} 页数据失败: {e}")
                break
        
        logger.info(f"分页抓取完成，共获取 {len(all_data)} 条数据")
        return all_data
    
    def test_connection(self) -> bool:
        """测试API连接和OAuth认证"""
        try:
            # 首先测试OAuth认证
            if not self.oauth_client.test_connection():
                logger.error("OAuth认证测试失败")
                return False
            
            # 然后测试API端点连接
            test_url = self.api_template.build_request_url(self.base_config['base_url'])
            
            # 发起简单的HEAD请求测试连接
            response = self._make_request(test_url, method='HEAD', timeout=10)
            
            return response.status_code < 400
            
        except Exception as e:
            logger.error(f"连接测试失败: {e}")
            return False
    
    def close(self) -> None:
        """关闭抓取器，清理资源"""
        if hasattr(self, 'session'):
            self.session.close()
        logger.info(f"抓取器已关闭: {self.__class__.__name__}")
    
    def __enter__(self):
        """上下文管理器入口"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器出口"""
        self.close()