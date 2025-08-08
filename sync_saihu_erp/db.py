from sqlalchemy import create_engine, Column, Integer, String, Float, Date, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()

class ProductAnalyze(Base):
    __tablename__ = 'product_analyze'
    id = Column(Integer, primary_key=True, autoincrement=True)
    asin = Column(String)
    sku = Column(String)
    msku = Column(String)
    spu = Column(String)
    dev_name = Column(String)
    operator_name = Column(String)
    data = Column(JSON)  # 其余字段以JSON存储

class FbaInventory(Base):
    __tablename__ = 'fba_inventory'
    id = Column(Integer, primary_key=True, autoincrement=True)
    sku = Column(String)
    asin = Column(String)
    quantity = Column(Integer)
    data = Column(JSON)  # 其余字段以JSON存储

class WarehouseItem(Base):
    __tablename__ = 'warehouse_item'
    id = Column(Integer, primary_key=True, autoincrement=True)
    warehouse_id = Column(String)
    commodity_id = Column(String)
    commodity_sku = Column(String)
    commodity_name = Column(String)
    fn_sku = Column(String)
    stock_available = Column(Integer)
    stock_defective = Column(Integer)
    stock_occupy = Column(Integer)
    stock_wait = Column(Integer)
    stock_plan = Column(Integer)
    stock_all_num = Column(Integer)
    data = Column(JSON)  # 其它字段以JSON存储

def get_engine(db_url='sqlite:///saihu_erp.db'):
    return create_engine(db_url, echo=False)

def create_tables(engine):
    Base.metadata.create_all(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine()) 