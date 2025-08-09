"""
PostgreSQL数据库连接管理模块
提供PostgreSQL数据库连接池管理和事务处理
"""
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from typing import Optional, Dict, Any, ContextManager, List, Tuple
from contextlib import contextmanager
from threading import Lock
from ..config import Settings

logger = logging.getLogger(__name__)

class PostgreSQLManager:
    """PostgreSQL数据库连接管理器"""
    
    _instance = None
    _lock = Lock()
    
    def __new__(cls):
        """单例模式"""
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化PostgreSQL管理器"""
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self.settings = Settings()
        self.connection_params = self._get_connection_params()
        self.pool_params = self._get_pool_params()
        self._connection_pool = []
        self._pool_lock = Lock()
        self._max_connections = self.pool_params.get('pool_size', 10)
        self._current_connections = 0
        
        logger.info("PostgreSQL管理器初始化完成")
    
    def _get_connection_params(self) -> Dict[str, Any]:
        """获取数据库连接参数"""
        db_config = self.settings.get('database', {})
        return {
            'host': db_config.get('host', 'localhost'),
            'port': db_config.get('port', 5432),
            'user': db_config.get('user', 'postgres'),
            'password': db_config.get('password', ''),
            'dbname': db_config.get('database', 'amazon_analyst'),
            'sslmode': db_config.get('sslmode', 'prefer')
        }
    
    def _get_pool_params(self) -> Dict[str, Any]:
        """获取连接池参数"""
        db_config = self.settings.get('database', {})
        return {
            'pool_size': db_config.get('pool_size', 10),
            'max_overflow': db_config.get('max_overflow', 20),
            'pool_timeout': db_config.get('pool_timeout', 30),
            'pool_pre_ping': db_config.get('pool_pre_ping', True),
            'pool_recycle': db_config.get('pool_recycle', 3600)
        }
    
    def _create_connection(self) -> psycopg2.extensions.connection:
        """创建新的PostgreSQL连接"""
        try:
            connection = psycopg2.connect(**self.connection_params)
            connection.autocommit = False
            
            # 测试连接
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            
            logger.debug("PostgreSQL连接创建成功")
            return connection
            
        except Exception as e:
            logger.error(f"创建PostgreSQL连接失败: {e}")
            raise
    
    def get_connection(self) -> psycopg2.extensions.connection:
        """获取PostgreSQL连接"""
        with self._pool_lock:
            # 尝试从连接池获取连接
            if self._connection_pool:
                connection = self._connection_pool.pop()
                # 检查连接是否有效
                try:
                    connection.status  # 检查连接状态
                    return connection
                except:
                    logger.warning("连接池中的连接已失效，创建新连接")
                    if self._current_connections > 0:
                        self._current_connections -= 1
            
            # 创建新连接
            if self._current_connections < self._max_connections:
                connection = self._create_connection()
                self._current_connections += 1
                return connection
            else:
                raise Exception("连接池已满，无法创建新连接")
    
    def return_connection(self, connection: psycopg2.extensions.connection) -> None:
        """归还PostgreSQL连接到连接池"""
        if connection and connection.closed == 0:  # 连接正常且未关闭
            with self._pool_lock:
                if len(self._connection_pool) < self._max_connections:
                    self._connection_pool.append(connection)
                else:
                    connection.close()
                    self._current_connections -= 1
        else:
            with self._pool_lock:
                self._current_connections -= 1
    
    @contextmanager
    def get_db_connection(self) -> ContextManager[psycopg2.extensions.connection]:
        """获取PostgreSQL连接的上下文管理器"""
        connection = None
        try:
            connection = self.get_connection()
            yield connection
        except Exception as e:
            if connection and connection.closed == 0:
                try:
                    connection.rollback()
                except:
                    pass
            logger.error(f"PostgreSQL操作异常: {e}")
            raise
        finally:
            if connection and connection.closed == 0:
                self.return_connection(connection)
    
    @contextmanager
    def get_db_transaction(self) -> ContextManager[psycopg2.extensions.connection]:
        """获取PostgreSQL事务连接的上下文管理器"""
        connection = None
        try:
            connection = self.get_connection()
            connection.autocommit = False
            yield connection
            connection.commit()
        except Exception as e:
            if connection and connection.closed == 0:
                try:
                    connection.rollback()
                except:
                    pass
            logger.error(f"PostgreSQL事务执行失败: {e}")
            raise
        finally:
            if connection and connection.closed == 0:
                self.return_connection(connection)
    
    def execute_query(self, sql: str, params: Optional[Tuple] = None) -> List[Dict[str, Any]]:
        """执行查询SQL并返回Dict格式结果"""
        with self.get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(sql, params)
                return cursor.fetchall()
    
    def execute_single(self, sql: str, params: Optional[Tuple] = None) -> Optional[Dict[str, Any]]:
        """执行查询单条记录"""
        with self.get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(sql, params)
                return cursor.fetchone()
    
    def execute_update(self, sql: str, params: Optional[Tuple] = None) -> int:
        """执行更新SQL"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, params)
                conn.commit()
                return cursor.rowcount
    
    def execute_batch(self, sql: str, params_list: List[Tuple]) -> int:
        """批量执行SQL"""
        if not params_list:
            return 0
        
        with self.get_db_transaction() as conn:
            with conn.cursor() as cursor:
                cursor.executemany(sql, params_list)
                return cursor.rowcount
    
    def execute_script(self, script: str) -> None:
        """执行PostgreSQL SQL脚本"""
        with self.get_db_transaction() as conn:
            with conn.cursor() as cursor:
                # 分割SQL语句（PostgreSQL兼容方式）
                statements = [stmt.strip() for stmt in script.split(';') if stmt.strip()]
                
                for statement in statements:
                    if statement and not statement.upper().startswith('REM'):
                        cursor.execute(statement)
    
    def test_connection(self) -> bool:
        """测试PostgreSQL连接"""
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1 as test")
                    result = cursor.fetchone()
                    return result and result[0] == 1
        except Exception as e:
            logger.error(f"PostgreSQL连接测试失败: {e}")
            return False
    
    def get_connection_info(self) -> Dict[str, Any]:
        """获取连接池状态信息"""
        with self._pool_lock:
            return {
                'max_connections': self._max_connections,
                'current_connections': self._current_connections,
                'pool_size': len(self._connection_pool),
                'available_connections': len(self._connection_pool)
            }
    
    def close_all_connections(self) -> None:
        """关闭所有PostgreSQL连接"""
        with self._pool_lock:
            while self._connection_pool:
                connection = self._connection_pool.pop()
                try:
                    connection.close()
                except:
                    pass
            self._current_connections = 0
        logger.info("所有PostgreSQL连接已关闭")
    
    def table_exists(self, table_name: str) -> bool:
        """检查PostgreSQL表是否存在"""
        try:
            sql = """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                )
            """
            result = self.execute_single(sql, (table_name,))
            return result and result[0] or False
        except Exception as e:
            logger.error(f"检查PostgreSQL表存在性失败: {e}")
            return False
    
    def column_exists(self, table_name: str, column_name: str) -> bool:
        """检查列是否存在"""
        try:
            sql = """
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = %s 
                    AND column_name = %s
                )
            """
            result = self.execute_single(sql, (table_name, column_name))
            return result and result[0] or False
        except Exception as e:
            logger.error(f"检查PostgreSQL列存在性失败: {e}")
            return False

# 全局PostgreSQL管理器实例
postgresql_manager = PostgreSQLManager()