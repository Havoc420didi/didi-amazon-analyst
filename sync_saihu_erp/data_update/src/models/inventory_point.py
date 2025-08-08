"""
库存点数据模型

定义合并后的库存点数据结构
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, Index
from datetime import datetime
from .base import Base


class InventoryPoint(Base):
    """库存点数据模型"""
    
    __tablename__ = 'inventory_points'
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 基础产品信息
    asin = Column(String(20), nullable=False, comment='产品ASIN')
    product_name = Column(String(500), nullable=False, comment='产品名称')
    sku = Column(String(100), comment='产品SKU')
    category = Column(String(200), comment='产品分类')
    sales_person = Column(String(100), comment='业务员')
    product_tag = Column(String(200), comment='产品标签')
    
    # 库存点信息
    marketplace = Column(String(50), nullable=False, comment='所属库存点/市场')
    store = Column(String(200), comment='店铺名称')
    inventory_point_name = Column(String(100), comment='库存点显示名称')
    
    # 库存数据
    fba_available = Column(Float, default=0, comment='FBA可用库存')
    fba_inbound = Column(Float, default=0, comment='FBA在途库存')
    fba_sellable = Column(Float, default=0, comment='FBA可售库存')
    fba_unsellable = Column(Float, default=0, comment='FBA不可售库存')
    local_available = Column(Float, default=0, comment='本地仓可用库存')
    inbound_shipped = Column(Float, default=0, comment='入库已发货')
    total_inventory = Column(Float, default=0, comment='总库存')
    
    # 销售数据
    sales_7days = Column(Float, default=0, comment='7天销量')
    total_sales = Column(Float, default=0, comment='总销量')
    average_sales = Column(Float, default=0, comment='平均销量')
    order_count = Column(Float, default=0, comment='订单量')
    promotional_orders = Column(Float, default=0, comment='促销订单量')
    
    # 价格信息
    average_price = Column(String(50), comment='平均售价')
    sales_amount = Column(String(50), comment='销售额')
    net_sales = Column(String(50), comment='净销售额')
    refund_rate = Column(String(20), comment='退款率')
    
    # 广告数据
    ad_impressions = Column(Float, default=0, comment='广告曝光量')
    ad_clicks = Column(Float, default=0, comment='广告点击量')
    ad_spend = Column(Float, default=0, comment='广告花费')
    ad_order_count = Column(Float, default=0, comment='广告订单量')
    ad_sales = Column(Float, default=0, comment='广告销售额')
    
    # 计算的广告指标
    ad_ctr = Column(Float, default=0, comment='广告点击率')
    ad_cvr = Column(Float, default=0, comment='广告转化率')
    acoas = Column(Float, default=0, comment='ACOAS')
    ad_cpc = Column(Float, default=0, comment='广告平均点击成本')
    ad_roas = Column(Float, default=0, comment='广告投资回报率')
    ad_sales_per_click = Column(Float, default=0, comment='广告销售转化率')
    ad_cost_ratio = Column(Float, default=0, comment='广告成本占销售额比例')
    
    # 分析指标
    turnover_days = Column(Float, default=0, comment='库存周转天数')
    daily_sales_amount = Column(Float, default=0, comment='日均销售额')
    is_turnover_exceeded = Column(Boolean, default=False, comment='是否周转超标')
    is_out_of_stock = Column(Boolean, default=False, comment='是否断货')
    is_zero_sales = Column(Boolean, default=False, comment='是否零销量')
    is_low_inventory = Column(Boolean, default=False, comment='是否低库存')
    is_effective_point = Column(Boolean, default=False, comment='是否为有效库存点')
    
    # 合并元数据
    merge_type = Column(String(50), comment='合并类型 (eu_merged/non_eu_merged)')
    merged_stores = Column(Text, comment='合并的店铺列表(JSON格式)')
    store_count = Column(Integer, default=1, comment='合并的店铺数量')
    representative_count = Column(Integer, default=1, comment='代表产品数量')
    
    # 数据来源和时间戳
    data_date = Column(String(10), comment='数据日期 YYYY-MM-DD')
    created_at = Column(DateTime, default=datetime.utcnow, comment='创建时间')
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment='更新时间')
    
    # 创建索引
    __table_args__ = (
        Index('idx_asin_marketplace', 'asin', 'marketplace'),
        Index('idx_data_date', 'data_date'),
        Index('idx_sales_person', 'sales_person'),
        Index('idx_marketplace', 'marketplace'),
        Index('idx_created_at', 'created_at'),
        Index('idx_is_effective', 'is_effective_point'),
        Index('idx_turnover_exceeded', 'is_turnover_exceeded'),
        Index('idx_out_of_stock', 'is_out_of_stock'),
    )
    
    def __repr__(self):
        return f"<InventoryPoint(asin='{self.asin}', marketplace='{self.marketplace}', total_inventory={self.total_inventory})>"
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'asin': self.asin,
            'product_name': self.product_name,
            'sku': self.sku,
            'category': self.category,
            'sales_person': self.sales_person,
            'product_tag': self.product_tag,
            'marketplace': self.marketplace,
            'store': self.store,
            'inventory_point_name': self.inventory_point_name,
            
            # 库存数据
            'fba_available': self.fba_available,
            'fba_inbound': self.fba_inbound,
            'fba_sellable': self.fba_sellable,
            'local_available': self.local_available,
            'total_inventory': self.total_inventory,
            
            # 销售数据
            'sales_7days': self.sales_7days,
            'average_sales': self.average_sales,
            'order_count': self.order_count,
            
            # 广告数据
            'ad_impressions': self.ad_impressions,
            'ad_clicks': self.ad_clicks,
            'ad_spend': self.ad_spend,
            'ad_ctr': self.ad_ctr,
            'ad_cvr': self.ad_cvr,
            'acoas': self.acoas,
            
            # 分析指标
            'turnover_days': self.turnover_days,
            'daily_sales_amount': self.daily_sales_amount,
            'is_turnover_exceeded': self.is_turnover_exceeded,
            'is_out_of_stock': self.is_out_of_stock,
            'is_zero_sales': self.is_zero_sales,
            'is_low_inventory': self.is_low_inventory,
            'is_effective_point': self.is_effective_point,
            
            # 元数据
            'merge_type': self.merge_type,
            'store_count': self.store_count,
            'data_date': self.data_date,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def calculate_derived_fields(self):
        """计算派生字段"""
        # 计算总库存
        self.total_inventory = (self.fba_available or 0) + (self.fba_inbound or 0) + (self.local_available or 0)
        
        # 计算库存周转天数
        if self.average_sales and self.average_sales > 0:
            self.turnover_days = round(self.total_inventory / self.average_sales, 1)
        else:
            self.turnover_days = 999 if self.total_inventory > 0 else 0
        
        # 计算日均销售额
        average_price = self._extract_price_from_string(self.average_price or '')
        self.daily_sales_amount = (self.average_sales or 0) * average_price
        
        # 判断各种状态
        self.is_turnover_exceeded = self.turnover_days > 100 or self.turnover_days == 999
        self.is_low_inventory = 0 < self.turnover_days < 45
        self.is_out_of_stock = (self.fba_available or 0) <= 0
        self.is_zero_sales = (self.sales_7days or 0) == 0
        self.is_effective_point = self.daily_sales_amount >= 16.7
    
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


class InventoryPointHistory(Base):
    """库存点历史数据模型"""
    
    __tablename__ = 'inventory_point_history'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    inventory_point_id = Column(Integer, nullable=False, comment='库存点ID')
    
    # 基础信息
    asin = Column(String(20), nullable=False, comment='产品ASIN')
    marketplace = Column(String(50), nullable=False, comment='市场')
    data_date = Column(String(10), nullable=False, comment='数据日期')
    
    # 快照数据
    total_inventory = Column(Float, default=0, comment='总库存快照')
    average_sales = Column(Float, default=0, comment='平均销量快照')
    turnover_days = Column(Float, default=0, comment='周转天数快照')
    daily_sales_amount = Column(Float, default=0, comment='日均销售额快照')
    
    # 广告数据快照
    ad_spend = Column(Float, default=0, comment='广告花费快照')
    ad_sales = Column(Float, default=0, comment='广告销售额快照')
    acoas = Column(Float, default=0, comment='ACOAS快照')
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, comment='创建时间')
    
    __table_args__ = (
        Index('idx_inventory_point_date', 'inventory_point_id', 'data_date'),
        Index('idx_asin_date', 'asin', 'data_date'),
        Index('idx_data_date_hist', 'data_date'),
    )
    
    def __repr__(self):
        return f"<InventoryPointHistory(asin='{self.asin}', date='{self.data_date}', inventory={self.total_inventory})>"