"""
数据同步服务
实现从赛狐ERP API抓取数据并保存到本地数据库
"""
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from ..auth.saihu_api_client import saihu_api_client
from ..models import ProductAnalytics, FbaInventory, InventoryDetails
from ..database import db_manager

logger = logging.getLogger(__name__)

class DataSyncService:
    """数据同步服务"""
    
    def __init__(self):
        """初始化数据同步服务"""
        self.api_client = saihu_api_client
        self.db_manager = db_manager
        logger.info("数据同步服务初始化完成")
    
    def sync_fba_inventory_today(self) -> bool:
        """
        同步当天的FBA库存数据
        
        Returns:
            同步是否成功
        """
        try:
            logger.info("开始同步当天FBA库存数据")
            
            # 获取所有FBA库存数据
            all_data = self.api_client.fetch_all_pages(
                fetch_func=self.api_client.fetch_fba_inventory,
                page_size=100,
                hide_zero=True
            )
            
            if not all_data:
                logger.warning("未获取到FBA库存数据")
                return False
            
            # 转换为数据模型
            fba_inventory_list = []
            for item in all_data:
                try:
                    fba_inventory = FbaInventory.from_api_response(item)
                    if fba_inventory.is_valid():
                        fba_inventory_list.append(fba_inventory)
                    else:
                        logger.warning(f"跳过无效的FBA库存数据: {item.get('sku', 'N/A')}")
                except Exception as e:
                    logger.error(f"转换FBA库存数据失败: {e}, 数据: {item}")
                    continue
            
            logger.info(f"成功转换 {len(fba_inventory_list)} 条FBA库存数据")
            
            # 保存到数据库
            if fba_inventory_list:
                success_count = self.db_manager.batch_save_fba_inventory(fba_inventory_list)
                logger.info(f"FBA库存数据同步完成: {success_count}/{len(fba_inventory_list)} 条成功保存")
                return success_count > 0
            else:
                logger.warning("没有有效的FBA库存数据需要保存")
                return False
                
        except Exception as e:
            logger.error(f"同步FBA库存数据失败: {e}")
            return False
    
    def sync_warehouse_inventory_today(self) -> bool:
        """
        同步当天的库存明细数据
        
        Returns:
            同步是否成功
        """
        try:
            logger.info("开始同步当天库存明细数据")
            
            # 获取所有库存明细数据
            all_data = self.api_client.fetch_all_pages(
                fetch_func=self.api_client.fetch_warehouse_inventory,
                page_size=100,
                is_hidden=True
            )
            
            if not all_data:
                logger.warning("未获取到库存明细数据")
                return False
            
            # 转换为数据模型
            inventory_details_list = []
            for item in all_data:
                try:
                    inventory_detail = InventoryDetails.from_api_response(item)
                    if inventory_detail.is_valid():
                        inventory_details_list.append(inventory_detail)
                    else:
                        logger.warning(f"跳过无效的库存明细数据: {item.get('commoditySku', 'N/A')}")
                except Exception as e:
                    logger.error(f"转换库存明细数据失败: {e}, 数据: {item}")
                    continue
            
            logger.info(f"成功转换 {len(inventory_details_list)} 条库存明细数据")
            
            # 保存到数据库
            if inventory_details_list:
                success_count = self.db_manager.batch_save_inventory_details(inventory_details_list)
                logger.info(f"库存明细数据同步完成: {success_count}/{len(inventory_details_list)} 条成功保存")
                return success_count > 0
            else:
                logger.warning("没有有效的库存明细数据需要保存")
                return False
                
        except Exception as e:
            logger.error(f"同步库存明细数据失败: {e}")
            return False
    
    def sync_product_analytics_yesterday(self) -> bool:
        """
        同步前一天的产品分析数据
        
        Returns:
            同步是否成功
        """
        try:
            yesterday = date.today() - timedelta(days=1)
            date_str = yesterday.strftime('%Y-%m-%d')
            
            logger.info(f"开始同步前一天的产品分析数据: {date_str}")
            
            # 获取所有产品分析数据 - 使用基本参数确保稳定性
            all_data = self.api_client.fetch_all_pages(
                fetch_func=self.api_client.fetch_product_analytics,
                start_date=date_str,
                end_date=date_str,
                page_size=100
            )
            
            if not all_data:
                logger.warning(f"未获取到 {date_str} 的产品分析数据")
                return False
            
            # 转换为数据模型
            analytics_list = []
            for item in all_data:
                try:
                    analytics = ProductAnalytics.from_api_response(item, yesterday)
                    if analytics.is_valid():
                        analytics_list.append(analytics)
                    else:
                        logger.warning(f"跳过无效的产品分析数据: {item.get('asin', 'N/A')}")
                except Exception as e:
                    logger.error(f"转换产品分析数据失败: {e}, 数据: {item}")
                    continue
            
            logger.info(f"成功转换 {len(analytics_list)} 条产品分析数据")
            
            # 保存到数据库
            if analytics_list:
                success_count = self.db_manager.batch_save_product_analytics(analytics_list)
                logger.info(f"产品分析数据同步完成: {success_count}/{len(analytics_list)} 条成功保存")
                return success_count > 0
            else:
                logger.warning("没有有效的产品分析数据需要保存")
                return False
                
        except Exception as e:
            logger.error(f"同步前一天产品分析数据失败: {e}")
            return False
    
    def sync_product_analytics_last_seven_days(self) -> bool:
        """
        更新前七天的产品分析数据
        
        Returns:
            更新是否成功
        """
        try:
            end_date = date.today() - timedelta(days=1)
            start_date = end_date - timedelta(days=6)
            
            start_date_str = start_date.strftime('%Y-%m-%d')
            end_date_str = end_date.strftime('%Y-%m-%d')
            
            logger.info(f"开始更新前七天的产品分析数据: {start_date_str} 到 {end_date_str}")
            
            # 获取七天的产品分析数据
            all_data = self.api_client.fetch_all_pages(
                fetch_func=self.api_client.fetch_product_analytics,
                start_date=start_date_str,
                end_date=end_date_str,
                page_size=100
            )
            
            if not all_data:
                logger.warning(f"未获取到 {start_date_str} 到 {end_date_str} 的产品分析数据")
                return False
            
            # 按日期分组数据
            data_by_date = {}
            for item in all_data:
                try:
                    # 假设API返回的数据中包含日期信息
                    item_date = self._extract_date_from_analytics_item(item)
                    if item_date:
                        if item_date not in data_by_date:
                            data_by_date[item_date] = []
                        data_by_date[item_date].append(item)
                except Exception as e:
                    logger.error(f"提取产品分析数据日期失败: {e}")
                    continue
            
            # 逐日处理数据
            total_updated = 0
            for target_date, items in data_by_date.items():
                try:
                    # 转换为数据模型
                    analytics_list = []
                    for item in items:
                        try:
                            analytics = ProductAnalytics.from_api_response(item, target_date)
                            if analytics.is_valid():
                                analytics_list.append(analytics)
                        except Exception as e:
                            logger.error(f"转换产品分析数据失败: {e}")
                            continue
                    
                    if analytics_list:
                        # 使用upsert方式更新数据（插入或更新）
                        success_count = self.db_manager.upsert_product_analytics(analytics_list, target_date)
                        total_updated += success_count
                        logger.info(f"{target_date.strftime('%Y-%m-%d')} 的产品分析数据更新完成: {success_count} 条")
                    
                except Exception as e:
                    logger.error(f"处理 {target_date} 的产品分析数据失败: {e}")
                    continue
            
            logger.info(f"前七天产品分析数据更新完成: 总计 {total_updated} 条")
            return total_updated > 0
            
        except Exception as e:
            logger.error(f"更新前七天产品分析数据失败: {e}")
            return False
    
    def _extract_date_from_analytics_item(self, item: Dict[str, Any]) -> Optional[date]:
        """
        从产品分析数据项中提取日期
        
        Args:
            item: API返回的数据项
            
        Returns:
            提取的日期，失败返回None
        """
        try:
            # 尝试从不同字段提取日期
            date_fields = ['dataDate', 'date', 'reportDate', 'statisticsDate']
            
            for field in date_fields:
                if field in item and item[field]:
                    date_str = str(item[field])
                    # 尝试解析不同格式的日期
                    for date_format in ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']:
                        try:
                            return datetime.strptime(date_str[:10], date_format).date()
                        except ValueError:
                            continue
            
            # 如果没有找到日期字段，返回None
            logger.warning(f"无法从数据项中提取日期: {item}")
            return None
            
        except Exception as e:
            logger.error(f"提取日期时发生异常: {e}")
            return None
    
    def sync_all_data(self) -> Dict[str, bool]:
        """
        执行完整的数据同步
        
        Returns:
            各项同步任务的结果
        """
        logger.info("开始执行完整数据同步")
        
        results = {}
        
        # 1. 同步当天FBA库存数据
        try:
            results['fba_inventory'] = self.sync_fba_inventory_today()
        except Exception as e:
            logger.error(f"同步FBA库存数据异常: {e}")
            results['fba_inventory'] = False
        
        # 2. 同步当天库存明细数据
        try:
            results['warehouse_inventory'] = self.sync_warehouse_inventory_today()
        except Exception as e:
            logger.error(f"同步库存明细数据异常: {e}")
            results['warehouse_inventory'] = False
        
        # 3. 同步前一天产品分析数据
        try:
            results['product_analytics_yesterday'] = self.sync_product_analytics_yesterday()
        except Exception as e:
            logger.error(f"同步前一天产品分析数据异常: {e}")
            results['product_analytics_yesterday'] = False
        
        # 4. 更新前七天产品分析数据
        try:
            results['product_analytics_last_7_days'] = self.sync_product_analytics_last_seven_days()
        except Exception as e:
            logger.error(f"更新前七天产品分析数据异常: {e}")
            results['product_analytics_last_7_days'] = False
        
        # 统计结果
        success_count = sum(1 for success in results.values() if success)
        total_count = len(results)
        
        logger.info(f"完整数据同步结果: {success_count}/{total_count} 项成功")
        logger.info(f"详细结果: {results}")
        
        return results
    
    def get_sync_status(self) -> Dict[str, Any]:
        """
        获取同步状态信息
        
        Returns:
            同步状态信息
        """
        try:
            status = {
                'last_sync_time': None,
                'fba_inventory_count': 0,
                'warehouse_inventory_count': 0,
                'product_analytics_count': 0
            }
            
            # 从数据库获取最新的同步时间和数据统计
            # 这里需要数据库支持相应的查询方法
            if hasattr(self.db_manager, 'get_sync_statistics'):
                db_stats = self.db_manager.get_sync_statistics()
                status.update(db_stats)
            
            return status
            
        except Exception as e:
            logger.error(f"获取同步状态失败: {e}")
            return {'error': str(e)}

# 全局数据同步服务实例
data_sync_service = DataSyncService()