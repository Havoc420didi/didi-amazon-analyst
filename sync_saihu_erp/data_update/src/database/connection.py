"""
数据库连接管理模块
提供数据库连接池管理和事务处理
"""
import pymysql
import logging
from typing import Optional, Dict, Any, ContextManager
from contextlib import contextmanager
from threading import Lock
from pymysql.cursors import DictCursor
from ..config import DatabaseConfig

logger = logging.getLogger(__name__)

class DatabaseManager:
    """数据库连接管理器"""
    
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
        """初始化数据库管理器"""
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self.connection_params = DatabaseConfig.get_connection_params()
        self.pool_params = DatabaseConfig.get_pool_params()
        self._connection_pool = []
        self._pool_lock = Lock()
        self._max_connections = self.pool_params.get('pool_size', 10)
        self._current_connections = 0
        
        logger.info("数据库管理器初始化完成")
    
    def _create_connection(self) -> pymysql.Connection:
        """创建新的数据库连接"""
        try:
            connection = pymysql.connect(
                host=self.connection_params['host'],
                port=self.connection_params['port'],
                user=self.connection_params['user'],
                password=self.connection_params['password'],
                database=self.connection_params['database'],
                charset=self.connection_params['charset'],
                cursorclass=DictCursor,
                autocommit=self.connection_params.get('autocommit', False)
            )
            
            # 测试连接
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            
            logger.debug("数据库连接创建成功")
            return connection
            
        except Exception as e:
            logger.error(f"创建数据库连接失败: {e}")
            raise
    
    def get_connection(self) -> pymysql.Connection:
        """获取数据库连接"""
        with self._pool_lock:
            # 尝试从连接池获取连接
            if self._connection_pool:
                connection = self._connection_pool.pop()
                # 检查连接是否有效
                try:
                    connection.ping(reconnect=True)
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
    
    def return_connection(self, connection: pymysql.Connection) -> None:
        """归还数据库连接到连接池"""
        if connection and connection.open:
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
    def get_db_connection(self) -> ContextManager[pymysql.Connection]:
        """获取数据库连接的上下文管理器"""
        connection = None
        try:
            connection = self.get_connection()
            yield connection
        except Exception as e:
            if connection:
                try:
                    connection.rollback()
                except:
                    pass
            logger.error(f"数据库操作异常: {e}")
            raise
        finally:
            if connection:
                self.return_connection(connection)
    
    @contextmanager
    def get_db_transaction(self) -> ContextManager[pymysql.Connection]:
        """获取事务连接的上下文管理器"""
        connection = None
        try:
            connection = self.get_connection()
            connection.begin()
            yield connection
            connection.commit()
        except Exception as e:
            if connection:
                try:
                    connection.rollback()
                except:
                    pass
            logger.error(f"事务执行失败: {e}")
            raise
        finally:
            if connection:
                self.return_connection(connection)
    
    def execute_query(self, sql: str, params: Optional[tuple] = None) -> list:
        """执行查询SQL"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, params)
                return cursor.fetchall()
    
    def execute_single(self, sql: str, params: Optional[tuple] = None) -> Optional[dict]:
        """执行查询单条记录"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, params)
                return cursor.fetchone()
    
    def execute_update(self, sql: str, params: Optional[tuple] = None) -> int:
        """执行更新SQL"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                affected_rows = cursor.execute(sql, params)
                conn.commit()
                return affected_rows
    
    def execute_batch(self, sql: str, params_list: list) -> int:
        """批量执行SQL"""
        if not params_list:
            return 0
        
        with self.get_db_transaction() as conn:
            with conn.cursor() as cursor:
                affected_rows = cursor.executemany(sql, params_list)
                return affected_rows
    
    def execute_script(self, script: str) -> None:
        """执行SQL脚本"""
        with self.get_db_transaction() as conn:
            with conn.cursor() as cursor:
                # 分割SQL语句
                statements = [stmt.strip() for stmt in script.split(';') if stmt.strip()]
                
                for statement in statements:
                    if statement:
                        cursor.execute(statement)
    
    def test_connection(self) -> bool:
        """测试数据库连接"""
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1 as test")
                    result = cursor.fetchone()
                    return result['test'] == 1
        except Exception as e:
            logger.error(f"数据库连接测试失败: {e}")
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
        """批量保存FBA库存数据"""
        if not fba_inventory_list:
            return 0
        
        # 根据实际表结构修正SQL语句
        sql = """
        INSERT INTO fba_inventory 
        (sku, fn_sku, asin, marketplace_id, shop_id, available, reserved_customerorders, 
         inbound_working, inbound_shipped, inbound_receiving, unfulfillable, 
         total_inventory, snapshot_date, commodity_id, commodity_name, commodity_sku)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
        available = VALUES(available),
        reserved_customerorders = VALUES(reserved_customerorders),
        inbound_working = VALUES(inbound_working),
        inbound_shipped = VALUES(inbound_shipped),
        inbound_receiving = VALUES(inbound_receiving),
        unfulfillable = VALUES(unfulfillable),
        total_inventory = VALUES(total_inventory),
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
        """批量保存库存明细数据"""
        if not inventory_details_list:
            return 0
        
        sql = """
        INSERT INTO inventory_details 
        (warehouse_id, commodity_id, commodity_sku, commodity_name, fn_sku,
         stock_available, stock_defective, stock_occupy, stock_wait, stock_plan,
         stock_all_num, per_purchase, total_purchase, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
        stock_available = VALUES(stock_available),
        stock_all_num = VALUES(stock_all_num),
        per_purchase = VALUES(per_purchase),
        total_purchase = VALUES(total_purchase),
        updated_at = NOW()
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
        """批量保存产品分析数据 - 更新为包含所有新增字段"""
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
                %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
        sales_amount = VALUES(sales_amount),
        sales_quantity = VALUES(sales_quantity),
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        conversion_rate = VALUES(conversion_rate),
        acos = VALUES(acos),
        currency = VALUES(currency),
        shop_id = VALUES(shop_id),
        dev_id = VALUES(dev_id),
        operator_id = VALUES(operator_id),
        ad_cost = VALUES(ad_cost),
        ad_sales = VALUES(ad_sales),
        cpc = VALUES(cpc),
        cpa = VALUES(cpa),
        ad_orders = VALUES(ad_orders),
        ad_conversion_rate = VALUES(ad_conversion_rate),
        order_count = VALUES(order_count),
        refund_count = VALUES(refund_count),
        refund_rate = VALUES(refund_rate),
        return_count = VALUES(return_count),
        return_rate = VALUES(return_rate),
        rating = VALUES(rating),
        rating_count = VALUES(rating_count),
        title = VALUES(title),
        brand_name = VALUES(brand_name),
        category_name = VALUES(category_name),
        profit_amount = VALUES(profit_amount),
        profit_rate = VALUES(profit_rate),
        avg_profit = VALUES(avg_profit),
        available_days = VALUES(available_days),
        fba_inventory = VALUES(fba_inventory),
        total_inventory = VALUES(total_inventory),
        sessions = VALUES(sessions),
        page_views = VALUES(page_views),
        buy_box_price = VALUES(buy_box_price),
        spu_name = VALUES(spu_name),
        brand = VALUES(brand),
        product_id = VALUES(product_id),
        updated_at = NOW()
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
        """检查表是否存在"""
        try:
            sql = "SHOW TABLES LIKE %s"
            result = self.execute_single(sql, (table_name,))
            return result is not None
        except Exception as e:
            logger.error(f"检查表存在性失败: {e}")
            return False


# 全局数据库管理器实例  
db_manager = DatabaseManager()