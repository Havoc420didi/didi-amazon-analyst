"""
安全配置管理模块
安全地管理所有敏感配置和验证
"""
import os
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass

from decouple import AutoConfig
from .settings import settings

logger = logging.getLogger(__name__)

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
        # 环境变量验证不再强制抛错，避免在凭据通过其他渠道提供时阻断启动
        self._validate_environment()
        # 初始化 .env 读取器，搜索仓库根目录
        try:
            project_root = Path(__file__).resolve().parents[4]
        except IndexError:
            project_root = Path.cwd()
        self._auto_config = AutoConfig(search_path=str(project_root))
    
    def _validate_environment(self) -> None:
        """验证环境配置完整性（仅记录告警，不强制报错）"""
        maybe_missing = []
        for var in ['SELLFOX_CLIENT_ID', 'SELLFOX_CLIENT_SECRET', 'DATABASE_URL']:
            if not os.getenv(var):
                maybe_missing.append(var)
        if maybe_missing:
            logger.warning(
                "环境变量可能缺失: %s。将尝试从 .env 与 config.yml 回退加载。",
                ", ".join(maybe_missing),
            )
    
    def get_api_credentials(self) -> APICredentials:
        """获取API认证凭据"""
        prefix = 'SELLFOX'

        # 1) 优先从仓库根目录的 .env / 环境变量读取
        client_id = None
        client_secret = None
        try:
            client_id = self._auto_config(f'{prefix}_CLIENT_ID', default=None)
            client_secret = self._auto_config(f'{prefix}_CLIENT_SECRET', default=None)
        except Exception:
            # 兜底使用 os.getenv
            client_id = os.getenv(f'{prefix}_CLIENT_ID')
            client_secret = os.getenv(f'{prefix}_CLIENT_SECRET')

        # 2) 回退到 config.yml 中的配置（可选）
        if not client_id or not client_secret:
            yaml_client_id = settings.get('api.client_id')
            yaml_client_secret = settings.get('api.client_secret')
            client_id = client_id or yaml_client_id
            client_secret = client_secret or yaml_client_secret

        # 最终校验
        if not client_id or not client_secret:
            raise ValueError(
                "缺少 SELLFOX API 凭据。请在项目根目录 .env 配置 SELLFOX_CLIENT_ID/SELLFOX_CLIENT_SECRET，"
                "或在 sync_saihu_erp/data_update/config/config.yml 的 api 下提供 client_id/client_secret。"
            )

        # 基础URL优先采用 config.yml，可被 .env 的 API_BASE_URL 覆盖
        base_url = (
            os.getenv('API_BASE_URL')
            or settings.get('api.base_url', 'https://openapi.sellfox.com')
            or 'https://openapi.sellfox.com'
        )

        return APICredentials(
            client_id=client_id,
            client_secret=client_secret,
            base_url=base_url,
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