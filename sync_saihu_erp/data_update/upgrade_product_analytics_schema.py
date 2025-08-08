#!/usr/bin/env python3
"""
产品分析表结构安全升级脚本
用途：安全地升级产品分析表结构，添加缺失字段
"""
import sys
import os
from pathlib import Path
import logging
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from src.database.connection import db_manager

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('schema_upgrade.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SchemaUpgrader:
    """数据库表结构升级器"""
    
    def __init__(self):
        self.db_manager = db_manager
        self.backup_table = f"product_analytics_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
    def check_prerequisites(self):
        """检查升级前提条件"""
        try:
            logger.info("检查升级前提条件...")
            
            # 检查数据库连接
            if not self.db_manager.test_connection():
                raise Exception("数据库连接失败")
            
            # 检查原表是否存在
            if not self.db_manager.table_exists('product_analytics'):
                raise Exception("product_analytics表不存在")
            
            # 检查表中是否有数据
            count_sql = "SELECT COUNT(*) as count FROM product_analytics"
            result = self.db_manager.execute_single(count_sql)
            record_count = result['count'] if result else 0
            
            logger.info(f"原表记录数: {record_count}")
            
            if record_count > 0:
                logger.info("表中有数据，将创建备份")
            
            return True
            
        except Exception as e:
            logger.error(f"前提条件检查失败: {e}")
            return False
    
    def create_backup(self):
        """创建数据备份"""
        try:
            logger.info(f"创建备份表: {self.backup_table}")
            
            backup_sql = f"""
            CREATE TABLE {self.backup_table} AS 
            SELECT * FROM product_analytics
            """
            
            self.db_manager.execute_update(backup_sql)
            
            # 验证备份
            verify_sql = f"SELECT COUNT(*) as count FROM {self.backup_table}"
            result = self.db_manager.execute_single(verify_sql)
            backup_count = result['count'] if result else 0
            
            logger.info(f"备份完成，备份记录数: {backup_count}")
            return True
            
        except Exception as e:
            logger.error(f"创建备份失败: {e}")
            return False
    
    def check_new_columns_exist(self):
        """检查新字段是否已存在"""
        try:
            columns_sql = "SHOW COLUMNS FROM product_analytics"
            columns = self.db_manager.execute_query(columns_sql)
            existing_columns = [col['Field'] for col in columns]
            
            new_columns = ['currency', 'shop_id', 'dev_id', 'ad_cost', 'ad_sales', 'cpc']
            existing_new_columns = [col for col in new_columns if col in existing_columns]
            
            if existing_new_columns:
                logger.warning(f"以下新字段已存在: {existing_new_columns}")
                return existing_new_columns
            
            return []
            
        except Exception as e:
            logger.error(f"检查现有字段失败: {e}")
            return []
    
    def execute_upgrade(self):
        """执行表结构升级"""
        try:
            logger.info("开始执行表结构升级...")
            
            # 读取升级SQL脚本
            sql_file = Path(__file__).parent / 'sql' / 'product_analytics_schema_upgrade.sql'
            
            if not sql_file.exists():
                raise Exception(f"升级SQL文件不存在: {sql_file}")
            
            with open(sql_file, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # 分割SQL语句
            sql_statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
            
            # 过滤掉注释和无效语句
            valid_statements = []
            for stmt in sql_statements:
                # 跳过注释行
                if stmt.startswith('--') or stmt.startswith('/*') or stmt.upper().startswith('USE'):
                    continue
                # 跳过事务控制语句（手动控制）
                if stmt.upper() in ['START TRANSACTION', 'COMMIT', 'ROLLBACK']:
                    continue
                valid_statements.append(stmt)
            
            logger.info(f"准备执行 {len(valid_statements)} 条SQL语句")
            
            # 开始事务
            with self.db_manager.get_db_transaction() as conn:
                with conn.cursor() as cursor:
                    success_count = 0
                    
                    for i, stmt in enumerate(valid_statements, 1):
                        try:
                            logger.info(f"执行语句 {i}/{len(valid_statements)}: {stmt[:50]}...")
                            cursor.execute(stmt)
                            success_count += 1
                            
                        except Exception as e:
                            # 如果是"字段已存在"的错误，记录警告但继续
                            if "Duplicate column name" in str(e) or "already exists" in str(e):
                                logger.warning(f"字段已存在，跳过: {e}")
                                continue
                            else:
                                logger.error(f"执行SQL失败: {stmt[:100]}... 错误: {e}")
                                raise
                    
                    logger.info(f"表结构升级完成，成功执行 {success_count} 条语句")
            
            return True
            
        except Exception as e:
            logger.error(f"表结构升级失败: {e}")
            return False
    
    def verify_upgrade(self):
        """验证升级结果"""
        try:
            logger.info("验证升级结果...")
            
            # 检查新字段是否存在
            columns_sql = "SHOW COLUMNS FROM product_analytics"
            columns = self.db_manager.execute_query(columns_sql)
            column_names = [col['Field'] for col in columns]
            
            # 预期的新字段
            expected_new_fields = [
                'currency', 'shop_id', 'dev_id', 'operator_id', 'tag_id', 'brand_id',
                'ad_cost', 'ad_sales', 'cpc', 'cpa', 'ad_orders', 'ad_conversion_rate',
                'order_count', 'refund_count', 'rating', 'title', 'brand_name',
                'profit_amount', 'fba_inventory', 'shop_ids', 'dev_ids'
            ]
            
            missing_fields = [field for field in expected_new_fields if field not in column_names]
            existing_new_fields = [field for field in expected_new_fields if field in column_names]
            
            logger.info(f"成功添加字段数: {len(existing_new_fields)}")
            logger.info(f"缺失字段数: {len(missing_fields)}")
            
            if missing_fields:
                logger.warning(f"以下字段未成功添加: {missing_fields}")
            
            # 检查数据完整性
            count_sql = "SELECT COUNT(*) as count FROM product_analytics"
            result = self.db_manager.execute_single(count_sql)
            final_count = result['count'] if result else 0
            
            logger.info(f"升级后记录数: {final_count}")
            
            # 显示表结构
            logger.info(f"升级后表字段总数: {len(column_names)}")
            
            return len(missing_fields) == 0
            
        except Exception as e:
            logger.error(f"验证升级结果失败: {e}")
            return False
    
    def run_upgrade(self, force=False):
        """运行完整的升级流程"""
        try:
            logger.info("=" * 60)
            logger.info("开始产品分析表结构升级")
            logger.info("=" * 60)
            
            # 1. 检查前提条件
            if not self.check_prerequisites():
                return False
            
            # 2. 检查是否已经升级过
            if not force:
                existing_new_columns = self.check_new_columns_exist()
                if existing_new_columns:
                    logger.warning("检测到新字段已存在，可能已经升级过")
                    response = input("是否继续升级? (y/N): ")
                    if response.lower() != 'y':
                        logger.info("用户取消升级")
                        return False
            
            # 3. 创建备份
            if not self.create_backup():
                return False
            
            # 4. 执行升级
            if not self.execute_upgrade():
                logger.error("升级失败，数据已回滚")
                return False
            
            # 5. 验证升级
            if not self.verify_upgrade():
                logger.error("升级验证失败")
                return False
            
            logger.info("=" * 60)
            logger.info("产品分析表结构升级成功完成！")
            logger.info(f"备份表: {self.backup_table}")
            logger.info("=" * 60)
            
            return True
            
        except Exception as e:
            logger.error(f"升级过程异常: {e}")
            return False
        finally:
            self.db_manager.close_all_connections()

def main():
    """主函数"""
    print("🚀 产品分析表结构升级工具")
    print("💡 此工具将为product_analytics表添加缺失的重要字段")
    print()
    
    # 确认升级
    response = input("是否确认升级产品分析表结构? (y/N): ")
    if response.lower() != 'y':
        print("❌ 升级已取消")
        return
    
    # 执行升级
    upgrader = SchemaUpgrader()
    success = upgrader.run_upgrade()
    
    if success:
        print("✅ 升级完成！可以开始测试新的数据同步功能")
    else:
        print("❌ 升级失败，请检查日志")
        sys.exit(1)

if __name__ == "__main__":
    main()