from db import get_engine, create_tables, ProductAnalyze, FbaInventory, SessionLocal
from sqlalchemy.orm import Session

def insert_test_product():
    session = SessionLocal()
    data = {
        'asin': 'B000TEST', 'sku': 'SKU_TEST', 'msku': 'MSKU_TEST', 'spu': 'SPU_TEST',
        'dev_name': '测试员', 'operator_name': '开发者', 'data': {'销量': 999, '利润': 888}
    }
    obj = ProductAnalyze(**data)
    session.add(obj)
    session.commit()
    session.close()
    print('插入产品分析测试数据完成')

def update_test_product():
    session = SessionLocal()
    obj = session.query(ProductAnalyze).filter_by(asin='B000TEST').first()
    if obj:
        obj.data = {'销量': 1000, '利润': 999}
        session.commit()
        print('更新产品分析测试数据完成')
    else:
        print('未找到待更新的产品分析数据')
    session.close()

def insert_test_fba():
    session = SessionLocal()
    data = {
        'sku': 'SKU_TEST', 'asin': 'B000TEST', 'quantity': 123, 'data': {'仓库': '北京', '类型': 'FBA'}
    }
    obj = FbaInventory(**data)
    session.add(obj)
    session.commit()
    session.close()
    print('插入FBA库存测试数据完成')

def update_test_fba():
    session = SessionLocal()
    obj = session.query(FbaInventory).filter_by(sku='SKU_TEST').first()
    if obj:
        obj.quantity = 321
        obj.data = {'仓库': '深圳', '类型': 'FBA'}
        session.commit()
        print('更新FBA库存测试数据完成')
    else:
        print('未找到待更新的FBA库存数据')
    session.close()

if __name__ == '__main__':
    engine = get_engine()
    create_tables(engine)
    insert_test_product()
    update_test_product()
    insert_test_fba()
    update_test_fba()
    # 新增：输入数字写入数据库
    num = input('请输入一个数字，将写入FBA库存quantity字段：')
    try:
        num = int(num)
        session = SessionLocal()
        obj = session.query(FbaInventory).filter_by(sku='SKU_TEST').first()
        if obj:
            obj.quantity = num
            session.commit()
            print(f'已将quantity字段更新为：{num}')
        else:
            print('未找到SKU_TEST的FBA库存数据')
        session.close()
    except Exception as e:
        print('输入有误：', e) 