#!/usr/bin/env python3
"""
FBA库存数据同步脚本 - 每4小时同步一次FBA库存数据
专门用于FBA库存数据的连续同步
"""
import sys
import os
import time
from datetime import datetime, date, timedelta
import logging

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from src.scrapers.fba_inventory_scraper import FbaInventoryScraper
from src.parsers.api_template import ApiTemplate
from src.database.connection import db_manager

# 设置日志记录
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/hudi_data/sync_saihu_erp/data_update/fba_sync_4hours.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class FbaSyncService:
    """FBA库存数据同步服务"""
    
    def __init__(self):
        self.sync_count = 0
        self.start_time = datetime.now()
        self.api_template = ApiTemplate()
        self.fba_scraper = FbaInventoryScraper(self.api_template)
        
    def print_header(self):
        """打印同步头部信息"""
        print("\n" + "="*80)
        print("📦 FBA库存数据连续同步服务 - 4小时间隔")
        print(f"📅 启动时间: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🎯 同步目标: FBA库存数据")
        print(f"⏰ 同步间隔: 4小时")
        print(f"🔗 数据库: 47.79.123.234:3306/saihu_erp_sync")
        print("="*80)
        
    def sync_fba_inventory(self):
        """执行FBA库存数据同步"""
        sync_time = datetime.now()
        self.sync_count += 1
        
        print(f"\n📦 第 {self.sync_count} 次FBA库存同步 - {sync_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 70)
        
        try:
            # 同步参数
            sync_params = {
                "page_no": 1,
                "page_size": 100,
                "hide_zero": False,  # 不隐藏零库存，获取完整数据
                "currency": "USD"
            }
            
            print(f"🔧 同步参数: {sync_params}")
            
            # 抓取FBA库存数据
            print("🔍 开始抓取FBA库存数据...")
            all_inventory_data = []
            page_no = 1
            
            while True:
                sync_params["page_no"] = page_no
                inventory_data = self.fba_scraper.fetch_current_inventory(**sync_params)
                
                if not inventory_data:
                    print(f"   第 {page_no} 页: 无数据，结束抓取")
                    break
                
                print(f"   第 {page_no} 页: 获取到 {len(inventory_data)} 条数据")
                all_inventory_data.extend(inventory_data)
                
                # 如果返回数据少于page_size，说明已经是最后一页
                if len(inventory_data) < sync_params["page_size"]:
                    break
                    
                page_no += 1
                time.sleep(0.5)  # 避免API频率限制
            
            if not all_inventory_data:
                print("⚠️ 未抓取到任何FBA库存数据")
                return False
            
            print(f"✅ 总计抓取到 {len(all_inventory_data)} 条FBA库存数据")
            
            # 保存到MySQL数据库
            print("💾 开始保存数据到MySQL数据库...")
            
            saved_count = db_manager.batch_save_fba_inventory(all_inventory_data)
            
            if saved_count > 0:
                print(f"✅ 成功保存 {saved_count} 条数据到MySQL数据库")
                
                # 验证保存结果
                verification_sql = """
                SELECT COUNT(*) as total, 
                       MAX(updated_at) as latest_update
                FROM fba_inventory 
                WHERE DATE(updated_at) = CURDATE()
                """
                verification_result = db_manager.execute_single(verification_sql)
                
                if verification_result:
                    print(f"📊 验证结果:")
                    print(f"   今日更新记录数: {verification_result['total']}")
                    print(f"   最新更新时间: {verification_result['latest_update']}")
                
                return True
            else:
                print("❌ 数据保存失败")
                return False
                
        except Exception as e:
            logger.error(f"FBA库存数据同步异常: {e}")
            print(f"❌ 同步过程发生异常: {e}")
            return False
    
    def check_database_status(self):
        """检查数据库状态"""
        try:
            print("\n💾 检查FBA库存数据库状态...")
            
            # 检查FBA库存表的数据量
            stats_sql = """
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT sku) as unique_skus,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT marketplace_id) as unique_marketplaces,
                SUM(available) as total_available,
                SUM(total_inventory) as total_inventory
            FROM fba_inventory
            """
            stats_result = db_manager.execute_single(stats_sql)
            
            # 今日新增数据
            today = date.today().strftime('%Y-%m-%d')
            today_sql = f"SELECT COUNT(*) as count FROM fba_inventory WHERE DATE(updated_at) = '{today}'"
            today_result = db_manager.execute_single(today_sql)
            
            if stats_result and today_result:
                print(f"📈 数据库统计信息:")
                print(f"   总记录数: {stats_result['total_records']}")
                print(f"   唯一SKU数: {stats_result['unique_skus']}")
                print(f"   唯一ASIN数: {stats_result['unique_asins']}")
                print(f"   唯一市场数: {stats_result['unique_marketplaces']}")
                print(f"   总可用库存: {stats_result['total_available'] or 0}")
                print(f"   总库存数量: {stats_result['total_inventory'] or 0}")
                print(f"   今日更新记录: {today_result['count']}")
            
            return True
            
        except Exception as e:
            print(f"❌ 数据库状态检查失败: {e}")
            return False
    
    def print_runtime_stats(self):
        """打印运行时统计"""
        runtime = datetime.now() - self.start_time
        hours = int(runtime.total_seconds() // 3600)
        minutes = int((runtime.total_seconds() % 3600) // 60)
        seconds = int(runtime.total_seconds() % 60)
        
        print(f"\n⏱️ 运行统计:")
        print(f"   已运行时间: {hours:02d}:{minutes:02d}:{seconds:02d}")
        print(f"   完成同步次数: {self.sync_count}")
        if self.sync_count > 0:
            avg_interval = runtime.total_seconds() / self.sync_count
            print(f"   平均同步间隔: {avg_interval:.1f}秒")
        
        # 计算下次同步时间
        next_sync = self.start_time + timedelta(hours=4 * self.sync_count)
        print(f"   下次同步时间: {next_sync.strftime('%Y-%m-%d %H:%M:%S')}")
    
    def run(self):
        """运行连续同步服务"""
        self.print_header()
        
        try:
            while True:
                # 执行FBA库存数据同步
                sync_success = self.sync_fba_inventory()
                
                # 检查数据库状态
                self.check_database_status()
                
                # 打印运行统计
                self.print_runtime_stats()
                
                if sync_success:
                    print(f"\n🎉 第 {self.sync_count} 次同步成功完成")
                else:
                    print(f"\n⚠️ 第 {self.sync_count} 次同步存在问题")
                
                print(f"\n💤 等待4小时后进行下次同步...")
                print("-" * 80)
                
                # 等待4小时 (4 * 60 * 60 = 14400秒)
                time.sleep(14400)
                
        except KeyboardInterrupt:
            print(f"\n\n🛑 用户手动停止FBA同步服务")
            self.print_runtime_stats()
            print("✅ FBA同步服务已安全退出")
        except Exception as e:
            logger.error(f"FBA连续同步服务异常: {e}")
            print(f"\n❌ FBA同步服务异常退出: {e}")
        finally:
            print("👋 感谢使用FBA库存数据同步服务")

def main():
    """主函数"""
    print("🚀 启动FBA库存数据连续同步服务")
    print("💡 提示: 按 Ctrl+C 停止同步服务")
    
    sync_service = FbaSyncService()
    sync_service.run()

if __name__ == "__main__":
    main()