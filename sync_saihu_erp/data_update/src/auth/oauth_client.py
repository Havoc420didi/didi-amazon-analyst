"""
赛狐ERP OAuth2认证客户端
基于官方API文档实现的认证管理
"""
import requests
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from ..config.secure_config import config

logger = logging.getLogger(__name__)

class OAuthClient:
    """OAuth2认证客户端"""
    
    def __init__(self):
        """初始化OAuth客户端"""
        # 使用安全配置获取凭据
        api_credentials = config.get_api_credentials()
        self.base_url = api_credentials.base_url
        self.client_id = api_credentials.client_id
        self.client_secret = api_credentials.client_secret
        self.auth_endpoint = '/api/oauth/v2/token.json'
        
        # Token缓存
        self._access_token = None
        self._token_expires_at = None
        self._token_lock = False
        
        logger.info("OAuth2客户端初始化完成")
    
    def get_access_token(self, force_refresh: bool = False) -> Optional[str]:
        """
        获取访问令牌
        
        Args:
            force_refresh: 是否强制刷新token
            
        Returns:
            访问令牌字符串，失败返回None
        """
        # 检查是否需要刷新token
        if not force_refresh and self._is_token_valid():
            logger.debug("使用缓存的访问令牌")
            return self._access_token
        
        # 防止并发获取token
        if self._token_lock:
            logger.warning("Token获取正在进行中，等待完成")
            # 简单等待机制
            for _ in range(30):  # 最多等待30秒
                time.sleep(1)
                if not self._token_lock and self._is_token_valid():
                    return self._access_token
        
        try:
            self._token_lock = True
            logger.info("开始获取新的访问令牌")
            
            # 构建请求参数
            auth_url = f"{self.base_url}{self.auth_endpoint}"
            params = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "client_credentials"
            }
            
            # 发送认证请求
            response = requests.get(
                auth_url,
                params=params,
                timeout=30,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "SaihuERP-DataSync/1.0"
                }
            )
            
            if response.status_code == 200:
                response_data = response.json()
                
                if response_data.get("code") == 0:
                    data = response_data.get("data", {})
                    access_token = data.get("access_token")
                    expires_in = data.get("expires_in")
                    
                    if access_token:
                        # 缓存token信息
                        self._access_token = access_token
                        
                        # 计算过期时间 (注意：expires_in可能是秒数或毫秒时间戳)
                        if expires_in:
                            if expires_in > 86400000:  # 如果大于24小时的毫秒数，认为是时间戳
                                self._token_expires_at = datetime.fromtimestamp(expires_in / 1000)
                            else:  # 否则认为是秒数
                                self._token_expires_at = datetime.now() + timedelta(seconds=expires_in)
                        else:
                            # 默认24小时有效期
                            self._token_expires_at = datetime.now() + timedelta(hours=24)
                        
                        logger.info(f"访问令牌获取成功，过期时间: {self._token_expires_at}")
                        return access_token
                    else:
                        logger.error("响应中未找到access_token")
                        return None
                else:
                    logger.error(f"API返回错误: {response_data.get('code')} - {response_data.get('msg')}")
                    return None
            else:
                logger.error(f"HTTP请求失败: {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"认证请求异常: {e}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析异常: {e}")
            return None
        except Exception as e:
            logger.error(f"获取访问令牌时发生未知异常: {e}")
            return None
        finally:
            self._token_lock = False
    
    def _is_token_valid(self) -> bool:
        """检查当前token是否有效"""
        if not self._access_token or not self._token_expires_at:
            return False
        
        # 提前5分钟刷新token
        return datetime.now() < (self._token_expires_at - timedelta(minutes=5))
    
    def get_authenticated_headers(self) -> Dict[str, str]:
        """
        获取包含认证信息的请求头
        
        Returns:
            包含Authorization头的字典
        """
        access_token = self.get_access_token()
        
        if not access_token:
            logger.error("无法获取有效的访问令牌")
            return {}
        
        return {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "SaihuERP-DataSync/1.0"
        }
    
    def make_authenticated_request(self, 
                                 method: str,
                                 endpoint: str,
                                 params: Optional[Dict] = None,
                                 data: Optional[Dict] = None,
                                 timeout: int = 30) -> Optional[requests.Response]:
        """
        发起带认证的API请求
        
        Args:
            method: HTTP方法 (GET, POST, PUT, DELETE)
            endpoint: API端点路径
            params: URL参数
            data: 请求体数据
            timeout: 超时时间
            
        Returns:
            Response对象，失败返回None
        """
        headers = self.get_authenticated_headers()
        
        if not headers:
            logger.error("无法获取认证头，请求终止")
            return None
        
        url = f"{self.base_url}{endpoint}"
        
        try:
            logger.debug(f"发起认证请求: {method} {url}")
            
            response = requests.request(
                method=method.upper(),
                url=url,
                params=params,
                json=data if method.upper() in ['POST', 'PUT', 'PATCH'] else None,
                headers=headers,
                timeout=timeout
            )
            
            # 检查是否是认证错误
            if response.status_code == 401:
                logger.warning("收到401响应，尝试刷新token后重试")
                
                # 强制刷新token
                new_token = self.get_access_token(force_refresh=True)
                
                if new_token:
                    # 更新请求头并重试
                    headers = self.get_authenticated_headers()
                    response = requests.request(
                        method=method.upper(),
                        url=url,
                        params=params,
                        json=data if method.upper() in ['POST', 'PUT', 'PATCH'] else None,
                        headers=headers,
                        timeout=timeout
                    )
                else:
                    logger.error("Token刷新失败，无法重试请求")
            
            return response
            
        except requests.exceptions.RequestException as e:
            logger.error(f"认证请求异常: {e}")
            return None
    
    def test_connection(self) -> bool:
        """测试API连接和认证"""
        try:
            access_token = self.get_access_token()
            return access_token is not None
        except Exception as e:
            logger.error(f"连接测试失败: {e}")
            return False
    
    def get_token_info(self) -> Dict[str, Any]:
        """获取当前token信息"""
        return {
            "has_token": self._access_token is not None,
            "token_valid": self._is_token_valid(),
            "expires_at": self._token_expires_at.isoformat() if self._token_expires_at else None,
            "token_preview": f"{self._access_token[:8]}..." if self._access_token else None
        }
    
    def clear_token_cache(self) -> None:
        """清除token缓存"""
        self._access_token = None
        self._token_expires_at = None
        logger.info("Token缓存已清除")


# 全局OAuth客户端实例
oauth_client = OAuthClient()