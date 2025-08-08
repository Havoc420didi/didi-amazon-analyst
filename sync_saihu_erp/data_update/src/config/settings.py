"""
配置管理模块
处理系统配置的加载、验证和管理
"""
import os
import yaml
import json
from typing import Dict, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class Settings:
    """系统设置管理类"""
    
    def __init__(self, config_file: Optional[str] = None):
        """初始化配置管理器"""
        self.config_file = config_file or self._get_default_config_path()
        self._config = {}
        self.load_config()
    
    def _get_default_config_path(self) -> str:
        """获取默认配置文件路径"""
        project_root = Path(__file__).parent.parent.parent
        return str(project_root / "config" / "config.yml")
    
    def load_config(self) -> None:
        """加载配置文件"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    if self.config_file.endswith('.yml') or self.config_file.endswith('.yaml'):
                        self._config = yaml.safe_load(f) or {}
                    elif self.config_file.endswith('.json'):
                        self._config = json.load(f)
                    else:
                        raise ValueError(f"不支持的配置文件格式: {self.config_file}")
                logger.info(f"配置文件加载成功: {self.config_file}")
            else:
                logger.warning(f"配置文件不存在，使用默认配置: {self.config_file}")
                self._config = self._get_default_config()
        except Exception as e:
            logger.error(f"配置文件加载失败: {e}")
            self._config = self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """获取默认配置"""
        return {
            'database': {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': int(os.getenv('DB_PORT', '3306')),
                'user': os.getenv('DB_USER', 'root'),
                'password': os.getenv('DB_PASSWORD', ''),
                'database': os.getenv('DB_NAME', 'saihu_erp_sync'),
                'charset': 'utf8mb4',
                'pool_size': 10,
                'pool_pre_ping': True,
                'pool_recycle': 3600
            },
            'api': {
                'base_url': os.getenv('API_BASE_URL', 'https://api.saihu-erp.com'),
                'timeout': 60,
                'retry_count': 3,
                'retry_delay': 1,
                'auth': {
                    'type': 'bearer',
                    'token': os.getenv('API_TOKEN', ''),
                    'username': os.getenv('API_USERNAME', ''),
                    'password': os.getenv('API_PASSWORD', '')
                }
            },
            'sync': {
                'batch_size': 500,
                'max_history_days': 30,
                'enable_validation': True,
                'parallel_workers': 4
            },
            'scheduler': {
                'timezone': 'Asia/Shanghai',
                'max_instances': 1,
                'coalesce': True,
                'misfire_grace_time': 300
            },
            'logging': {
                'level': 'INFO',
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                'file': 'logs/sync.log',
                'max_size': '10MB',
                'backup_count': 5
            }
        }
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取配置值，支持点号分隔的嵌套key"""
        keys = key.split('.')
        value = self._config
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, key: str, value: Any) -> None:
        """设置配置值"""
        keys = key.split('.')
        config = self._config
        
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        config[keys[-1]] = value
    
    def save_config(self, file_path: Optional[str] = None) -> None:
        """保存配置到文件"""
        file_path = file_path or self.config_file
        
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                yaml.dump(self._config, f, default_flow_style=False, allow_unicode=True)
            
            logger.info(f"配置文件保存成功: {file_path}")
        except Exception as e:
            logger.error(f"配置文件保存失败: {e}")
            raise
    
    def validate_config(self) -> bool:
        """验证配置的有效性"""
        try:
            # 验证数据库配置
            db_config = self.get('database', {})
            required_db_fields = ['host', 'port', 'user', 'database']
            for field in required_db_fields:
                if not db_config.get(field):
                    logger.error(f"数据库配置缺少必要字段: {field}")
                    return False
            
            # 验证API配置
            api_config = self.get('api', {})
            if not api_config.get('base_url'):
                logger.error("API配置缺少base_url")
                return False
            
            # 验证同步配置
            sync_config = self.get('sync', {})
            batch_size = sync_config.get('batch_size', 0)
            if not isinstance(batch_size, int) or batch_size <= 0:
                logger.error("同步配置batch_size必须为正整数")
                return False
            
            logger.info("配置验证通过")
            return True
            
        except Exception as e:
            logger.error(f"配置验证失败: {e}")
            return False
    
    def get_all(self) -> Dict[str, Any]:
        """获取所有配置"""
        return self._config.copy()
    
    def update(self, new_config: Dict[str, Any]) -> None:
        """更新配置"""
        self._deep_update(self._config, new_config)
    
    def _deep_update(self, original: Dict, updates: Dict) -> None:
        """深度更新字典"""
        for key, value in updates.items():
            if isinstance(value, dict) and key in original and isinstance(original[key], dict):
                self._deep_update(original[key], value)
            else:
                original[key] = value


# 全局配置实例
settings = Settings()