#!/usr/bin/env python3
"""
测试数据映射和转换流程
验证API数据能否正确映射到数据库字段
"""
from datetime import date, timedelta
from src.auth.saihu_api_client import saihu_api_client
from src.models.product_analytics import ProductAnalytics
from src.database.connection import db_manager

def test_data_mapping():
    """测试完整的数据映射和转换流程"""
    yesterday = date.today() - timedelta(days=1)
    date_str = yesterday.strftime('%Y-%m-%d')

    print('🧪 测试完整的数据映射和转换流程...')
    print(f'目标日期: {date_str}')

    try:
        # 获取一条API数据
        result = saihu_api_client.fetch_product_analytics(
            start_date=date_str,
            end_date=date_str,
            page_no=1,
            page_size=1,
            currency='USD'
        )
        
        if result and 'rows' in result and result['rows']:
            api_data = result['rows'][0]
            print('\n✅ 成功获取API数据')
            
            # 显示API中的关键字段
            print('\n📋 API数据中的关键字段:')
            api_key_fields = [
                'title', 'currency', 'shopIdList', 'devIdList', 'operatorIdList',
                'brandIdList', 'brands', 'categoryName', 'adCostThis', 'profitPriceThis',
                'ratingThis', 'fbaInventory', 'availableDays'
            ]
            
            for field in api_key_fields:
                value = api_data.get(field, 'N/A')
                print(f'  {field}: {value}')
            
            # 测试数据模型转换
            print('\n🔄 测试ProductAnalytics模型转换...')
            analytics = ProductAnalytics.from_api_response(api_data, yesterday)
            
            print('\n📊 转换后的关键字段检查:')
            key_fields = [
                ('asin', analytics.asin),
                ('sku', analytics.sku),
                ('title', analytics.title),
                ('currency', analytics.currency),
                ('shop_id', analytics.shop_id),
                ('dev_id', analytics.dev_id),
                ('brand_name', analytics.brand_name),
                ('category_name', analytics.category_name),
                ('ad_cost', analytics.ad_cost),
                ('ad_sales', analytics.ad_sales),
                ('profit_amount', analytics.profit_amount),
                ('rating', analytics.rating),
                ('fba_inventory', analytics.fba_inventory),
                ('available_days', analytics.available_days),
                ('shop_ids', analytics.shop_ids),
                ('brand_ids', analytics.brand_ids)
            ]
            
            filled_count = 0
            for field_name, field_value in key_fields:
                is_empty = (field_value is None or field_value == '' or 
                           str(field_value) == '0' or str(field_value) == '0.00')
                if not is_empty:
                    print(f'  ✅ {field_name}: {field_value}')
                    filled_count += 1
                else:
                    print(f'  ❌ {field_name}: {field_value} (空值)')
            
            print(f'\n📈 字段填充率: {filled_count}/{len(key_fields)} ({filled_count/len(key_fields)*100:.1f}%)')
            
            # 测试数据库保存
            print('\n💾 测试数据库保存...')
            save_result = db_manager.batch_save_product_analytics([analytics])
            print(f'保存结果: {save_result} 行受影响')
            
            if save_result > 0:
                print('✅ 数据保存成功！')
                # 验证保存的数据
                verify_sql = '''
                SELECT asin, title, currency, shop_id, ad_cost, profit_amount, 
                       fba_inventory, brand_name, category_name, rating
                FROM product_analytics 
                WHERE asin = %s AND data_date = %s
                ORDER BY updated_at DESC LIMIT 1
                '''
                saved_data = db_manager.execute_single(verify_sql, (analytics.asin, yesterday))
                
                if saved_data:
                    print('\n🔍 数据库中保存的数据验证:')
                    for key, value in saved_data.items():
                        print(f'  {key}: {value}')
                else:
                    print('❌ 数据库验证失败 - 未找到保存的数据')
            
        else:
            print('❌ 未获取到API数据')

    except Exception as e:
        print(f'❌ 测试失败: {e}')
        import traceback
        traceback.print_exc()
    finally:
        db_manager.close_all_connections()

if __name__ == "__main__":
    test_data_mapping()