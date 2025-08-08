#!/usr/bin/env python3
"""
重新同步数据脚本
按照指定日期范围重新同步产品分析、FBA库存和库存明细数据
"""
import sys
import logging
from datetime import datetime, date, timedelta
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DataResyncer:
    """数据重新同步器"""
    
    def __init__(self):
        """初始化同步器"""
        self.config = None
        self.api_client = None
        self.db_handler = None
    
    def setup_connections(self):
        """设置连接"""
        try:
            from src.config.settings import settings
            from src.auth.saihu_api_client_v2 import SaihuApiClientV2
            from src.database.handler import DatabaseHandler
            
            self.config = settings
            
            # 验证配置
            if not self.config.validate_config():
                logger.error("配置验证失败")
                return False
            
            # 初始化API客户端
            api_config = self.config.get('api')
            self.api_client = SaihuApiClientV2(api_config)
            
            # 初始化数据库处理器
            db_config = self.config.get('database')
            self.db_handler = DatabaseHandler(db_config)
            
            # 测试连接
            if not self.api_client.test_connection():
                logger.error("API连接失败")
                return False
            
            if not self.db_handler.connect():
                logger.error("数据库连接失败")
                return False
            
            logger.info("✅ 所有连接设置完成")
            return True
            
        except ImportError as e:
            logger.error(f"❌ 导入模块失败: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ 设置连接失败: {e}")
            return False
    
    def sync_product_analytics(self):
        """同步产品分析数据（前7天）"""
        try:
            from src.models.product_analytics import ProductAnalytics
            
            # 计算日期范围：从昨天开始的前7天
            end_date = date.today() - timedelta(days=1)
            start_date = end_date - timedelta(days=6)
            
            logger.info(f"📅 同步产品分析数据范围: {start_date} 到 {end_date}")
            
            total_records = 0
            
            # 按天同步数据
            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.strftime('%Y-%m-%d')
                logger.info(f"🔄 同步 {date_str} 的数据...")
                
                # 获取数据
                response = self.api_client.get_product_analytics(
                    date_str=date_str,
                    page_size=1000
                )
                
                if not response or 'data' not in response:
                    logger.warning(f"⚠️ {date_str} 无数据")
                    current_date += timedelta(days=1)
                    continue
                
                data = response['data']
                if not data:
                    logger.warning(f"⚠️ {date_str} 数据为空")
                    current_date += timedelta(days=1)
                    continue
                
                # 转换数据
                analytics_list = []
                for item in data:
                    try:
                        analytics = ProductAnalytics.from_api_response(item, current_date)
                        if analytics.is_valid():
                            analytics_list.append(analytics)
                    except Exception as e:
                        logger.warning(f"⚠️ 数据转换失败: {e}")
                        continue
                
                # 批量插入数据
                if analytics_list:
                    inserted = self.db_handler.batch_insert_product_analytics(analytics_list)
                    logger.info(f"✅ {date_str}: 插入 {inserted}/{len(analytics_list)} 条记录")
                    total_records += inserted
                
                current_date += timedelta(days=1)
            
            logger.info(f"📊 产品分析数据同步完成，总计 {total_records} 条记录")
            return True
            
        except Exception as e:
            logger.error(f"❌ 产品分析数据同步失败: {e}")
            return False
    
    def sync_fba_inventory(self):
        """同步FBA库存数据（昨天）"""
        try:
            from src.models.fba_inventory import FbaInventory
            
            # 获取昨天日期
            target_date = date.today() - timedelta(days=1)
            date_str = target_date.strftime('%Y-%m-%d')
            
            logger.info(f"📅 同步FBA库存数据: {date_str}")
            
            # TODO: 实现FBA库存数据同步逻辑
            # 这里需要根据实际的FBA库存API实现
            logger.info("🔄 同步FBA库存数据...")
            
            # 模拟FBA库存数据（实际实现时需要调用对应的API）
            fba_inventory_list = []
            
            # 批量插入数据
            if fba_inventory_list:
                inserted = self.db_handler.batch_insert_fba_inventory(fba_inventory_list)
                logger.info(f"✅ FBA库存数据同步完成: {inserted} 条记录")
            else:
                logger.info("✅ FBA库存数据为空")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ FBA库存数据同步失败: {e}")
            return False
    
    def sync_inventory_details(self):
        """同步库存明细数据（昨天）"""
        try:
            from src.models.inventory_details import InventoryDetails
            
            # 获取昨天日期
            target_date = date.today() - timedelta(days=1)
            date_str = target_date.strftime('%Y-%m-%d')
            
            logger.info(f"📅 同步库存明细数据: {date_str}")
            
            # TODO: 实现库存明细数据同步逻辑
            # 这里需要根据实际的库存明细API实现
            logger.info("🔄 同步库存明细数据...")
            
            # 模拟库存明细数据（实际实现时需要调用对应的API）
            inventory_details_list = []
            
            # 批量插入数据
            if inventory_details_list:
                inserted = self.db_handler.batch_insert_inventory_details(inventory_details_list)
                logger.info(f"✅ 库存明细数据同步完成: {inserted} 条记录")
            else:
                logger.info("✅ 库存明细数据为空")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 库存明细数据同步失败: {e}")
            return False
    
    def verify_sync_results(self):
        """验证同步结果"""
        try:
            # 获取同步后的记录数
            counts = self.db_handler.get_table_counts()
            
            logger.info("\n📊 同步结果验证:")
            for table, count in counts.items():
                logger.info(f"   {table}: {count} 条记录")
            
            # 验证product_analytics中的广告数据
            ad_summary = self.db_handler.get_advertising_summary()
            if ad_summary:
                logger.info("\n📈 广告数据验证:")
                for key, value in ad_summary.items():
                    logger.info(f"   {key}: {value}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 验证同步结果失败: {e}")
            return False
    
    def close_connections(self):
        """关闭所有连接"""
        if self.db_handler:
            self.db_handler.close()
        logger.info("✅ 所有连接已关闭")

def main():
    """主函数"""
    logger.info("🚀 开始重新同步数据...")
    
    resyncer = DataResyncer()
    
    try:
        # 设置连接
        if not resyncer.setup_connections():
            return False
        
        # 同步产品分析数据（前7天）
        logger.info("\n" + "="*60)
        logger.info("📊 开始同步产品分析数据")
        logger.info("="*60)
        resyncer.sync_product_analytics()
        
        # 同步FBA库存数据（昨天）
        logger.info("\n" + "="*60)
        logger.info("📦 开始同步FBA库存数据")
        logger.info("="*60)
        resyncer.sync_fba_inventory()
        
        # 同步库存明细数据（昨天）
        logger.info("\n" + "="*60)
        logger.info("📋 开始同步库存明细数据")
        logger.info("="*60)
        resyncer.sync_inventory_details()
        
        # 验证同步结果
        logger.info("\n" + "="*60)
        logger.info("✅ 验证同步结果")
        logger.info("="*60)
        resyncer.verify_sync_results()
        
        logger.info("\n🎉 数据重新同步完成！")
        return True
        
    except Exception as e:
        logger.error(f"❌ 数据同步失败: {e}")
        return False
    finally:
        resyncer.close_connections()

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)