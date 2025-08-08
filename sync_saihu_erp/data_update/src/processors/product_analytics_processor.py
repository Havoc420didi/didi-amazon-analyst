"""
产品分析数据处理器
特别处理前七天数据的更新逻辑
"""
import logging
from typing import List, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from .base_processor import BaseProcessor
from ..models import ProductAnalytics
from ..database import db_manager

logger = logging.getLogger(__name__)

class ProductAnalyticsProcessor(BaseProcessor):
    """产品分析数据处理器"""
    
    def __init__(self):
        """初始化产品分析数据处理器"""
        super().__init__('product_analytics')
        self.table_name = 'product_analytics'
        self.update_history_days = 7  # 更新前7天的历史数据
        logger.info("产品分析数据处理器初始化完成")
    
    def _clean_data(self, data_list: List[ProductAnalytics]) -> List[ProductAnalytics]:
        """清洗产品分析数据"""
        cleaned_data = []
        
        for item in data_list:
            try:
                # 清理和标准化数据
                cleaned_item = self._clean_single_item(item)
                if cleaned_item:
                    cleaned_data.append(cleaned_item)
            except Exception as e:
                logger.error(f"清洗单条数据失败: {e}")
                continue
        
        logger.info(f"数据清洗完成: {len(cleaned_data)}/{len(data_list)} 条数据通过清洗")
        return cleaned_data
    
    def _clean_single_item(self, item: ProductAnalytics) -> ProductAnalytics:
        """清洗单条产品分析数据"""
        # 确保必要字段不为空
        if not item.product_id or not item.data_date:
            return None
        
        # 清理和标准化产品ID
        item.product_id = str(item.product_id).strip().upper()
        
        # 数值字段处理
        item.sales_amount = max(item.sales_amount or Decimal('0.00'), Decimal('0.00'))
        item.sales_quantity = max(item.sales_quantity or 0, 0)
        item.impressions = max(item.impressions or 0, 0)
        item.clicks = max(item.clicks or 0, 0)
        
        # 比例字段处理
        if item.conversion_rate is not None:
            item.conversion_rate = max(min(item.conversion_rate, Decimal('1.0000')), Decimal('0.0000'))
        
        if item.acos is not None:
            item.acos = max(item.acos, Decimal('0.0000'))
        
        # 计算衍生指标
        self._calculate_derived_metrics(item)
        
        return item
    
    def _calculate_derived_metrics(self, item: ProductAnalytics) -> None:
        """计算衍生指标"""
        try:
            # 如果没有设置转化率，尝试计算
            if (item.conversion_rate is None or item.conversion_rate == 0) and item.clicks > 0 and item.sales_quantity > 0:
                item.conversion_rate = Decimal(str(item.sales_quantity / item.clicks)).quantize(Decimal('0.0001'))
            
            # 计算CTR (点击率)
            ctr = item.calculate_ctr()
            
            # 计算RPC (每次点击收入)
            rpc = item.calculate_revenue_per_click()
            
            # 更新额外指标
            additional_metrics = item.get_metrics()
            additional_metrics.update({
                'ctr': float(ctr),
                'rpc': float(rpc),
                'processed_at': datetime.now().isoformat()
            })
            item.set_metrics(additional_metrics)
            
        except Exception as e:
            logger.warning(f"计算衍生指标失败: {e}")
    
    def _transform_data(self, data_list: List[ProductAnalytics]) -> List[ProductAnalytics]:
        """转换产品分析数据"""
        # 按日期分组处理
        daily_data = {}
        for item in data_list:
            date_key = item.data_date
            if date_key not in daily_data:
                daily_data[date_key] = []
            daily_data[date_key].append(item)
        
        transformed_data = []
        
        for data_date, items in daily_data.items():
            try:
                # 对同一天的数据进行聚合处理
                aggregated_items = self._aggregate_daily_data(items, data_date)
                transformed_data.extend(aggregated_items)
            except Exception as e:
                logger.error(f"转换日期 {data_date} 的数据失败: {e}")
                continue
        
        logger.info(f"数据转换完成: {len(transformed_data)} 条数据")
        return transformed_data
    
    def _aggregate_daily_data(self, items: List[ProductAnalytics], data_date: date) -> List[ProductAnalytics]:
        """聚合同一天的数据"""
        # 按产品ID分组
        product_data = {}
        
        for item in items:
            product_id = item.product_id
            if product_id not in product_data:
                product_data[product_id] = []
            product_data[product_id].append(item)
        
        aggregated_items = []
        
        for product_id, product_items in product_data.items():
            if len(product_items) == 1:
                # 单条数据直接使用
                aggregated_items.append(product_items[0])
            else:
                # 多条数据需要聚合
                aggregated_item = self._merge_product_data(product_items)
                aggregated_items.append(aggregated_item)
        
        return aggregated_items
    
    def _merge_product_data(self, items: List[ProductAnalytics]) -> ProductAnalytics:
        """合并同一产品的多条数据"""
        if len(items) == 1:
            return items[0]
        
        # 使用第一条数据作为基础
        merged_item = ProductAnalytics.from_dict(items[0].to_dict())
        
        # 累加数值字段
        total_sales_amount = sum(item.sales_amount or Decimal('0.00') for item in items)
        total_sales_quantity = sum(item.sales_quantity or 0 for item in items)
        total_impressions = sum(item.impressions or 0 for item in items)
        total_clicks = sum(item.clicks or 0 for item in items)
        
        merged_item.sales_amount = total_sales_amount
        merged_item.sales_quantity = total_sales_quantity
        merged_item.impressions = total_impressions
        merged_item.clicks = total_clicks
        
        # 重新计算比例指标
        if total_clicks > 0:
            merged_item.conversion_rate = Decimal(str(total_sales_quantity / total_clicks)).quantize(Decimal('0.0001'))
        
        # 计算加权平均ACOS
        valid_acos_items = [item for item in items if item.acos is not None and item.sales_amount and item.sales_amount > 0]
        if valid_acos_items:
            total_weighted_acos = sum(item.acos * item.sales_amount for item in valid_acos_items)
            total_weight = sum(item.sales_amount for item in valid_acos_items)
            if total_weight > 0:
                merged_item.acos = (total_weighted_acos / total_weight).quantize(Decimal('0.0001'))
        
        # 合并额外指标
        all_metrics = {}
        for item in items:
            item_metrics = item.get_metrics()
            for key, value in item_metrics.items():
                if key not in all_metrics:
                    all_metrics[key] = []
                all_metrics[key].append(value)
        
        # 处理合并后的指标
        merged_metrics = {}
        for key, values in all_metrics.items():
            if isinstance(values[0], (int, float)):
                merged_metrics[key] = sum(values)
            else:
                merged_metrics[key] = values[-1]  # 使用最后一个值
        
        merged_item.set_metrics(merged_metrics)
        
        logger.info(f"合并产品 {merged_item.product_id} 的 {len(items)} 条数据")
        return merged_item
    
    def _persist_data(self, data_list: List[ProductAnalytics]) -> Dict[str, Any]:
        """持久化产品分析数据"""
        if not data_list:
            return {'success': 0, 'failed': 0, 'errors': []}
        
        # 区分新增数据和历史更新数据
        new_data, update_data = self._separate_new_and_update_data(data_list)
        
        total_success = 0
        total_failed = 0
        errors = []
        
        # 处理新增数据
        if new_data:
            logger.info(f"处理新增数据: {len(new_data)} 条")
            new_result = self._persist_data_in_batches(new_data, self.table_name)
            total_success += new_result['success']
            total_failed += new_result['failed']
            errors.extend(new_result['errors'])
        
        # 处理历史数据更新
        if update_data:
            logger.info(f"处理历史数据更新: {len(update_data)} 条")
            update_result = self._update_historical_data(update_data)
            total_success += update_result['success']
            total_failed += update_result['failed']
            errors.extend(update_result['errors'])
        
        return {
            'success': total_success,
            'failed': total_failed,
            'errors': errors
        }
    
    def _separate_new_and_update_data(self, data_list: List[ProductAnalytics]) -> tuple:
        """区分新增数据和需要更新的历史数据"""
        today = date.today()
        yesterday = today - timedelta(days=1)
        history_start = yesterday - timedelta(days=self.update_history_days - 1)
        
        new_data = []      # 新增的前一天数据
        update_data = []   # 需要更新的前7天数据
        
        for item in data_list:
            if item.data_date == yesterday:
                new_data.append(item)
            elif history_start <= item.data_date < yesterday:
                update_data.append(item)
            else:
                logger.warning(f"数据日期超出处理范围: {item.data_date}")
        
        logger.info(f"数据分类: 新增 {len(new_data)} 条, 更新 {len(update_data)} 条")
        return new_data, update_data
    
    def _update_historical_data(self, data_list: List[ProductAnalytics]) -> Dict[str, Any]:
        """更新历史数据"""
        total_success = 0
        total_failed = 0
        errors = []
        
        try:
            with db_manager.get_db_transaction() as conn:
                with conn.cursor() as cursor:
                    for item in data_list:
                        try:
                            # 使用UPSERT逻辑
                            where_conditions = {
                                'product_id': item.product_id,
                                'data_date': item.data_date
                            }
                            
                            # 先尝试更新
                            update_sql, update_params = item.get_update_sql(self.table_name, where_conditions)
                            affected_rows = cursor.execute(update_sql, update_params)
                            
                            if affected_rows == 0:
                                # 如果没有更新到记录，则插入新记录
                                insert_sql, insert_params = item.get_insert_sql(self.table_name)
                                cursor.execute(insert_sql, insert_params)
                            
                            total_success += 1
                            
                        except Exception as e:
                            logger.error(f"更新历史数据失败: {e}")
                            total_failed += 1
                            errors.append(f"更新历史数据失败: {e}")
                            continue
            
            logger.info(f"历史数据更新完成: 成功 {total_success} 条, 失败 {total_failed} 条")
            
        except Exception as e:
            logger.error(f"历史数据更新事务失败: {e}")
            return {'success': 0, 'failed': len(data_list), 'errors': [str(e)]}
        
        return {
            'success': total_success,
            'failed': total_failed,
            'errors': errors
        }
    
    def process_yesterday_data(self, data_list: List[ProductAnalytics]) -> Dict[str, Any]:
        """专门处理前一天的数据"""
        yesterday = date.today() - timedelta(days=1)
        
        # 过滤出前一天的数据
        yesterday_data = [item for item in data_list if item.data_date == yesterday]
        
        if not yesterday_data:
            logger.warning("没有前一天的数据需要处理")
            return {'success': 0, 'failed': 0, 'errors': []}
        
        return self.process_data(yesterday_data, yesterday)
    
    def process_history_update(self, data_list: List[ProductAnalytics]) -> Dict[str, Any]:
        """专门处理前7天历史数据的更新"""
        today = date.today()
        yesterday = today - timedelta(days=1)
        history_start = yesterday - timedelta(days=self.update_history_days - 1)
        
        # 过滤出前7天的数据
        history_data = [
            item for item in data_list 
            if history_start <= item.data_date < yesterday
        ]
        
        if not history_data:
            logger.warning("没有历史数据需要更新")
            return {'success': 0, 'failed': 0, 'errors': []}
        
        return self.process_data(history_data, yesterday)
    
    def get_existing_data_summary(self, start_date: date, end_date: date) -> Dict[str, Any]:
        """获取现有数据摘要"""
        try:
            sql = """
                SELECT 
                    data_date,
                    COUNT(*) as product_count,
                    SUM(sales_amount) as total_sales,
                    SUM(sales_quantity) as total_quantity,
                    AVG(conversion_rate) as avg_conversion_rate
                FROM product_analytics 
                WHERE data_date BETWEEN %s AND %s
                GROUP BY data_date
                ORDER BY data_date DESC
            """
            
            results = db_manager.execute_query(sql, (start_date, end_date))
            
            return {
                'date_range': f"{start_date} to {end_date}",
                'daily_summary': results,
                'total_days': len(results)
            }
            
        except Exception as e:
            logger.error(f"获取现有数据摘要失败: {e}")
            return {'error': str(e)}