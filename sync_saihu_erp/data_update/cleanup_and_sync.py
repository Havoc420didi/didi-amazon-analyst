#!/usr/bin/env python3
"""
清理数据库并重置数据同步
清空产品分析、FBA库存和库存明细表，然后重新同步数据
"""
import sys
import logging
from datetime import datetime, date, timedelta
from pathlib import Path
import pymysql
from decimal import Decimal

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DatabaseCleaner:
    """数据库清理工具"""
    
    def __init__(self, config):
        """初始化数据库连接"""
        self.config = config.get('database', {})
        self.connection = None
        
    def connect(self):
        """连接数据库"""
        try:
            self.connection = pymysql.connect(
                host=self.config.get('host'),
                port=self.config.get('port', 3306),
                user=self.config.get('user'),
                password=self.config.get('password'),
                database=self.config.get('database'),
                charset=self.config.get('charset', 'utf8mb4'),
                connect_timeout=30
            )
            logger.info("✅ 数据库连接成功")
            return True
        except Exception as e:
            logger.error(f"❌ 数据库连接失败: {e}")
            return False
    
    def close(self):
        """关闭数据库连接"""
        if self.connection:
            self.connection.close()
            logger.info("✅ 数据库连接已关闭")
    
    def check_table_schema(self, table_name):
        """检查表结构"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(f"DESCRIBE {table_name}")
                columns = cursor.fetchall()
                
                logger.info(f"\n📋 {table_name} 表结构:")
                for col in columns:
                    field, type_, null, key, default, extra = col
                    logger.info(f"   {field}: {type_} NULL={null} DEFAULT={default}")
                
                return columns
        except Exception as e:
            logger.error(f"❌ 检查{table_name}表结构失败: {e}")
            return []
    
    def validate_product_analytics_fields(self):
        """验证product_analytics表字段是否符合模型要求"""
        try:
            columns = self.check_table_schema('product_analytics')
            actual_fields = [col[0] for col in columns]
            
            # 模型中定义的字段
            required_fields = [
                'id', 'product_id', 'asin', 'sku', 'parent_asin', 'spu', 'msku',
                'data_date', 'sales_amount', 'sales_quantity', 'impressions', 'clicks',
                'conversion_rate', 'acos', 'marketplace_id', 'dev_name', 'operator_name',
                'currency', 'ad_cost', 'ad_sales', 'cpc', 'cpa', 'ad_orders',
                'ad_conversion_rate', 'order_count', 'refund_count', 'refund_rate',
                'return_count', 'return_rate', 'rating', 'rating_count', 'title',
                'brand_name', 'category_name', 'profit_amount', 'profit_rate',
                'avg_profit', 'available_days', 'fba_inventory', 'total_inventory',
                'created_at', 'updated_at'
            ]
            
            logger.info("\n🔍 字段验证结果:")
            
            missing_fields = []
            for field in required_fields:
                if field in actual_fields:
                    logger.info(f"✅ {field}: 存在")
                else:
                    logger.warning(f"❌ {field}: 缺失")
                    missing_fields.append(field)
            
            if missing_fields:
                logger.warning(f"⚠️ 缺失字段: {missing_fields}")
            else:
                logger.info("✅ 所有必需字段都存在")
            
            return missing_fields
            
        except Exception as e:
            logger.error(f"❌ 字段验证失败: {e}")
            return []
    
    def truncate_tables(self):
        """清空表数据"""
        try:
            with self.connection.cursor() as cursor:
                tables = ['product_analytics', 'fba_inventory', 'inventory_details']
                
                for table in tables:
                    try:
                        cursor.execute(f"TRUNCATE TABLE {table}")
                        self.connection.commit()
                        logger.info(f"✅ 已清空 {table} 表")
                    except Exception as e:
                        logger.warning(f"⚠️ 清空{table}表失败: {e}")
                        # 尝试DELETE方式
                        cursor.execute(f"DELETE FROM {table}")
                        self.connection.commit()
                        logger.info(f"✅ 已使用DELETE清空 {table} 表")
                
                return True
                
        except Exception as e:
            logger.error(f"❌ 清空表数据失败: {e}")
            return False
    
    def get_table_counts(self):
        """获取各表记录数"""
        try:
            with self.connection.cursor() as cursor:
                tables = ['product_analytics', 'fba_inventory', 'inventory_details']
                counts = {}
                
                for table in tables:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    counts[table] = count
                    logger.info(f"📊 {table}: {count} 条记录")
                
                return counts
        except Exception as e:
            logger.error(f"❌ 获取表记录数失败: {e}")
            return {}

def main():
    """主函数"""
    logger.info("🚀 开始数据库清理和验证...")
    
    try:
        # 导入配置
        from src.config.settings import settings
        
        # 初始化清理器
        cleaner = DatabaseCleaner(settings)
        
        # 连接数据库
        if not cleaner.connect():
            return False
        
        # 获取初始记录数
        logger.info("\n📊 初始表记录数:")
        initial_counts = cleaner.get_table_counts()
        
        # 验证product_analytics表字段
        logger.info("\n🔍 验证product_analytics表字段...")
        missing_fields = cleaner.validate_product_analytics_fields()
        
        if missing_fields:
            logger.error(f"❌ 存在缺失字段，请先升级数据库结构: {missing_fields}")
            return False
        
        # 清空表数据
        logger.info("\n🗑️ 清空表数据...")
        if cleaner.truncate_tables():
            logger.info("✅ 表数据清空完成")
        else:
            logger.error("❌ 表数据清空失败")
            return False
        
        # 验证数据已清空
        logger.info("\n📊 清空后表记录数:")
        final_counts = cleaner.get_table_counts()
        
        # 关闭连接
        cleaner.close()
        
        logger.info("\n✅ 数据库清理和验证完成")
        return True
        
    except ImportError as e:
        logger.error(f"❌ 导入配置模块失败: {e}")
        logger.info("💡 请确保pymysql已安装: pip install pymysql")
        return False
    except Exception as e:
        logger.error(f"❌ 执行失败: {e}")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)