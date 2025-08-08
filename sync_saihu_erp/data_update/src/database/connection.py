"""
数据库连接管理模块 - PostgreSQL版本
提供PostgreSQL连接池管理和事务处理
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.extensions import connection as PgConnection
import logging
from typing import Optional, Dict, Any, ContextManager, List, Tuple
from contextlib import contextmanager
from threading import Lock
from ..config import Settings

logger = logging.getLogger(__name__)

class DatabaseManager:
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
        self._connection_pool = []
        self._pool_lock = Lock()
        self._max_connections = 10
        self._current_connections = 0
        
        logger.info("PostgreSQL数据库管理器初始化完成")
    
    def _get_connection_params(self) -> Dict[str, Any]:
        """获取PostgreSQL连接参数"""
        db_config = self.settings.get('database', {})
        return {
            'host': db_config.get('host', 'localhost'),
            'port': db_config.get('port', 5432),
            'user': db_config.get('user', 'postgres'),
            'password': db_config.get('password', ''),
            'dbname': db_config.get('database', 'saihu_erp_sync'),
            'sslmode': db_config.get('sslmode', 'prefer')
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
                    connection.status  # 检查PostgreSQL连接状态
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
        """关闭所有连接"""
        with self._pool_lock:
            while self._connection_pool:
                connection = self._connection_pool.pop()
                try:
                    connection.close()
                except:
                    pass
            self._current_connections = 0
        
        logger.info("所有数据库连接已关闭")
    
    def batch_save_fba_inventory(self, fba_inventory_list) -> int:
        """批量保存FBA库存数据 - PostgreSQL版本"""
        if not fba_inventory_list:
            return 0
        
        # PostgreSQL的UPSERT语法
        sql = """
        INSERT INTO fba_inventory 
        (sku, fn_sku, asin, marketplace_id, shop_id, available, reserved_customerorders, 
         inbound_working, inbound_shipped, inbound_receiving, unfulfillable, 
         total_inventory, snapshot_date, commodity_id, commodity_name, commodity_sku)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (sku, marketplace_id, shop_id) DO UPDATE
        SET available = EXCLUDED.available,
            reserved_customerorders = EXCLUDED.reserved_customerorders,
            inbound_working = EXCLUDED.inbound_working,
            inbound_shipped = EXCLUDED.inbound_shipped,
            inbound_receiving = EXCLUDED.inbound_receiving,
            unfulfillable = EXCLUDED.unfulfillable,
            total_inventory = EXCLUDED.total_inventory,
            updated_at = CURRENT_TIMESTAMP
        """
        
        params_list = []
        for fba in fba_inventory_list:
            params = (
                getattr(fba, 'sku', None),
                getattr(fba, 'fn_sku', None),
                getattr(fba, 'asin', None),
                getattr(fba, 'marketplace_id', None),
                getattr(fba, 'shop_id', None),
                getattr(fba, 'available_quantity', 0),
                getattr(fba, 'reserved_quantity', 0),
                getattr(fba, 'inbound_quantity', 0),
                getattr(fba, 'inbound_shipped_quantity', 0),
                getattr(fba, 'inbound_receiving_quantity', 0),
                getattr(fba, 'unfulfillable_quantity', 0),
                getattr(fba, 'total_quantity', 0),
                getattr(fba, 'snapshot_date', None),
                getattr(fba, 'commodity_id', None),
                getattr(fba, 'commodity_name', None),
                getattr(fba, 'commodity_sku', None)
            )
            params_list.append(params)
        
        try:
            affected_rows = self.execute_batch(sql, params_list)
            logger.info(f"批量保存FBA库存数据成功: {affected_rows} 条")
            return affected_rows
        except Exception as e:
            logger.error(f"批量保存FBA库存数据失败: {e}")
            return 0
    
    def batch_save_inventory_details(self, inventory_details_list) -> int:
        """批量保存库存明细数据 - PostgreSQL版本"""
        if not inventory_details_list:
            return 0
        
        sql = """
        INSERT INTO inventory_details 
        (warehouse_id, commodity_id, commodity_sku, commodity_name, fn_sku,
         stock_available, stock_defective, stock_occupy, stock_wait, stock_plan,
         stock_all_num, per_purchase, total_purchase, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (warehouse_id, commodity_id) DO UPDATE
        SET stock_available = EXCLUDED.stock_available,
            stock_defective = EXCLUDED.stock_defective,
            stock_all_num = EXCLUDED.stock_all_num,
            per_purchase = EXCLUDED.per_purchase,
            total_purchase = EXCLUDED.total_purchase,
            updated_at = CURRENT_TIMESTAMP
        """
        
        params_list = []
        for inventory in inventory_details_list:
            params = (
                getattr(inventory, 'warehouse_code', None),
                getattr(inventory, 'item_id', None),
                getattr(inventory, 'sku', None),
                getattr(inventory, 'item_name', None),
                getattr(inventory, 'fn_sku', None),
                getattr(inventory, 'available_quantity', 0),
                getattr(inventory, 'stock_defective', 0),
                getattr(inventory, 'reserved_quantity', 0),  # 修正字段名
                getattr(inventory, 'stock_wait', 0),
                getattr(inventory, 'stock_plan', 0),
                getattr(inventory, 'quantity', 0),
                getattr(inventory, 'cost_price', 0),
                getattr(inventory, 'total_purchase', 0)
            )
            params_list.append(params)
        
        try:
            affected_rows = self.execute_batch(sql, params_list)
            logger.info(f"批量保存库存明细数据成功: {affected_rows} 条")
            return affected_rows
        except Exception as e:
            logger.error(f"批量保存库存明细数据失败: {e}")
            return 0
    
    def batch_save_product_analytics(self, analytics_list) -> int:
        """批量保存产品分析数据 - PostgreSQL版本包含所有新增字段"""
        if not analytics_list:
            return 0
        
        sql = """
        INSERT INTO product_analytics 
        (asin, sku, parent_asin, spu, msku, sales_amount, sales_quantity,
         impressions, clicks, conversion_rate, acos, data_date, marketplace_id,
         dev_name, operator_name, currency, shop_id, dev_id, operator_id,
         ad_cost, ad_sales, cpc, cpa, ad_orders, ad_conversion_rate,
         order_count, refund_count, refund_rate, return_count, return_rate,
         rating, rating_count, title, brand_name, category_name,
         profit_amount, profit_rate, avg_profit, available_days,
         fba_inventory, total_inventory, sessions, page_views, buy_box_price,
         spu_name, brand, product_id, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (asin, sku, data_date) DO UPDATE
        SET sales_amount = EXCLUDED.sales_amount,
            sales_quantity = EXCLUDED.sales_quantity,
            impressions = EXCLUDED.impressions,
            clicks = EXCLUDED.clicks,
            conversion_rate = EXCLUDED.conversion_rate,
            acos = EXCLUDED.acos,
            currency = EXCLUDED.currency,
            shop_id = EXCLUDED.shop_id,
            dev_id = EXCLUDED.dev_id,
            operator_id = EXCLUDED.operator_id,
            ad_cost = EXCLUDED.ad_cost,
            ad_sales = EXCLUDED.ad_sales,
            cpc = EXCLUDED.cpc,
            cpa = EXCLUDED.cpa,
            ad_orders = EXCLUDED.ad_orders,
            ad_conversion_rate = EXCLUDED.ad_conversion_rate,
            order_count = EXCLUDED.order_count,
            refund_count = EXCLUDED.refund_count,
            refund_rate = EXCLUDED.refund_rate,
            return_count = EXCLUDED.return_count,
            return_rate = EXCLUDED.return_rate,
            rating = EXCLUDED.rating,
            rating_count = EXCLUDED.rating_count,
            title = EXCLUDED.title,
            brand_name = EXCLUDED.brand_name,
            category_name = EXCLUDED.category_name,
            profit_amount = EXCLUDED.profit_amount,
            profit_rate = EXCLUDED.profit_rate,
            avg_profit = EXCLUDED.avg_profit,
            available_days = EXCLUDED.available_days,
            fba_inventory = EXCLUDED.fba_inventory,
            total_inventory = EXCLUDED.total_inventory,
            sessions = EXCLUDED.sessions,
            page_views = EXCLUDED.page_views,
            buy_box_price = EXCLUDED.buy_box_price,
            spu_name = EXCLUDED.spu_name,
            brand = EXCLUDED.brand,
            product_id = EXCLUDED.product_id,
            updated_at = CURRENT_TIMESTAMP
        """
        
        params_list = []
        for analytics in analytics_list:
            params = (
                # 基础字段
                getattr(analytics, 'asin', None),
                getattr(analytics, 'sku', None),
                getattr(analytics, 'parent_asin', None),
                getattr(analytics, 'spu', None),
                getattr(analytics, 'msku', None),
                getattr(analytics, 'sales_amount', 0),
                getattr(analytics, 'sales_quantity', 0),
                getattr(analytics, 'impressions', 0),
                getattr(analytics, 'clicks', 0),
                getattr(analytics, 'conversion_rate', 0),
                getattr(analytics, 'acos', 0),
                getattr(analytics, 'data_date', None),
                getattr(analytics, 'marketplace_id', None),
                getattr(analytics, 'dev_name', None),
                getattr(analytics, 'operator_name', None),
                # 新增的核心字段
                getattr(analytics, 'currency', 'USD'),
                getattr(analytics, 'shop_id', None),
                getattr(analytics, 'dev_id', None),
                getattr(analytics, 'operator_id', None),
                # 新增的广告指标
                getattr(analytics, 'ad_cost', 0),
                getattr(analytics, 'ad_sales', 0),
                getattr(analytics, 'cpc', 0),
                getattr(analytics, 'cpa', 0),
                getattr(analytics, 'ad_orders', 0),
                getattr(analytics, 'ad_conversion_rate', 0),
                # 新增的业务指标
                getattr(analytics, 'order_count', 0),
                getattr(analytics, 'refund_count', 0),
                getattr(analytics, 'refund_rate', 0),
                getattr(analytics, 'return_count', 0),
                getattr(analytics, 'return_rate', 0),
                getattr(analytics, 'rating', 0),
                getattr(analytics, 'rating_count', 0),
                # 新增的商品信息
                getattr(analytics, 'title', None),
                getattr(analytics, 'brand_name', None),
                getattr(analytics, 'category_name', None),
                # 新增的利润指标
                getattr(analytics, 'profit_amount', 0),
                getattr(analytics, 'profit_rate', 0),
                getattr(analytics, 'avg_profit', 0),
                # 新增的库存信息
                getattr(analytics, 'available_days', 0),
                getattr(analytics, 'fba_inventory', 0),
                getattr(analytics, 'total_inventory', 0),
                # 新增字段
                getattr(analytics, 'sessions', 0),
                getattr(analytics, 'page_views', 0),
                getattr(analytics, 'buy_box_price', None),
                getattr(analytics, 'spu_name', None),
                getattr(analytics, 'brand', None),
                # 产品ID
                getattr(analytics, 'product_id', None)
            )
            params_list.append(params)
        
        try:
            affected_rows = self.execute_batch(sql, params_list)
            logger.info(f"批量保存产品分析数据成功: {affected_rows} 条")
            return affected_rows
        except Exception as e:
            logger.error(f"批量保存产品分析数据失败: {e}")
            return 0
    
    def upsert_product_analytics(self, analytics_list, target_date) -> int:
        """更新产品分析数据（插入或更新）"""
        return self.batch_save_product_analytics(analytics_list)
    
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


# 全局数据库管理器实例  
db_manager = DatabaseManager()