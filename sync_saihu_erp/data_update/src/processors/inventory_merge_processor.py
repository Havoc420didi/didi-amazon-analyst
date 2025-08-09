"""
库存合并处理器

集成库存点合并逻辑到数据处理流水线中
"""

import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, date
# SQLAlchemy已替换为纯SQL操作

from .base_processor import BaseProcessor
from ..inventory import InventoryMerger
# 使用纯SQL操作，不需要导入ORM模型
from ..database import db_manager
from ..utils.logging_utils import get_logger

logger = get_logger(__name__)


class InventoryMergeProcessor(BaseProcessor):
    """库存合并处理器"""
    
    def __init__(self):
        super().__init__('inventory_merge')
        self.merger = InventoryMerger()
        self.logger = logger
    
    def process(self, data_list: List[Dict[str, Any]], data_date: str = None) -> Dict[str, Any]:
        """
        处理库存合并逻辑
        
        Args:
            data_list: 原始产品数据列表
            data_date: 数据日期，格式YYYY-MM-DD
            
        Returns:
            处理结果
        """
        try:
            # 设置默认数据日期
            if not data_date:
                data_date = date.today().strftime('%Y-%m-%d')
            
            self.logger.info(f"开始处理库存合并，数据日期: {data_date}, 数据量: {len(data_list)}")
            
            # 第一步：数据预处理
            cleaned_data = self._clean_data(data_list)
            self.logger.info(f"数据清洗完成，有效数据量: {len(cleaned_data)}")
            
            if not cleaned_data:
                return {
                    'status': 'warning',
                    'message': '没有有效的数据进行合并',
                    'processed_count': len(data_list),
                    'cleaned_count': 0,
                    'merged_count': 0,
                    'saved_count': 0
                }
            
            # 第二步：执行库存点合并
            merged_points = self.merger.merge_inventory_points(cleaned_data)
            self.logger.info(f"库存合并完成，合并后库存点数量: {len(merged_points)}")
            
            # 第三步：计算分析指标
            enriched_points = self._enrich_analysis_data(merged_points)
            
            # 第四步：持久化合并结果
            saved_count = self._persist_merged_data(enriched_points, data_date)
            
            # 第五步：保存历史快照
            self._save_history_snapshots(enriched_points, data_date)
            
            # 第六步：生成合并统计
            merge_stats = self.merger.get_merge_statistics(len(data_list), merged_points)
            
            result = {
                'status': 'success',
                'data_date': data_date,
                'processed_count': len(data_list),
                'cleaned_count': len(cleaned_data),
                'merged_count': len(merged_points),
                'saved_count': saved_count,
                'merge_statistics': merge_stats,
                'processing_time': datetime.utcnow().isoformat()
            }
            
            self.logger.info(f"库存合并处理完成: {result}")
            return result
            
        except Exception as e:
            self.logger.error(f"库存合并处理失败: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'data_date': data_date or 'unknown',
                'processed_count': len(data_list) if data_list else 0,
                'processing_time': datetime.utcnow().isoformat()
            }
    
    def _validate_product_data(self, data: Dict[str, Any]) -> bool:
        """验证产品数据完整性"""
        required_fields = ['asin', 'product_name', 'store', 'marketplace']
        
        # 检查必需字段
        for field in required_fields:
            if field not in data or not data[field]:
                return False
        
        # 验证ASIN格式（通常是10个字符的字母数字组合）
        asin = data['asin']
        if not isinstance(asin, str) or len(asin) < 8 or len(asin) > 15:
            return False
        
        return True
    
    def _normalize_product_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """标准化产品数据"""
        normalized = data.copy()
        
        # 数值字段标准化
        numeric_fields = [
            'fba_available', 'fba_inbound', 'local_available', 'fba_sellable', 'fba_unsellable',
            'sales_7days', 'average_sales', 'order_count', 'total_sales', 'promotional_orders',
            'ad_impressions', 'ad_clicks', 'ad_spend', 'ad_order_count', 'ad_sales'
        ]
        
        for field in numeric_fields:
            if field in normalized:
                try:
                    value = normalized[field]
                    if value is None or value == '':
                        normalized[field] = 0.0
                    else:
                        normalized[field] = float(value)
                except (ValueError, TypeError):
                    normalized[field] = 0.0
        
        # 字符串字段标准化
        string_fields = ['asin', 'product_name', 'store', 'marketplace', 'sku', 'category', 'sales_person', 'product_tag', 'dev_name']
        for field in string_fields:
            if field in normalized:
                if normalized[field] is None:
                    normalized[field] = ''
                else:
                    normalized[field] = str(normalized[field]).strip()
        
        return normalized
    
    def _enrich_analysis_data(self, merged_points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """丰富分析数据，计算各种指标"""
        enriched_points = []
        
        for point in merged_points:
            try:
                enriched_point = point.copy()
                
                # 计算总库存
                total_inventory = (
                    (point.get('fba_available', 0) or 0) + 
                    (point.get('fba_inbound', 0) or 0) + 
                    (point.get('local_available', 0) or 0)
                )
                enriched_point['total_inventory'] = total_inventory
                
                # 计算库存周转天数
                average_sales = point.get('average_sales', 0) or 0
                if average_sales > 0:
                    turnover_days = round(total_inventory / average_sales, 1)
                else:
                    turnover_days = 999 if total_inventory > 0 else 0
                enriched_point['turnover_days'] = turnover_days
                
                # 计算日均销售额
                average_price = self._extract_price_from_string(point.get('average_price', ''))
                daily_sales_amount = average_sales * average_price
                enriched_point['daily_sales_amount'] = round(daily_sales_amount, 2)
                
                # 计算状态标识
                enriched_point['is_turnover_exceeded'] = turnover_days > 100 or turnover_days == 999
                enriched_point['is_low_inventory'] = 0 < turnover_days < 45
                enriched_point['is_out_of_stock'] = (point.get('fba_available', 0) or 0) <= 0
                enriched_point['is_zero_sales'] = (point.get('sales_7days', 0) or 0) == 0
                enriched_point['is_effective_point'] = daily_sales_amount >= 16.7
                
                enriched_points.append(enriched_point)
                
            except Exception as e:
                self.logger.warning(f"数据丰富失败: {e}, 使用原始数据")
                enriched_points.append(point)
        
        return enriched_points
    
    def _extract_price_from_string(self, price_str: str) -> float:
        """从价格字符串中提取数值"""
        if not price_str:
            return 0.0
        
        try:
            import re
            price_match = re.search(r'[\d.]+', str(price_str))
            if price_match:
                return float(price_match.group())
            return 0.0
        except:
            return 0.0
    
    def _persist_merged_data(self, merged_points: List[Dict[str, Any]], data_date: str) -> int:
        """持久化合并后的数据"""
        saved_count = 0
        
        try:
            # 首先创建表如果不存在
            self._ensure_inventory_points_table()
            
            # 删除当天的旧数据
            delete_sql = "DELETE FROM inventory_points WHERE data_date = %s"
            db_manager.execute_update(delete_sql, (data_date,))
            
            # 批量插入新数据
            if merged_points:
                insert_sql = """
                INSERT INTO inventory_points (
                    asin, product_name, sku, category, sales_person, product_tag, dev_name,
                    marketplace, store, inventory_point_name,
                    fba_available, fba_inbound, fba_sellable, fba_unsellable, 
                    local_available, inbound_shipped, total_inventory,
                    sales_7days, total_sales, average_sales, order_count, promotional_orders,
                    average_price, sales_amount, net_sales, refund_rate,
                    ad_impressions, ad_clicks, ad_spend, ad_order_count, ad_sales,
                    ad_ctr, ad_cvr, acoas, ad_cpc, ad_roas,
                    turnover_days, daily_sales_amount, is_turnover_exceeded, 
                    is_out_of_stock, is_zero_sales, is_low_inventory, is_effective_point,
                    merge_type, merged_stores, store_count, data_date, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, NOW(), NOW()
                )
                """
                
                params_list = []
                for point_data in merged_points:
                    params = (
                        # 基础信息
                        point_data.get('asin', ''),
                        point_data.get('product_name', ''),
                        point_data.get('sku', ''),
                        point_data.get('category', ''),
                        point_data.get('sales_person', ''),
                        point_data.get('product_tag', ''),
                        point_data.get('dev_name', ''),
                        point_data.get('marketplace', ''),
                        point_data.get('store', ''),
                        point_data.get('inventory_point_name', ''),
                        
                        # 库存数据
                        point_data.get('fba_available', 0),
                        point_data.get('fba_inbound', 0),
                        point_data.get('fba_sellable', 0),
                        point_data.get('fba_unsellable', 0),
                        point_data.get('local_available', 0),
                        point_data.get('inbound_shipped', 0),
                        point_data.get('total_inventory', 0),
                        
                        # 销售数据
                        point_data.get('sales_7days', 0),
                        point_data.get('total_sales', 0),
                        point_data.get('average_sales', 0),
                        point_data.get('order_count', 0),
                        point_data.get('promotional_orders', 0),
                        
                        # 价格信息
                        point_data.get('average_price', ''),
                        point_data.get('sales_amount', ''),
                        point_data.get('net_sales', ''),
                        point_data.get('refund_rate', ''),
                        
                        # 广告数据
                        point_data.get('ad_impressions', 0),
                        point_data.get('ad_clicks', 0),
                        point_data.get('ad_spend', 0),
                        point_data.get('ad_order_count', 0),
                        point_data.get('ad_sales', 0),
                        point_data.get('ad_ctr', 0),
                        point_data.get('ad_cvr', 0),
                        point_data.get('acoas', 0),
                        point_data.get('ad_cpc', 0),
                        point_data.get('ad_roas', 0),
                        
                        # 分析指标
                        point_data.get('turnover_days', 0),
                        point_data.get('daily_sales_amount', 0),
                        point_data.get('is_turnover_exceeded', False),
                        point_data.get('is_out_of_stock', False),
                        point_data.get('is_zero_sales', False),
                        point_data.get('is_low_inventory', False),
                        point_data.get('is_effective_point', False),
                        
                        # 合并元数据
                        point_data.get('_merge_type', ''),
                        json.dumps(point_data.get('_merged_stores', []), ensure_ascii=False),
                        point_data.get('_store_count', 1),
                        data_date
                    )
                    params_list.append(params)
                
                # 批量执行插入
                saved_count = db_manager.execute_batch(insert_sql, params_list)
                self.logger.info(f"成功保存 {saved_count} 个库存点到数据库")
                
        except Exception as e:
            self.logger.error(f"数据持久化失败: {e}")
            raise
        
        return saved_count
    
    def _ensure_inventory_points_table(self):
        """确保库存点表存在（PostgreSQL版）"""
        try:
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS inventory_points (
                id SERIAL PRIMARY KEY,
                asin VARCHAR(20) NOT NULL,
                product_name VARCHAR(255) NOT NULL,
                sku VARCHAR(100),
                category VARCHAR(100),
                sales_person VARCHAR(100),
                product_tag VARCHAR(100),
                dev_name VARCHAR(100),
                marketplace VARCHAR(50) NOT NULL,
                store VARCHAR(255),
                inventory_point_name VARCHAR(255),
                
                fba_available NUMERIC(10,2) DEFAULT 0,
                fba_inbound NUMERIC(10,2) DEFAULT 0,
                fba_sellable NUMERIC(10,2) DEFAULT 0,
                fba_unsellable NUMERIC(10,2) DEFAULT 0,
                local_available NUMERIC(10,2) DEFAULT 0,
                inbound_shipped NUMERIC(10,2) DEFAULT 0,
                total_inventory NUMERIC(10,2) DEFAULT 0,
                
                sales_7days NUMERIC(10,2) DEFAULT 0,
                total_sales NUMERIC(10,2) DEFAULT 0,
                average_sales NUMERIC(10,2) DEFAULT 0,
                order_count INTEGER DEFAULT 0,
                promotional_orders INTEGER DEFAULT 0,
                
                average_price VARCHAR(50),
                sales_amount VARCHAR(50),
                net_sales VARCHAR(50),
                refund_rate VARCHAR(50),
                
                ad_impressions INTEGER DEFAULT 0,
                ad_clicks INTEGER DEFAULT 0,
                ad_spend NUMERIC(10,2) DEFAULT 0,
                ad_order_count INTEGER DEFAULT 0,
                ad_sales NUMERIC(10,2) DEFAULT 0,
                ad_ctr NUMERIC(8,4) DEFAULT 0,
                ad_cvr NUMERIC(8,4) DEFAULT 0,
                acoas NUMERIC(8,4) DEFAULT 0,
                ad_cpc NUMERIC(8,2) DEFAULT 0,
                ad_roas NUMERIC(8,2) DEFAULT 0,
                
                turnover_days NUMERIC(8,1) DEFAULT 0,
                daily_sales_amount NUMERIC(10,2) DEFAULT 0,
                is_turnover_exceeded BOOLEAN DEFAULT FALSE,
                is_out_of_stock BOOLEAN DEFAULT FALSE,
                is_zero_sales BOOLEAN DEFAULT FALSE,
                is_low_inventory BOOLEAN DEFAULT FALSE,
                is_effective_point BOOLEAN DEFAULT FALSE,
                
                merge_type VARCHAR(50),
                merged_stores TEXT,
                store_count INTEGER DEFAULT 1,
                data_date DATE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT unique_point UNIQUE (asin, marketplace, data_date)
            );
            CREATE INDEX IF NOT EXISTS idx_inventory_points_date ON inventory_points(data_date);
            CREATE INDEX IF NOT EXISTS idx_inventory_points_marketplace ON inventory_points(marketplace);
            CREATE INDEX IF NOT EXISTS idx_inventory_points_asin ON inventory_points(asin);
            """
            
            db_manager.execute_script(create_table_sql)
            self.logger.debug("库存点表创建或检查完成")
            
        except Exception as e:
            self.logger.error(f"创建库存点表失败: {e}")
            raise
    
    def _save_history_snapshots(self, merged_points: List[Dict[str, Any]], data_date: str):
        """保存历史快照数据"""
        try:
            # 创建历史表如果不存在
            self._ensure_history_table()
            
            if merged_points:
                history_sql = """
                INSERT INTO inventory_point_history 
                (asin, marketplace, data_date, total_inventory, average_sales, 
                 turnover_days, daily_sales_amount, ad_spend, ad_sales, acoas, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """
                
                params_list = []
                for point_data in merged_points:
                    params = (
                        point_data.get('asin', ''),
                        point_data.get('marketplace', ''),
                        data_date,
                        point_data.get('total_inventory', 0),
                        point_data.get('average_sales', 0),
                        point_data.get('turnover_days', 0),
                        point_data.get('daily_sales_amount', 0),
                        point_data.get('ad_spend', 0),
                        point_data.get('ad_sales', 0),
                        point_data.get('acoas', 0)
                    )
                    params_list.append(params)
                
                db_manager.execute_batch(history_sql, params_list)
                self.logger.debug(f"历史快照保存完成，数据日期: {data_date}")
                
        except Exception as e:
            self.logger.error(f"历史快照保存异常: {e}")
    
    def _ensure_history_table(self):
        """确保历史表存在（PostgreSQL版）"""
        try:
            create_history_sql = """
            CREATE TABLE IF NOT EXISTS inventory_point_history (
                id SERIAL PRIMARY KEY,
                asin VARCHAR(20) NOT NULL,
                marketplace VARCHAR(50) NOT NULL,
                data_date DATE NOT NULL,
                total_inventory NUMERIC(10,2) DEFAULT 0,
                average_sales NUMERIC(10,2) DEFAULT 0,
                turnover_days NUMERIC(8,1) DEFAULT 0,
                daily_sales_amount NUMERIC(10,2) DEFAULT 0,
                ad_spend NUMERIC(10,2) DEFAULT 0,
                ad_sales NUMERIC(10,2) DEFAULT 0,
                acoas NUMERIC(8,4) DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_inventory_point_hist_asin_date ON inventory_point_history(asin, data_date);
            CREATE INDEX IF NOT EXISTS idx_inventory_point_hist_marketplace_date ON inventory_point_history(marketplace, data_date);
            """
            db_manager.execute_script(create_history_sql)
        except Exception as e:
            self.logger.error(f"创建历史表失败: {e}")
            raise
    
    def get_merge_summary(self, data_date: str = None) -> Dict[str, Any]:
        """获取合并数据汇总"""
        if not data_date:
            data_date = date.today().strftime('%Y-%m-%d')
        
        try:
            # 基础统计
            total_points_sql = "SELECT COUNT(*) as count FROM inventory_points WHERE data_date = %s"
            total_result = db_manager.execute_single(total_points_sql, (data_date,))
            total_points = total_result['count'] if total_result else 0
            
            eu_points_sql = "SELECT COUNT(*) as count FROM inventory_points WHERE data_date = %s AND marketplace = '欧盟'"
            eu_result = db_manager.execute_single(eu_points_sql, (data_date,))
            eu_points = eu_result['count'] if eu_result else 0
            
            turnover_sql = "SELECT COUNT(*) as count FROM inventory_points WHERE data_date = %s AND is_turnover_exceeded = TRUE"
            turnover_result = db_manager.execute_single(turnover_sql, (data_date,))
            turnover_exceeded = turnover_result['count'] if turnover_result else 0
            
            stock_sql = "SELECT COUNT(*) as count FROM inventory_points WHERE data_date = %s AND is_out_of_stock = TRUE"
            stock_result = db_manager.execute_single(stock_sql, (data_date,))
            out_of_stock = stock_result['count'] if stock_result else 0
            
            effective_sql = "SELECT COUNT(*) as count FROM inventory_points WHERE data_date = %s AND is_effective_point = TRUE"
            effective_result = db_manager.execute_single(effective_sql, (data_date,))
            effective_points = effective_result['count'] if effective_result else 0
            
            return {
                'data_date': data_date,
                'total_points': total_points,
                'eu_points': eu_points,
                'non_eu_points': total_points - eu_points,
                'turnover_exceeded': turnover_exceeded,
                'out_of_stock': out_of_stock,
                'effective_points': effective_points,
                'effectiveness_rate': round(effective_points / total_points if total_points > 0 else 0, 4)
            }
            
        except Exception as e:
            self.logger.error(f"获取合并汇总失败: {e}")
            return {}
    
    # 实现基类的抽象方法  
    def _clean_data(self, data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """数据清洗和验证"""
        cleaned = []
        
        for i, data in enumerate(data_list):
            try:
                if self._validate_product_data(data):
                    normalized_data = self._normalize_product_data(data)
                    cleaned.append(normalized_data)
                else:
                    self.logger.debug(f"产品 #{i} 验证失败，跳过")
                    
            except Exception as e:
                self.logger.warning(f"产品 #{i} 清洗失败: {e}")
                continue
        
        return cleaned
    
    def _transform_data(self, data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """数据转换 - 执行库存合并"""
        try:
            merged_points = self.merger.merge_inventory_points(data_list)
            enriched_points = self._enrich_analysis_data(merged_points)
            return enriched_points
        except Exception as e:
            self.logger.error(f"数据转换失败: {e}")
            return []
    
    def _persist_data(self, data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """数据持久化"""
        try:
            data_date = date.today().strftime('%Y-%m-%d')
            saved_count = self._persist_merged_data(data_list, data_date)
            return {
                'success': saved_count,
                'failed': 0,
                'errors': []
            }
        except Exception as e:
            self.logger.error(f"数据持久化失败: {e}")
            return {
                'success': 0,
                'failed': len(data_list),
                'errors': [str(e)]
            }