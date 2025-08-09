"""
API配置模块
"""
from typing import Dict, Any, Optional
from .settings import settings

class ApiConfig:
    """API配置管理类"""
    
    @staticmethod
    def get_base_config() -> Dict[str, Any]:
        """获取基础API配置"""
        api_config = settings.get('api', {})
        
        return {
            'base_url': api_config.get('base_url', 'https://openapi.sellfox.com'),

            'timeout': api_config.get('timeout', 60),
            'retry_count': api_config.get('retry_count', 3),
            'retry_delay': api_config.get('retry_delay', 1),
            'verify_ssl': api_config.get('verify_ssl', True),
            'user_agent': api_config.get('user_agent', 'SaihuERP-DataSync/1.0')
        }
    
    @staticmethod
    def get_auth_config() -> Dict[str, Any]:
        """获取认证配置"""
        auth_config = settings.get('api.auth', {})
        
        return {
            'type': auth_config.get('type', 'bearer'),
            'token': auth_config.get('token', ''),
            'username': auth_config.get('username', ''),
            'password': auth_config.get('password', ''),
            'api_key': auth_config.get('api_key', ''),
            'secret_key': auth_config.get('secret_key', '')
        }
    
    @staticmethod
    def get_endpoint_config(endpoint_name: str) -> Optional[Dict[str, Any]]:
        """获取特定接口端点配置"""
        endpoints = settings.get('api.endpoints', {})
        return endpoints.get(endpoint_name)
    
    @staticmethod
    def get_headers() -> Dict[str, str]:
        """获取HTTP请求头"""
        base_config = ApiConfig.get_base_config()
        auth_config = ApiConfig.get_auth_config()
        
        headers = {
            'User-Agent': base_config['user_agent'],
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        
        # 根据认证类型添加认证头
        if auth_config['type'] == 'bearer' and auth_config['token']:
            headers['Authorization'] = f"Bearer {auth_config['token']}"
        elif auth_config['type'] == 'api_key' and auth_config['api_key']:
            headers['X-API-Key'] = auth_config['api_key']
        elif auth_config['type'] == 'basic' and auth_config['username']:
            import base64
            credentials = base64.b64encode(
                f"{auth_config['username']}:{auth_config['password']}".encode()
            ).decode()
            headers['Authorization'] = f"Basic {credentials}"
        
        return headers
    
    @staticmethod
    def get_rate_limit_config() -> Dict[str, Any]:
        """获取限流配置"""
        return {
            'requests_per_minute': settings.get('api.rate_limit.requests_per_minute', 100),
            'requests_per_hour': settings.get('api.rate_limit.requests_per_hour', 5000),
            'burst_size': settings.get('api.rate_limit.burst_size', 10),
            'backoff_factor': settings.get('api.rate_limit.backoff_factor', 0.5)
        }
