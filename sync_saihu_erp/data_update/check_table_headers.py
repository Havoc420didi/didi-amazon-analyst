#!/usr/bin/env python3
"""
检查库存合并表格的字段结构
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def check_table_headers():
    """检查表头字段"""
    
    print("=" * 80)
    print("🔍 检查库存合并表格字段结构")
    print("=" * 80)
    
    # 需要的字段列表
    required_fields = [
        ('asin', 'ASIN'),
        ('product_name', '品名'),
        ('sales_person', '业务员'),
        ('marketplace', '库存点'),
        ('fba_available', 'FBA可用'),
        ('fba_inbound', 'FBA在途'),
        ('local_available', '本地仓'),
        ('average_sales', '平均销量'),
        ('daily_sales_amount', '日均销售额'),
        ('total_inventory', '总库存'),
        ('ad_impressions', '广告曝光量'),
        ('ad_clicks', '广告点击量'),
        ('ad_spend', '广告花费'),
        ('ad_order_count', '广告订单量'),
        ('turnover_days', '库存周转天数'),
        ('inventory_status', '库存状态'),
        ('ad_ctr', '广告点击率'),
        ('ad_cvr', '广告转化率'),
        ('acoas', 'ACOAS')
    ]
    
    db_manager = DatabaseManager()
    
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 获取表结构
            cursor.execute("DESC inventory_points")
            columns = cursor.fetchall()
            
            # 创建字段映射
            existing_fields = {}
            for col in columns:
                field_name = col['Field'] if 'Field' in col else col[0]
                field_type = col['Type'] if 'Type' in col else col[1]
                existing_fields[field_name.lower()] = field_type
            
            print("1️⃣ 字段对照检查:")
            print("   字段名\t\t中文名\t\t存在状态\t字段类型")
            print("   " + "-" * 70)
            
            missing_fields = []
            present_fields = []
            
            for field_name, chinese_name in required_fields:
                field_lower = field_name.lower()
                if field_lower in existing_fields:
                    field_type = existing_fields[field_lower]
                    status = "✅ 存在"
                    present_fields.append((field_name, chinese_name))
                    print(f"   {field_name:<20}\t{chinese_name:<8}\t{status}\t{field_type}")
                else:
                    status = "❌ 缺失"
                    missing_fields.append((field_name, chinese_name))
                    print(f"   {field_name:<20}\t{chinese_name:<8}\t{status}\t-")
            
            print(f"\n2️⃣ 统计结果:")
            total_required = len(required_fields)
            present_count = len(present_fields)
            missing_count = len(missing_fields)
            
            print(f"   需要字段总数: {total_required}")
            print(f"   已存在字段: {present_count} ({present_count/total_required*100:.1f}%)")
            print(f"   缺失字段: {missing_count} ({missing_count/total_required*100:.1f}%)")
            
            if missing_fields:
                print(f"\n❌ 缺失的字段:")
                for field_name, chinese_name in missing_fields:
                    print(f"   - {field_name} ({chinese_name})")
            
            # 检查数据样本
            print(f"\n3️⃣ 数据样本检查:")
            if present_count > 0:
                # 构建查询语句，只查询存在的字段
                present_field_names = [field[0] for field in present_fields[:10]]  # 限制字段数量避免输出过宽
                field_list = ', '.join(present_field_names)
                
                cursor.execute(f"""
                    SELECT {field_list}
                    FROM inventory_points 
                    WHERE data_date = '2025-07-27'
                    LIMIT 3
                """)
                
                results = cursor.fetchall()
                
                if results:
                    print("   前3条记录的部分字段数据:")
                    for i, row in enumerate(results, 1):
                        print(f"   记录{i}:")
                        for field_name in present_field_names:
                            value = row.get(field_name, 'N/A')
                            chinese_name = next((cn for fn, cn in present_fields if fn == field_name), field_name)
                            print(f"     {chinese_name}: {value}")
                        print()
            
            # 检查关键计算字段的数据
            print(f"4️⃣ 关键计算字段数据检查:")
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(CASE WHEN ad_ctr > 0 THEN 1 END) as has_ctr,
                    COUNT(CASE WHEN ad_cvr > 0 THEN 1 END) as has_cvr,
                    COUNT(CASE WHEN acoas > 0 THEN 1 END) as has_acoas,
                    COUNT(CASE WHEN turnover_days > 0 THEN 1 END) as has_turnover,
                    AVG(ad_ctr) as avg_ctr,
                    AVG(ad_cvr) as avg_cvr,
                    AVG(acoas) as avg_acoas
                FROM inventory_points 
                WHERE data_date = '2025-07-27'
            """)
            
            stats = cursor.fetchone()
            if stats:
                total = stats['total_records']
                print(f"   总记录数: {total}")
                print(f"   有广告点击率数据: {stats['has_ctr']} ({stats['has_ctr']/total*100:.1f}%)")
                print(f"   有广告转化率数据: {stats['has_cvr']} ({stats['has_cvr']/total*100:.1f}%)")
                print(f"   有ACOAS数据: {stats['has_acoas']} ({stats['has_acoas']/total*100:.1f}%)")
                print(f"   有库存周转天数: {stats['has_turnover']} ({stats['has_turnover']/total*100:.1f}%)")
                print(f"   平均广告点击率: {stats['avg_ctr']:.4f}")
                print(f"   平均广告转化率: {stats['avg_cvr']:.4f}")
                print(f"   平均ACOAS: {stats['avg_acoas']:.4f}")
    
    print("\n" + "=" * 80)
    print("📋 结论")
    print("=" * 80)
    
    if missing_count == 0:
        print("✅ 所有需要的表头字段都已存在于inventory_points表中")
        print("✅ 表格结构完全符合业务需求")
    else:
        print(f"❌ 缺少 {missing_count} 个必需字段")
        print("⚠️  需要添加缺失的字段以完全满足业务需求")
    
    print("\n📊 字段完整性评估:")
    if present_count >= 15:
        print("🟢 字段完整性: 优秀")
    elif present_count >= 12:
        print("🟡 字段完整性: 良好") 
    else:
        print("🔴 字段完整性: 需要改进")

if __name__ == '__main__':
    check_table_headers()