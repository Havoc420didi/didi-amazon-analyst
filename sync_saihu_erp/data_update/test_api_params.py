#!/usr/bin/env python3
"""
测试产品分析API参数配置
检查API返回的字段完整性
"""
from datetime import date, timedelta
from src.auth.saihu_api_client import saihu_api_client
import json

def test_api_params():
    # 测试最简单的API请求参数
    yesterday = date.today() - timedelta(days=1)
    date_str = yesterday.strftime('%Y-%m-%d')

    print('🧪 测试产品分析API请求参数...')
    print(f'目标日期: {date_str}')

    try:
        # 只使用必需参数
        result = saihu_api_client.fetch_product_analytics(
            start_date=date_str,
            end_date=date_str,
            page_no=1,
            page_size=5,
            currency='USD'
        )
        
        if result and 'rows' in result:
            rows = result['rows']
            print(f'\n✅ 成功获取到 {len(rows)} 条数据')
            
            if rows:
                # 检查第一条数据
                sample = rows[0]
                print('\n📋 数据样本分析:')
                print(f'  ASIN: {sample.get("asin", "N/A")}')
                print(f'  SKU: {sample.get("sku", "N/A")}')
                print(f'  销售额: {sample.get("salesAmount", 0)}')
                print(f'  销售量: {sample.get("salesQuantity", 0)}')
                
                # 检查新字段是否有值
                new_fields_check = [
                    ('title', '商品标题'),
                    ('brandName', '品牌名称'),
                    ('adCost', '广告花费'),
                    ('profitAmount', '利润金额'),
                    ('currency', '货币类型'),
                    ('shopId', '店铺ID'),
                    ('devId', '开发者ID'),
                    ('operatorId', '操作员ID'),
                    ('rating', '评分'),
                    ('categoryName', '分类名称')
                ]
                
                has_data_fields = []
                empty_fields = []
                
                for field, desc in new_fields_check:
                    value = sample.get(field)
                    if value is not None and value != '' and str(value) != '0':
                        has_data_fields.append(f'{desc}({field}): {value}')
                    else:
                        empty_fields.append(f'{desc}({field})')
                
                print(f'\n✅ 有数据的新字段 ({len(has_data_fields)}/{len(new_fields_check)}):')
                for field_info in has_data_fields:
                    print(f'  {field_info}')
                    
                print(f'\n❌ 空值的新字段 ({len(empty_fields)}/{len(new_fields_check)}):')
                for field_info in empty_fields:
                    print(f'  {field_info}')
                
                # 显示完整的字段列表
                print(f'\n🔍 API返回的完整字段列表:')
                all_fields = sorted(sample.keys())
                print(f'  总字段数: {len(all_fields)}')
                print(f'  字段列表: {", ".join(all_fields)}')
                
                # 显示完整的数据样本
                print(f'\n📦 完整数据样本:')
                print(json.dumps(sample, ensure_ascii=False, indent=2))
            
        else:
            print('❌ 未获取到数据')
            if result:
                print(f'API响应: {json.dumps(result, ensure_ascii=False, indent=2)}')

    except Exception as e:
        print(f'❌ 测试失败: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_api_params()