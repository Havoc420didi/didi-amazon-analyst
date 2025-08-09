"""
数据库配置模块
"""
from typing import Dict, Any
from .settings import settings

class DatabaseConfig:
    """数据库配置管理类"""
    
    @staticmethod
    def get_connection_params() -> Dict[str, Any]:
        """获取数据库连接参数"""
        db_config = settings.get('database', {})
        
        return {
            'host': db_config.get('host', 'localhost'),
            'port': db_config.get('port', 5432),
            'user': db_config.get('user', 'amazon_analyst'),
            'password': db_config.get('password', 'amazon_analyst_2024'),
            'database': db_config.get('database', 'amazon_analyst'),
            'charset': db_config.get('charset', 'utf8'),
            'autocommit': False,
            'cursorclass': None
        }
    
    @staticmethod
    def get_pool_params() -> Dict[str, Any]:
        """获取连接池参数"""
        db_config = settings.get('database', {})
        
        return {
            'pool_size': db_config.get('pool_size', 10),
            'max_overflow': db_config.get('max_overflow', 20),
            'pool_pre_ping': db_config.get('pool_pre_ping', True),
            'pool_recycle': db_config.get('pool_recycle', 3600),
            'pool_timeout': db_config.get('pool_timeout', 30)
        }
    
    @staticmethod
    def get_connection_url() -> str:
        """获取数据库连接URL"""
        params = DatabaseConfig.get_connection_params()
        
        url = (f"postgresql+psycopg2://{params['user']}:{params['password']}"
               f"@{params['host']}:{params['port']}/{params['database']}")
        # Updated to use PostgreSQL connection string
        
        return url