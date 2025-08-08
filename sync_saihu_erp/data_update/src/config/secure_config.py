"""
安全配置管理模块
安全地管理所有敏感配置和验证
"""
import os
import json
from typing import Optional, Dict, Any
from dataclasses import dataclass

@dataclass
class APICredentials:
    client_id: str
    client_secret: str
    base_url: str = "https://openapi.sellfox.com"

@dataclass  
class SyncConfig:
    max_retries: int = 3
    batch_size: int = 100
    timeout: int = 30
    rate_limit_delay: float = 1.0
    enable_debug: bool = False

class SecureConfig:
    """安全配置管理器，防止敏感信息泄露"""
    
    def __init__(self):
        self.env = os.getenv('ENVIRONMENT', 'development')
        self._validate_environment()
    
    def _validate_environment(self) -> None:
        """验证环境配置完整性"""
        required_vars = [
            'SELLFOX_CLIENT_ID',
            'SELLFOX_CLIENT_SECRET',
            'DATABASE_URL'
        ]
        
        missing_vars = []
        for var in required_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            raise ValueError(
                f"缺少必需的环境变量: {', '.join(missing_vars)}. "
                f"请参考 .env.example 文件配置"
            )
    
    def get_api_credentials(self) -> APICredentials:
        """获取API认证凭据"""
        prefix = 'SELLFOX'
        
        client_id = os.getenv(f'{prefix}_CLIENT_ID')
        client_secret = os.getenv(f'{prefix}_CLIENT_SECRET')
        
        if not client_id or not client_secret:
            raise ValueError("缺少sellfox.com的API认证凭据")
            
        return APICredentials(
            client_id=client_id,
            client_secret=client_secret
        )
    
    def get_sync_config(self) -> SyncConfig:
        """获取同步配置"""
        return SyncConfig(
            max_retries=int(os.getenv('MAX_RETRY_ATTEMPTS', '3')),
            batch_size=int(os.getenv('SYNC_BATCH_SIZE', '100')),
            timeout=int(os.getenv('SYNC_TIMEOUT', '30')),
            rate_limit_delay=float(os.getenv('RATE_LIMIT_DELAY', '1.0')),
            enable_debug=os.getenv('ENVIRONMENT', 'development') == 'development'
        )
    
    def is_production(self) -> bool:
        """是否为生产环境"""
        return self.env == 'production'
    
    def sanitize_config(self) -> Dict[str, Any]:
        """返回经过安全处理的配置概览"""
        creds = self.get_api_credentials()
        sync_config = self.get_sync_config()
        
        return {
            'base_url': creds.base_url,
            'max_retries': sync_config.max_retries,
            'batch_size': sync_config.batch_size,
            'timeout': sync_config.timeout,
            'enabled': True,
            'environment': self.env,
            'debug_mode': sync_config.enable_debug
        }

# 全局配置实例
config = SecureConfig()