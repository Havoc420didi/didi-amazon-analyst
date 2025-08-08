#!/usr/bin/env python3
"""
将product_analytics表中的dev_name数据合并到inventory_points表

这个脚本的功能：
1. 从product_analytics表获取ASIN与dev_name的映射关系
2. 将dev_name信息合并到inventory_points表中
3. 处理多个dev_name的情况（选择最新的或最常见的）
"""

import sys
import os
import logging
from datetime import datetime, date
from typing import Dict, List, Optional
from collections import Counter

# 添加src目录到路径
current_dir = os.path.dirname(__file__)
src_dir = os.path.join(current_dir, 'src')
sys.path.insert(0, src_dir)

# 导入数据库模块
import mysql.connector
from mysql.connector import Error

# 简化的日志配置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 数据库配置
DB_CONFIG = {
    'host': '47.79.123.234',
    'port': 3306,
    'user': 'saihu_erp_sync',
    'password': '123456',
    'database': 'saihu_erp_sync',
    'charset': 'utf8mb4'
}


class SimpleDBManager:
    """简化的数据库管理器"""
    
    def __init__(self):
        self.config = DB_CONFIG
    
    def get_connection(self):
        """获取数据库连接"""
        return mysql.connector.connect(**self.config)
    
    def execute_query(self, sql, params=None):
        """执行查询"""
        connection = None
        cursor = None
        try:
            connection = self.get_connection()
            cursor = connection.cursor(dictionary=True)
            cursor.execute(sql, params or ())
            return cursor.fetchall()
        except Error as e:
            logger.error(f"查询执行失败: {e}")
            raise
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()
    
    def execute_single(self, sql, params=None):
        """执行单条查询"""
        results = self.execute_query(sql, params)
        return results[0] if results else None
    
    def execute_update(self, sql, params=None):
        """执行更新"""
        connection = None
        cursor = None
        try:
            connection = self.get_connection()
            cursor = connection.cursor()
            cursor.execute(sql, params or ())
            connection.commit()
            return cursor.rowcount
        except Error as e:
            logger.error(f"更新执行失败: {e}")
            if connection:
                connection.rollback()
            raise
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()


# 全局数据库管理器实例
db_manager = SimpleDBManager()


