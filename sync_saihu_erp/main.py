import schedule
import time
from db import get_engine, create_tables, ProductAnalyze, FbaInventory, WarehouseItem, SessionLocal
from sqlalchemy.orm import Session

# 伪API数据（无API时用）
def fetch_product_analyze():
    # 实际开发时替换为API请求
    return [{
        'asin': 'B000123', 'sku': 'SKU123', 'msku': 'MSKU123', 'spu': 'SPU123',
        'dev_name': '张三', 'operator_name': '李四', 'data': {'销量': 100, '利润': 200}
    }]

def fetch_fba_inventory():
    return [{
        'sku': 'SKU123', 'asin': 'B000123', 'quantity': 50, 'data': {'仓库': '上海', '类型': 'FBA'}
    }]

def fetch_warehouse_item():
    return [{
        'warehouse_id': 'W001', 'commodity_id': 'C001', 'commodity_sku': 'SKU_W1', 'commodity_name': '测试商品',
        'fn_sku': 'FNSKU001', 'stock_available': 10, 'stock_defective': 1, 'stock_occupy': 2,
        'stock_wait': 0, 'stock_plan': 5, 'stock_all_num': 18, 'data': {'备注': '测试明细'}
    }]

def sync_product_analyze(session: Session):
    data_list = fetch_product_analyze()
    print(f'同步产品分析数据: {data_list}')
    for data in data_list:
        obj = session.query(ProductAnalyze).filter_by(asin=data['asin']).first()
        if obj:
            for k, v in data.items():
                setattr(obj, k, v)
            print(f'更新产品分析数据: {data["asin"]}')
        else:
            obj = ProductAnalyze(**data)
            session.add(obj)
            print(f'插入产品分析数据: {data["asin"]}')
    session.commit()
    print('产品分析数据同步完成')

def sync_fba_inventory(session: Session):
    data_list = fetch_fba_inventory()
    print(f'同步FBA库存数据: {data_list}')
    for data in data_list:
        obj = session.query(FbaInventory).filter_by(sku=data['sku']).first()
        if obj:
            for k, v in data.items():
                setattr(obj, k, v)
            print(f'更新FBA库存数据: {data["sku"]}')
        else:
            obj = FbaInventory(**data)
            session.add(obj)
            print(f'插入FBA库存数据: {data["sku"]}')
    session.commit()
    print('FBA库存数据同步完成')

def sync_warehouse_item(session: Session):
    data_list = fetch_warehouse_item()
    print(f'同步库存明细数据: {data_list}')
    for data in data_list:
        obj = session.query(WarehouseItem).filter_by(commodity_sku=data['commodity_sku']).first()
        if obj:
            for k, v in data.items():
                setattr(obj, k, v)
            print(f'更新库存明细数据: {data["commodity_sku"]}')
        else:
            obj = WarehouseItem(**data)
            session.add(obj)
            print(f'插入库存明细数据: {data["commodity_sku"]}')
    session.commit()
    print('库存明细数据同步完成')

def job():
    session = SessionLocal()
    sync_product_analyze(session)
    sync_fba_inventory(session)
    sync_warehouse_item(session)
    session.close()

if __name__ == '__main__':
    engine = get_engine()
    create_tables(engine)
    schedule.every(3).seconds.do(job)
    print('同步任务已启动，每3秒执行一次...')
    while True:
        schedule.run_pending()
        time.sleep(1) 