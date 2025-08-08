#!/usr/bin/env python3
"""
自动化产品分析表结构升级脚本
用途：无交互自动升级产品分析表结构
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
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def auto_upgrade():
    """自动执行表结构升级"""
    try:
        logger.info("🚀 开始自动升级产品分析表结构")
        
        # 检查数据库连接
        if not db_manager.test_connection():
            logger.error("❌ 数据库连接失败")
            return False
        
        # 检查表是否存在
        if not db_manager.table_exists('product_analytics'):
            logger.error("❌ product_analytics表不存在")
            return False
        
        # 获取当前记录数
        count_sql = "SELECT COUNT(*) as count FROM product_analytics"
        result = db_manager.execute_single(count_sql)
        original_count = result['count'] if result else 0
        logger.info(f"📊 原表记录数: {original_count}")
        
        # 创建备份
        backup_table = f"product_analytics_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"💾 创建备份表: {backup_table}")
        
        backup_sql = f"CREATE TABLE {backup_table} AS SELECT * FROM product_analytics"
        db_manager.execute_update(backup_sql)
        
        # 验证备份
        backup_count_sql = f"SELECT COUNT(*) as count FROM {backup_table}"
        backup_result = db_manager.execute_single(backup_count_sql)
        backup_count = backup_result['count'] if backup_result else 0
        logger.info(f"✅ 备份完成，备份记录数: {backup_count}")
        
        # 逐个添加字段，避免一次性执行过多SQL
        new_fields = [
            ("currency", "VARCHAR(10) DEFAULT 'USD' COMMENT '货币类型'"),
            ("shop_id", "VARCHAR(20) COMMENT '店铺ID'"),
            ("dev_id", "VARCHAR(20) COMMENT '开发者ID'"),
            ("operator_id", "VARCHAR(20) COMMENT '操作员ID'"),
            ("tag_id", "VARCHAR(50) COMMENT '标签ID'"),
            ("brand_id", "VARCHAR(20) COMMENT '品牌ID'"),
            ("category_id", "VARCHAR(50) COMMENT '分类ID'"),
            ("online_status", "VARCHAR(20) COMMENT '在线状态'"),
            ("asin_type", "VARCHAR(20) COMMENT 'ASIN类型'"),
            ("stock_status", "VARCHAR(50) COMMENT '库存状态'"),
            ("ad_cost", "DECIMAL(12,2) DEFAULT 0.00 COMMENT '广告花费'"),
            ("ad_sales", "DECIMAL(12,2) DEFAULT 0.00 COMMENT '广告销售额'"),
            ("cpc", "DECIMAL(8,4) DEFAULT 0.0000 COMMENT '每次点击成本'"),
            ("cpa", "DECIMAL(8,4) DEFAULT 0.0000 COMMENT '每次转化成本'"),
            ("ad_orders", "INT(11) DEFAULT 0 COMMENT '广告订单数'"),
            ("ad_conversion_rate", "DECIMAL(6,4) DEFAULT 0.0000 COMMENT '广告转化率'"),
            ("order_count", "INT(11) DEFAULT 0 COMMENT '订单数量'"),
            ("refund_count", "INT(11) DEFAULT 0 COMMENT '退款数量'"),
            ("refund_rate", "DECIMAL(6,4) DEFAULT 0.0000 COMMENT '退款率'"),
            ("return_count", "INT(11) DEFAULT 0 COMMENT '退货数量'"),
            ("return_rate", "DECIMAL(6,4) DEFAULT 0.0000 COMMENT '退货率'"),
            ("rating", "DECIMAL(3,2) DEFAULT 0.00 COMMENT '评分'"),
            ("rating_count", "INT(11) DEFAULT 0 COMMENT '评分数量'"),
            ("title", "VARCHAR(500) COMMENT '商品标题'"),
            ("brand_name", "VARCHAR(100) COMMENT '品牌名称'"),
            ("category_name", "VARCHAR(100) COMMENT '分类名称'"),
            ("profit_amount", "DECIMAL(12,2) DEFAULT 0.00 COMMENT '利润金额'"),
            ("profit_rate", "DECIMAL(6,4) DEFAULT 0.0000 COMMENT '利润率'"),
            ("avg_profit", "DECIMAL(8,2) DEFAULT 0.00 COMMENT '平均利润'"),
            ("available_days", "DECIMAL(8,1) DEFAULT 0.0 COMMENT '可用天数'"),
            ("fba_inventory", "INT(11) DEFAULT 0 COMMENT 'FBA库存'"),
            ("total_inventory", "INT(11) DEFAULT 0 COMMENT '总库存'"),
            ("shop_ids", "JSON COMMENT '店铺ID列表'"),
            ("dev_ids", "JSON COMMENT '开发者ID列表'"),
            ("operator_ids", "JSON COMMENT '操作员ID列表'"),
            ("marketplace_ids", "JSON COMMENT '市场ID列表'"),
            ("label_ids", "JSON COMMENT '标签ID列表'"),
            ("brand_ids", "JSON COMMENT '品牌ID列表'"),
            ("ad_types", "JSON COMMENT '广告类型列表'"),
            ("open_date", "DATE COMMENT '产品上线日期'"),
            ("is_low_cost_store", "BOOLEAN DEFAULT FALSE COMMENT '是否低价店铺'")
        ]
        
        added_count = 0
        for field_name, field_definition in new_fields:
            try:
                alter_sql = f"ALTER TABLE product_analytics ADD COLUMN {field_name} {field_definition}"
                db_manager.execute_update(alter_sql)
                added_count += 1
                logger.info(f"✅ 添加字段: {field_name}")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    logger.warning(f"⚠️  字段已存在: {field_name}")
                else:
                    logger.error(f"❌ 添加字段失败: {field_name} - {e}")
        
        logger.info(f"🎉 字段添加完成，成功添加 {added_count} 个新字段")
        
        # 验证最终结果
        columns_sql = "SHOW COLUMNS FROM product_analytics"
        columns = db_manager.execute_query(columns_sql)
        final_field_count = len(columns)
        
        final_count_sql = "SELECT COUNT(*) as count FROM product_analytics"
        final_result = db_manager.execute_single(final_count_sql)
        final_count = final_result['count'] if final_result else 0
        
        logger.info(f"📊 升级后统计:")
        logger.info(f"   - 字段总数: {final_field_count}")
        logger.info(f"   - 记录总数: {final_count}")
        logger.info(f"   - 备份表: {backup_table}")
        
        if final_count == original_count:
            logger.info("✅ 数据完整性验证通过")
            return True
        else:
            logger.error(f"❌ 数据完整性验证失败: 原{original_count} vs 现{final_count}")
            return False
            
    except Exception as e:
        logger.error(f"❌ 自动升级失败: {e}")
        return False
    finally:
        db_manager.close_all_connections()

if __name__ == "__main__":
    success = auto_upgrade()
    if success:
        print("✅ 数据库表结构升级成功完成！")
        sys.exit(0)
    else:
        print("❌ 数据库表结构升级失败！")
        sys.exit(1)