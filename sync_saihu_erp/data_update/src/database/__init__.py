# database模块初始化
from .connection import DatabaseManager

# 创建全局数据库管理器实例
db_manager = DatabaseManager()

# 创建get_db_session函数作为兼容性包装
def get_db_session():
    """获取数据库会话的兼容性函数"""
    return db_manager.get_connection()

__all__ = ['DatabaseManager', 'db_manager', 'get_db_session']