class DevNameMerger:
    """dev_name合并器"""
    
    def __init__(self):
        self.logger = logger
    
    def merge_dev_names(self, target_date: Optional[str] = None) -> Dict[str, any]:
        """
        将dev_name数据合并到inventory_points表
        
        Args:
            target_date: 目标日期，格式YYYY-MM-DD，默认为今天
            
        Returns:
            合并结果统计
        """
        if not target_date:
            target_date = date.today().strftime('%Y-%m-%d')
        
        try:
            self.logger.info(f"开始合并dev_name数据，目标日期: {target_date}")
            
            # 第一步：获取ASIN与dev_name的映射关系
            asin_dev_mapping = self._get_asin_dev_mapping(target_date)
            self.logger.info(f"获取到 {len(asin_dev_mapping)} 个ASIN的dev_name映射")
            
            if not asin_dev_mapping:
                return {
                    'status': 'warning',
                    'message': '没有找到dev_name数据',
                    'target_date': target_date,
                    'updated_count': 0
                }
            
            # 第二步：更新inventory_points表
            updated_count = self._update_inventory_points(asin_dev_mapping, target_date)
            
            # 第三步：验证更新结果
            verification_result = self._verify_merge_result(target_date)
            
            result = {
                'status': 'success',
                'target_date': target_date,
                'asin_mappings': len(asin_dev_mapping),
                'updated_count': updated_count,
                'verification': verification_result,
                'merge_time': datetime.now().isoformat()
            }
            
            self.logger.info(f"dev_name合并完成: {result}")
            return result
            
        except Exception as e:
            self.logger.error(f"dev_name合并失败: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'target_date': target_date,
                'merge_time': datetime.now().isoformat()
            }
    
    def _get_asin_dev_mapping(self, target_date: str) -> Dict[str, str]:
        """
        从product_analytics表获取ASIN与dev_name的映射关系
        
        Args:
            target_date: 目标日期
            
        Returns:
            ASIN与dev_name的映射字典
        """
        try:
            # 查询指定日期的数据，如果没有则查询最近7天的数据
            sql = """
            SELECT asin, dev_name, data_date, COUNT(*) as count
            FROM product_analytics 
            WHERE data_date >= DATE_SUB(%s, INTERVAL 7 DAY) 
              AND data_date <= %s
              AND asin IS NOT NULL 
              AND asin != ''
              AND dev_name IS NOT NULL 
              AND dev_name != ''
            GROUP BY asin, dev_name, data_date
            ORDER BY asin, data_date DESC, count DESC
            """
            
            results = db_manager.execute_query(sql, (target_date, target_date))
            
            if not results:
                self.logger.warning("没有找到product_analytics数据")
                return {}
            
            # 处理每个ASIN的dev_name，选择最新且最常见的
            asin_dev_mapping = {}
            asin_candidates = {}
            
            for row in results:
                asin = row['asin']
                dev_name = row['dev_name']
                data_date = row['data_date']
                count = row['count']
                
                if asin not in asin_candidates:
                    asin_candidates[asin] = []
                
                asin_candidates[asin].append({
                    'dev_name': dev_name,
                    'data_date': data_date,
                    'count': count
                })
            
            # 为每个ASIN选择最佳的dev_name
            for asin, candidates in asin_candidates.items():
                # 按日期倒序，数量倒序排序
                candidates.sort(key=lambda x: (x['data_date'], x['count']), reverse=True)
                best_dev_name = candidates[0]['dev_name']
                asin_dev_mapping[asin] = best_dev_name
                
                if len(candidates) > 1:
                    self.logger.debug(f"ASIN {asin} 有多个dev_name，选择: {best_dev_name}")
            
            self.logger.info(f"处理完成，获得 {len(asin_dev_mapping)} 个ASIN的dev_name映射")
            return asin_dev_mapping
            
        except Exception as e:
            self.logger.error(f"获取ASIN-dev_name映射失败: {e}")
            raise
    
    def _update_inventory_points(self, asin_dev_mapping: Dict[str, str], target_date: str) -> int:
        """
        更新inventory_points表中的dev_name字段
        
        Args:
            asin_dev_mapping: ASIN与dev_name的映射
            target_date: 目标日期
            
        Returns:
            更新的记录数
        """
        try:
            updated_count = 0
            
            # 批量更新，每次处理100个ASIN
            asin_list = list(asin_dev_mapping.keys())
            batch_size = 100
            
            for i in range(0, len(asin_list), batch_size):
                batch_asins = asin_list[i:i + batch_size]
                
                # 构建批量更新SQL
                when_clauses = []
                params = []
                
                for asin in batch_asins:
                    dev_name = asin_dev_mapping[asin]
                    when_clauses.append("WHEN asin = %s THEN %s")
                    params.extend([asin, dev_name])
                
                # 添加WHERE条件的参数
                params.extend(batch_asins)
                params.append(target_date)
                
                update_sql = f"""
                UPDATE inventory_points 
                SET dev_name = CASE 
                    {' '.join(when_clauses)}
                    ELSE dev_name 
                END,
                updated_at = NOW()
                WHERE asin IN ({','.join(['%s'] * len(batch_asins))})
                  AND data_date = %s
                """
                
                batch_updated = db_manager.execute_update(update_sql, params)
                updated_count += batch_updated
                
                self.logger.debug(f"批次 {i//batch_size + 1}: 更新了 {batch_updated} 条记录")
            
            self.logger.info(f"总共更新了 {updated_count} 条inventory_points记录")
            return updated_count
            
        except Exception as e:
            self.logger.error(f"更新inventory_points失败: {e}")
            raise
    
    def _verify_merge_result(self, target_date: str) -> Dict[str, any]:
        """
        验证合并结果
        
        Args:
            target_date: 目标日期
            
        Returns:
            验证结果统计
        """
        try:
            # 统计inventory_points表中dev_name的情况
            stats_sql = """
            SELECT 
                COUNT(*) as total_records,
                COUNT(CASE WHEN dev_name IS NOT NULL AND dev_name != '' THEN 1 END) as has_dev_name,
                COUNT(CASE WHEN dev_name IS NULL OR dev_name = '' THEN 1 END) as no_dev_name,
                COUNT(DISTINCT dev_name) as unique_dev_names
            FROM inventory_points 
            WHERE data_date = %s
            """
            
            stats_result = db_manager.execute_single(stats_sql, (target_date,))
            
            if not stats_result:
                return {'error': '无法获取验证统计'}
            
            # 获取dev_name分布
            distribution_sql = """
            SELECT dev_name, COUNT(*) as count
            FROM inventory_points 
            WHERE data_date = %s 
              AND dev_name IS NOT NULL 
              AND dev_name != ''
            GROUP BY dev_name 
            ORDER BY count DESC 
            LIMIT 10
            """
            
            distribution_results = db_manager.execute_query(distribution_sql, (target_date,))
            
            return {
                'total_records': stats_result['total_records'],
                'has_dev_name': stats_result['has_dev_name'],
                'no_dev_name': stats_result['no_dev_name'],
                'unique_dev_names': stats_result['unique_dev_names'],
                'coverage_rate': round(stats_result['has_dev_name'] / stats_result['total_records'] if stats_result['total_records'] > 0 else 0, 4),
                'top_dev_names': [{'dev_name': row['dev_name'], 'count': row['count']} for row in distribution_results[:5]]
            }
            
        except Exception as e:
            self.logger.error(f"验证合并结果失败: {e}")
            return {'error': str(e)}
    
    def get_merge_summary(self, target_date: Optional[str] = None) -> Dict[str, any]:
        """
        获取合并摘要信息
        
        Args:
            target_date: 目标日期，默认为今天
            
        Returns:
            摘要信息
        """
        if not target_date:
            target_date = date.today().strftime('%Y-%m-%d')
        
        try:
            verification_result = self._verify_merge_result(target_date)
            
            return {
                'target_date': target_date,
                'summary': verification_result,
                'check_time': datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"获取合并摘要失败: {e}")
            return {
                'target_date': target_date,
                'error': str(e),
                'check_time': datetime.now().isoformat()
            }


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='将product_analytics表中的dev_name数据合并到inventory_points表')
    parser.add_argument('--date', type=str, help='目标日期 (YYYY-MM-DD)，默认为今天')
    parser.add_argument('--summary', action='store_true', help='只显示摘要信息，不执行合并')
    parser.add_argument('--verbose', action='store_true', help='详细日志输出')
    
    args = parser.parse_args()
    
    # 设置日志级别
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    
    merger = DevNameMerger()
    
    try:
        if args.summary:
            # 只显示摘要
            result = merger.get_merge_summary(args.date)
            print("=" * 50)
            print("dev_name合并摘要")
            print("=" * 50)
            print(f"目标日期: {result['target_date']}")
            if 'error' in result:
                print(f"错误: {result['error']}")
            else:
                summary = result['summary']
                print(f"总记录数: {summary.get('total_records', 0)}")
                print(f"有dev_name的记录: {summary.get('has_dev_name', 0)}")
                print(f"没有dev_name的记录: {summary.get('no_dev_name', 0)}")
                print(f"覆盖率: {summary.get('coverage_rate', 0) * 100:.2f}%")
                print(f"唯一dev_name数量: {summary.get('unique_dev_names', 0)}")
                
                if 'top_dev_names' in summary:
                    print("\n前5个dev_name分布:")
                    for item in summary['top_dev_names']:
                        print(f"  {item['dev_name']}: {item['count']} 条记录")
        else:
            # 执行合并
            result = merger.merge_dev_names(args.date)
            print("=" * 50)
            print("dev_name合并结果")
            print("=" * 50)
            print(f"状态: {result['status']}")
            print(f"目标日期: {result['target_date']}")
            
            if result['status'] == 'success':
                print(f"ASIN映射数: {result['asin_mappings']}")
                print(f"更新记录数: {result['updated_count']}")
                
                verification = result.get('verification', {})
                if verification and 'error' not in verification:
                    print(f"验证结果:")
                    print(f"  总记录数: {verification.get('total_records', 0)}")
                    print(f"  有dev_name: {verification.get('has_dev_name', 0)}")
                    print(f"  覆盖率: {verification.get('coverage_rate', 0) * 100:.2f}%")
            elif result['status'] == 'warning':
                print(f"警告: {result['message']}")
            else:
                print(f"错误: {result.get('error', '未知错误')}")
        
        print(f"\n检查时间: {result.get('check_time', result.get('merge_time', 'unknown'))}")
        
    except Exception as e:
        print(f"执行失败: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()