"""
产品分析数据模型
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any
import json
from .base import BaseModel

class ProductAnalytics(BaseModel):
    """产品分析数据模型"""
    
    def __init__(self,
                 id: Optional[int] = None,
                 product_id: str = None,
                 asin: str = None,
                 sku: str = None,
                 parent_asin: str = None,
                 spu: str = None,
                 msku: str = None,
                 data_date: date = None,
                 sales_amount: Optional[Decimal] = None,
                 sales_quantity: Optional[int] = None,
                 impressions: Optional[int] = None,
                 clicks: Optional[int] = None,
                 conversion_rate: Optional[Decimal] = None,
                 acos: Optional[Decimal] = None,
                 marketplace_id: str = None,
                 dev_name: str = None,
                 operator_name: str = None,
                 # 新增的核心字段
                 currency: str = None,
                 shop_id: str = None,
                 dev_id: str = None,
                 operator_id: str = None,
                 tag_id: str = None,
                 brand_id: str = None,
                 category_id: str = None,
                 online_status: str = None,
                 asin_type: str = None,
                 stock_status: str = None,
                 # 新增的广告指标
                 ad_cost: Optional[Decimal] = None,
                 ad_sales: Optional[Decimal] = None,
                 cpc: Optional[Decimal] = None,
                 cpa: Optional[Decimal] = None,
                 ad_orders: Optional[int] = None,
                 ad_conversion_rate: Optional[Decimal] = None,
                 # 新增的业务指标
                 order_count: Optional[int] = None,
                 refund_count: Optional[int] = None,
                 refund_rate: Optional[Decimal] = None,
                 return_count: Optional[int] = None,
                 return_rate: Optional[Decimal] = None,
                 rating: Optional[Decimal] = None,
                 rating_count: Optional[int] = None,
                 # 新增的商品信息
                 title: str = None,
                 brand_name: str = None,
                 category_name: str = None,
                 # 新增的利润指标
                 profit_amount: Optional[Decimal] = None,
                 profit_rate: Optional[Decimal] = None,
                 avg_profit: Optional[Decimal] = None,
                 # 新增的库存信息
                 available_days: Optional[Decimal] = None,
                 fba_inventory: Optional[int] = None,
                 total_inventory: Optional[int] = None,
                 # JSON字段用于存储多值数据
                 shop_ids: Optional[str] = None,
                 dev_ids: Optional[str] = None,
                 operator_ids: Optional[str] = None,
                 marketplace_ids: Optional[str] = None,
                 label_ids: Optional[str] = None,
                 brand_ids: Optional[str] = None,
                 ad_types: Optional[str] = None,
                 # 新增字段 
                 sessions: Optional[int] = None,
                 page_views: Optional[int] = None,
                 buy_box_price: Optional[Decimal] = None,
                 spu_name: str = None,
                 brand: str = None,
                 # 其他时间字段
                 open_date: Optional[date] = None,
                 is_low_cost_store: Optional[bool] = None,
                 metrics_json: Optional[str] = None,
                 created_at: Optional[datetime] = None,
                 updated_at: Optional[datetime] = None,
                 # 新增的环比字段
                 sales_amount_last: Optional[Decimal] = None,
                 sales_amount_percent: Optional[Decimal] = None,
                 sales_quantity_last: Optional[int] = None,
                 sales_quantity_percent: Optional[Decimal] = None,
                 ad_cost_last: Optional[Decimal] = None,
                 ad_cost_percent: Optional[Decimal] = None,
                 ad_sales_last: Optional[Decimal] = None,
                 ad_sales_percent: Optional[Decimal] = None,
                 refund_amount_this: Optional[Decimal] = None,
                 refund_amount_last: Optional[Decimal] = None,
                 refund_amount_percent: Optional[Decimal] = None,
                 return_count_last: Optional[int] = None,
                 return_count_percent: Optional[Decimal] = None,
                 return_rate_last: Optional[Decimal] = None,
                 return_rate_percent: Optional[Decimal] = None,
                 rating_last: Optional[Decimal] = None,
                 rating_percent: Optional[Decimal] = None,
                 rating_count_last: Optional[int] = None,
                 rating_count_percent: Optional[Decimal] = None,
                 sessions_last: Optional[int] = None,
                 sessions_percent: Optional[Decimal] = None,
                 page_views_last: Optional[int] = None,
                 page_views_percent: Optional[Decimal] = None,
                 buy_box_percent_this: Optional[Decimal] = None,
                 buy_box_percent_last: Optional[Decimal] = None,
                 buy_box_percent_percent: Optional[Decimal] = None,
                 profit_amount_last: Optional[Decimal] = None,
                 profit_amount_percent: Optional[Decimal] = None,
                 profit_rate_last: Optional[Decimal] = None,
                 profit_rate_percent: Optional[Decimal] = None,
                 natural_clicks_this: Optional[int] = None,
                 natural_clicks_last: Optional[int] = None,
                 natural_clicks_percent: Optional[Decimal] = None,
                 natural_orders_this: Optional[int] = None,
                 natural_orders_last: Optional[int] = None,
                 natural_orders_percent: Optional[Decimal] = None,
                 promotion_orders_this: Optional[int] = None,
                 promotion_orders_last: Optional[int] = None,
                 promotion_orders_percent: Optional[Decimal] = None,
                 promotion_sales_this: Optional[int] = None,
                 promotion_sales_last: Optional[int] = None,
                 promotion_sales_percent: Optional[Decimal] = None,
                 cancel_orders_this: Optional[int] = None,
                 cancel_orders_last: Optional[int] = None,
                 cancel_orders_percent: Optional[Decimal] = None,
                 review_rate_this: Optional[Decimal] = None,
                 review_rate_last: Optional[Decimal] = None,
                 review_rate_percent: Optional[Decimal] = None,
                 net_sales_amount_this: Optional[Decimal] = None,
                 net_sales_amount_last: Optional[Decimal] = None,
                 net_sales_amount_percent: Optional[Decimal] = None,
                 **kwargs):
        
        # 基础字段
        self.id = id
        self.product_id = product_id
        self.asin = asin
        self.sku = sku
        self.parent_asin = parent_asin
        self.spu = spu
        self.msku = msku
        self.data_date = data_date
        self.sales_amount = sales_amount or Decimal('0.00')
        self.sales_quantity = sales_quantity or 0
        self.impressions = impressions or 0
        self.clicks = clicks or 0
        self.conversion_rate = conversion_rate or Decimal('0.0000')
        self.acos = acos or Decimal('0.0000')
        self.marketplace_id = marketplace_id
        self.dev_name = dev_name
        self.operator_name = operator_name
        
        # 新增的核心字段
        self.currency = currency or 'USD'
        self.shop_id = shop_id
        self.dev_id = dev_id
        self.operator_id = operator_id
        self.tag_id = tag_id
        self.brand_id = brand_id
        self.category_id = category_id
        self.online_status = online_status
        self.asin_type = asin_type
        self.stock_status = stock_status
        
        # 新增的广告指标
        self.ad_cost = ad_cost or Decimal('0.00')
        self.ad_sales = ad_sales or Decimal('0.00')
        self.cpc = cpc or Decimal('0.0000')
        self.cpa = cpa or Decimal('0.0000')
        self.ad_orders = ad_orders or 0
        self.ad_conversion_rate = ad_conversion_rate or Decimal('0.0000')
        
        # 新增的业务指标
        self.order_count = order_count or 0
        self.refund_count = refund_count or 0
        self.refund_rate = refund_rate or Decimal('0.0000')
        self.return_count = return_count or 0
        self.return_rate = return_rate or Decimal('0.0000')
        self.rating = rating or Decimal('0.00')
        self.rating_count = rating_count or 0
        
        # 新增的商品信息
        self.title = title
        self.brand_name = brand_name
        self.category_name = category_name
        
        # 新增的利润指标
        self.profit_amount = profit_amount or Decimal('0.00')
        self.profit_rate = profit_rate or Decimal('0.0000')
        self.avg_profit = avg_profit or Decimal('0.00')
        
        # 新增的库存信息
        self.available_days = available_days or Decimal('0.0')
        self.fba_inventory = fba_inventory or 0
        self.total_inventory = total_inventory or 0
        
        # JSON字段用于存储多值数据
        self.shop_ids = shop_ids
        self.dev_ids = dev_ids
        self.operator_ids = operator_ids
        self.marketplace_ids = marketplace_ids
        self.label_ids = label_ids
        self.brand_ids = brand_ids
        self.ad_types = ad_types
        
        # 新增字段初始化
        self.sessions = sessions or 0
        self.page_views = page_views or 0
        self.buy_box_price = buy_box_price
        self.spu_name = spu_name
        self.brand = brand
        
        # 其他字段
        self.open_date = open_date
        self.is_low_cost_store = is_low_cost_store
        self.metrics_json = metrics_json
        self.created_at = created_at
        self.updated_at = updated_at
        
        # 新增的环比字段
        self.sales_amount_last = sales_amount_last or Decimal('0.00')
        self.sales_amount_percent = sales_amount_percent or Decimal('0.0000')
        self.sales_quantity_last = sales_quantity_last or 0
        self.sales_quantity_percent = sales_quantity_percent or Decimal('0.0000')
        self.ad_cost_last = ad_cost_last or Decimal('0.00')
        self.ad_cost_percent = ad_cost_percent or Decimal('0.0000')
        self.ad_sales_last = ad_sales_last or Decimal('0.00')
        self.ad_sales_percent = ad_sales_percent or Decimal('0.0000')
        self.refund_amount_this = refund_amount_this or Decimal('0.00')
        self.refund_amount_last = refund_amount_last or Decimal('0.00')
        self.refund_amount_percent = refund_amount_percent or Decimal('0.0000')
        self.return_count_last = return_count_last or 0
        self.return_count_percent = return_count_percent or Decimal('0.0000')
        self.return_rate_last = return_rate_last or Decimal('0.0000')
        self.return_rate_percent = return_rate_percent or Decimal('0.0000')
        self.rating_last = rating_last or Decimal('0.00')
        self.rating_percent = rating_percent or Decimal('0.0000')
        self.rating_count_last = rating_count_last or 0
        self.rating_count_percent = rating_count_percent or Decimal('0.0000')
        self.sessions_last = sessions_last or 0
        self.sessions_percent = sessions_percent or Decimal('0.0000')
        self.page_views_last = page_views_last or 0
        self.page_views_percent = page_views_percent or Decimal('0.0000')
        self.buy_box_percent_this = buy_box_percent_this or Decimal('0.0000')
        self.buy_box_percent_last = buy_box_percent_last or Decimal('0.0000')
        self.buy_box_percent_percent = buy_box_percent_percent or Decimal('0.0000')
        self.profit_amount_last = profit_amount_last or Decimal('0.00')
        self.profit_amount_percent = profit_amount_percent or Decimal('0.0000')
        self.profit_rate_last = profit_rate_last or Decimal('0.0000')
        self.profit_rate_percent = profit_rate_percent or Decimal('0.0000')
        self.natural_clicks_this = natural_clicks_this or 0
        self.natural_clicks_last = natural_clicks_last or 0
        self.natural_clicks_percent = natural_clicks_percent or Decimal('0.0000')
        self.natural_orders_this = natural_orders_this or 0
        self.natural_orders_last = natural_orders_last or 0
        self.natural_orders_percent = natural_orders_percent or Decimal('0.0000')
        self.promotion_orders_this = promotion_orders_this or 0
        self.promotion_orders_last = promotion_orders_last or 0
        self.promotion_orders_percent = promotion_orders_percent or Decimal('0.0000')
        self.promotion_sales_this = promotion_sales_this or 0
        self.promotion_sales_last = promotion_sales_last or 0
        self.promotion_sales_percent = promotion_sales_percent or Decimal('0.0000')
        self.cancel_orders_this = cancel_orders_this or 0
        self.cancel_orders_last = cancel_orders_last or 0
        self.cancel_orders_percent = cancel_orders_percent or Decimal('0.0000')
        self.review_rate_this = review_rate_this or Decimal('0.0000')
        self.review_rate_last = review_rate_last or Decimal('0.0000')
        self.review_rate_percent = review_rate_percent or Decimal('0.0000')
        self.net_sales_amount_this = net_sales_amount_this or Decimal('0.00')
        self.net_sales_amount_last = net_sales_amount_last or Decimal('0.00')
        self.net_sales_amount_percent = net_sales_amount_percent or Decimal('0.0000')
        
        # 额外的指标数据
        self._additional_metrics = kwargs
    
    def set_metrics(self, metrics: Dict[str, Any]) -> None:
        """设置额外的指标数据"""
        self._additional_metrics.update(metrics)
        self.metrics_json = json.dumps(self._additional_metrics, default=str, ensure_ascii=False)
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取额外的指标数据"""
        if self.metrics_json:
            try:
                return json.loads(self.metrics_json)
            except json.JSONDecodeError:
                return {}
        return self._additional_metrics or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        data = {
            'id': self.id,
            'product_id': self.product_id,
            'asin': self.asin,
            'sku': self.sku,
            'parent_asin': self.parent_asin,
            'spu': self.spu,
            'msku': self.msku,
            'data_date': self.data_date.isoformat() if self.data_date else None,
            'sales_amount': float(self.sales_amount) if self.sales_amount else 0.0,
            'sales_quantity': self.sales_quantity,
            'impressions': self.impressions,
            'clicks': self.clicks,
            'conversion_rate': float(self.conversion_rate) if self.conversion_rate else 0.0,
            'acos': float(self.acos) if self.acos else 0.0,
            'marketplace_id': self.marketplace_id,
            'dev_name': self.dev_name,
            'operator_name': self.operator_name,
            'currency': self.currency,
            'shop_id': self.shop_id,
            'dev_id': self.dev_id,
            'operator_id': self.operator_id,
            'tag_id': self.tag_id,
            'brand_id': self.brand_id,
            'category_id': self.category_id,
            'online_status': self.online_status,
            'asin_type': self.asin_type,
            'stock_status': self.stock_status,
            'ad_cost': float(self.ad_cost) if self.ad_cost else 0.0,
            'ad_sales': float(self.ad_sales) if self.ad_sales else 0.0,
            'cpc': float(self.cpc) if self.cpc else 0.0,
            'cpa': float(self.cpa) if self.cpa else 0.0,
            'ad_orders': self.ad_orders,
            'ad_conversion_rate': float(self.ad_conversion_rate) if self.ad_conversion_rate else 0.0,
            'order_count': self.order_count,
            'refund_count': self.refund_count,
            'refund_rate': float(self.refund_rate) if self.refund_rate else 0.0,
            'return_count': self.return_count,
            'return_rate': float(self.return_rate) if self.return_rate else 0.0,
            'rating': float(self.rating) if self.rating else 0.0,
            'rating_count': self.rating_count,
            'title': self.title,
            'brand_name': self.brand_name,
            'category_name': self.category_name,
            'profit_amount': float(self.profit_amount) if self.profit_amount else 0.0,
            'profit_rate': float(self.profit_rate) if self.profit_rate else 0.0,
            'avg_profit': float(self.avg_profit) if self.avg_profit else 0.0,
            'available_days': float(self.available_days) if self.available_days else 0.0,
            'fba_inventory': self.fba_inventory,
            'total_inventory': self.total_inventory,
            'shop_ids': self.shop_ids,
            'dev_ids': self.dev_ids,
            'operator_ids': self.operator_ids,
            'marketplace_ids': self.marketplace_ids,
            'label_ids': self.label_ids,
            'brand_ids': self.brand_ids,
            'ad_types': self.ad_types,
            'sessions': self.sessions,
            'page_views': self.page_views,
            'buy_box_price': float(self.buy_box_price) if self.buy_box_price else None,
            'spu_name': self.spu_name,
            'brand': self.brand,
            'open_date': self.open_date.isoformat() if self.open_date else None,
            'is_low_cost_store': self.is_low_cost_store,
            'metrics_json': self.metrics_json,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # 新增的环比字段
            'sales_amount_last': float(self.sales_amount_last) if self.sales_amount_last else 0.0,
            'sales_amount_percent': float(self.sales_amount_percent) if self.sales_amount_percent else 0.0,
            'sales_quantity_last': self.sales_quantity_last,
            'sales_quantity_percent': float(self.sales_quantity_percent) if self.sales_quantity_percent else 0.0,
            'ad_cost_last': float(self.ad_cost_last) if self.ad_cost_last else 0.0,
            'ad_cost_percent': float(self.ad_cost_percent) if self.ad_cost_percent else 0.0,
            'ad_sales_last': float(self.ad_sales_last) if self.ad_sales_last else 0.0,
            'ad_sales_percent': float(self.ad_sales_percent) if self.ad_sales_percent else 0.0,
            'refund_amount_this': float(self.refund_amount_this) if self.refund_amount_this else 0.0,
            'refund_amount_last': float(self.refund_amount_last) if self.refund_amount_last else 0.0,
            'refund_amount_percent': float(self.refund_amount_percent) if self.refund_amount_percent else 0.0,
            'return_count_last': self.return_count_last,
            'return_count_percent': float(self.return_count_percent) if self.return_count_percent else 0.0,
            'return_rate_last': float(self.return_rate_last) if self.return_rate_last else 0.0,
            'return_rate_percent': float(self.return_rate_percent) if self.return_rate_percent else 0.0,
            'rating_last': float(self.rating_last) if self.rating_last else 0.0,
            'rating_percent': float(self.rating_percent) if self.rating_percent else 0.0,
            'rating_count_last': self.rating_count_last,
            'rating_count_percent': float(self.rating_count_percent) if self.rating_count_percent else 0.0,
            'sessions_last': self.sessions_last,
            'sessions_percent': float(self.sessions_percent) if self.sessions_percent else 0.0,
            'page_views_last': self.page_views_last,
            'page_views_percent': float(self.page_views_percent) if self.page_views_percent else 0.0,
            'buy_box_percent_this': float(self.buy_box_percent_this) if self.buy_box_percent_this else 0.0,
            'buy_box_percent_last': float(self.buy_box_percent_last) if self.buy_box_percent_last else 0.0,
            'buy_box_percent_percent': float(self.buy_box_percent_percent) if self.buy_box_percent_percent else 0.0,
            'profit_amount_last': float(self.profit_amount_last) if self.profit_amount_last else 0.0,
            'profit_amount_percent': float(self.profit_amount_percent) if self.profit_amount_percent else 0.0,
            'profit_rate_last': float(self.profit_rate_last) if self.profit_rate_last else 0.0,
            'profit_rate_percent': float(self.profit_rate_percent) if self.profit_rate_percent else 0.0,
            'natural_clicks_this': self.natural_clicks_this,
            'natural_clicks_last': self.natural_clicks_last,
            'natural_clicks_percent': float(self.natural_clicks_percent) if self.natural_clicks_percent else 0.0,
            'natural_orders_this': self.natural_orders_this,
            'natural_orders_last': self.natural_orders_last,
            'natural_orders_percent': float(self.natural_orders_percent) if self.natural_orders_percent else 0.0,
            'promotion_orders_this': self.promotion_orders_this,
            'promotion_orders_last': self.promotion_orders_last,
            'promotion_orders_percent': float(self.promotion_orders_percent) if self.promotion_orders_percent else 0.0,
            'promotion_sales_this': self.promotion_sales_this,
            'promotion_sales_last': self.promotion_sales_last,
            'promotion_sales_percent': float(self.promotion_sales_percent) if self.promotion_sales_percent else 0.0,
            'cancel_orders_this': self.cancel_orders_this,
            'cancel_orders_last': self.cancel_orders_last,
            'cancel_orders_percent': float(self.cancel_orders_percent) if self.cancel_orders_percent else 0.0,
            'review_rate_this': float(self.review_rate_this) if self.review_rate_this else 0.0,
            'review_rate_last': float(self.review_rate_last) if self.review_rate_last else 0.0,
            'review_rate_percent': float(self.review_rate_percent) if self.review_rate_percent else 0.0,
            'net_sales_amount_this': float(self.net_sales_amount_this) if self.net_sales_amount_this else 0.0,
            'net_sales_amount_last': float(self.net_sales_amount_last) if self.net_sales_amount_last else 0.0,
            'net_sales_amount_percent': float(self.net_sales_amount_percent) if self.net_sales_amount_percent else 0.0,
        }
        
        # 添加额外指标
        data.update(self._additional_metrics)
        
        return data
    
    @classmethod
    def from_api_response(cls, api_data: Dict[str, Any], target_date: Optional['date'] = None) -> 'ProductAnalytics':
        """从API响应数据创建实例"""
        # 字段映射 - 根据新的API响应字段名
        field_mapping = {
            # 基础字段
            'asinList': 'asin',  # 取第一个ASIN
            'skuList': 'sku',  # 取第一个SKU  
            'parentAsinList': 'parent_asin',  # 取第一个父ASIN
            'spu': 'spu',
            'mskuList': 'msku',  # 取第一个MSKU
            'salePriceThis': 'sales_amount',
            'productTotalNumThis': 'sales_quantity',
            'adImpressionsThis': 'impressions',
            'adClicksThis': 'clicks',
            'conversionRateThis': 'conversion_rate', 
            'acosThis': 'acos',
            'marketplaceIdList': 'marketplace_id',  # 取第一个市场ID
            'devNameList': 'dev_name',  # 取第一个开发者名称
            'operatorNameList': 'operator_name',  # 取第一个操作员名称
            
            # 新增的核心字段
            'currency': 'currency',
            'shopIdList': 'shop_id',  # 取第一个店铺ID
            'devIdList': 'dev_id',  # 取第一个开发者ID
            'operatorIdList': 'operator_id',  # 取第一个操作员ID
            'categoryName': 'category_name',  # 取第一个分类名称
            
            # 新增的广告指标
            'adCostThis': 'ad_cost',
            'adTotalSalesThis': 'ad_sales',
            'cpcThis': 'cpc',
            'cpaThis': 'cpa',
            'adOrderNumThis': 'ad_orders',
            'adConversionRateThis': 'ad_conversion_rate',
            
            # 新增的业务指标
            'orderNumThis': 'order_count',
            'refundNumThis': 'refund_count',
            'refundRateThis': 'refund_rate',
            'returnSaleNumThis': 'return_count',
            'returnSaleRateThis': 'return_rate',
            'ratingThis': 'rating',
            'ratingCountThis': 'rating_count',
            
            # 新增的商品信息
            'title': 'title',
            'brands': 'brand_name',  # 取第一个品牌名称
            'brandIdList': 'brand',  # 品牌ID映射到brand字段
            
            # 新增的利润指标
            'profitPriceThis': 'profit_amount',
            'profitRateThis': 'profit_rate',
            'avgProfitThis': 'avg_profit',
            
            # 新增的库存信息
            'availableDays': 'available_days',
            'fbaInventory': 'fba_inventory',
            'totalInventory': 'total_inventory',
            
            # 新增的会话和页面浏览数据
            'sessionsThis': 'sessions',
            'pageViewThis': 'page_views',
            
            # 价格信息
            'buyBoxPrice': 'buy_box_price',
            
            # SPU信息
            'spuName': 'spu_name',
            
            # 产品标识
            'productIdList': 'product_id',  # 取第一个产品ID
            
            # 新增的环比字段映射
            'salePriceLast': 'sales_amount_last',
            'salePricePercent': 'sales_amount_percent',
            'productTotalNumLast': 'sales_quantity_last',
            'productTotalNumPercent': 'sales_quantity_percent',
            'adCostLast': 'ad_cost_last',
            'adCostPercent': 'ad_cost_percent',
            'adTotalSalesLast': 'ad_sales_last',
            'adTotalSalesPercent': 'ad_sales_percent',
            'refundPriceThis': 'refund_amount_this',
            'refundPriceLast': 'refund_amount_last',
            'refundPricePercent': 'refund_amount_percent',
            'returnSaleNumLast': 'return_count_last',
            'returnSaleNumPercent': 'return_count_percent',
            'returnSaleRateLast': 'return_rate_last',
            'returnSaleRatePercent': 'return_rate_percent',
            'ratingLast': 'rating_last',
            'ratingPercent': 'rating_percent',
            'ratingCountLast': 'rating_count_last',
            'ratingCountPercent': 'rating_count_percent',
            'sessionsLast': 'sessions_last',
            'sessionsPercent': 'sessions_percent',
            'pageViewLast': 'page_views_last',
            'pageViewPercent': 'page_views_percent',
            'buyBoxPercentThis': 'buy_box_percent_this',
            'buyBoxPercentLast': 'buy_box_percent_last',
            'buyBoxPercentPercent': 'buy_box_percent_percent',
            'profitPriceLast': 'profit_amount_last',
            'profitPricePercent': 'profit_amount_percent',
            'profitRateLast': 'profit_rate_last',
            'profitRatePercent': 'profit_rate_percent',
            'naturalClickThis': 'natural_clicks_this',
            'naturalClickLast': 'natural_clicks_last',
            'naturalClickPercent': 'natural_clicks_percent',
            'naturalOrderNumThis': 'natural_orders_this',
            'naturalOrderNumLast': 'natural_orders_last',
            'naturalOrderNumPercent': 'natural_orders_percent',
            'promotionOrderNumThis': 'promotion_orders_this',
            'promotionOrderNumLast': 'promotion_orders_last',
            'promotionOrderNumPercent': 'promotion_orders_percent',
            'promotionSaleNumThis': 'promotion_sales_this',
            'promotionSaleNumLast': 'promotion_sales_last',
            'promotionSaleNumPercent': 'promotion_sales_percent',
            'cancelOrderNumThis': 'cancel_orders_this',
            'cancelOrderNumLast': 'cancel_orders_last',
            'cancelOrderNumPercent': 'cancel_orders_percent',
            'reviewRateThis': 'review_rate_this',
            'reviewRateLast': 'review_rate_last',
            'reviewRatePercent': 'review_rate_percent',
            'salesPriceNetThis': 'net_sales_amount_this',
            'salesPriceNetLast': 'net_sales_amount_last',
            'salesPriceNetPercent': 'net_sales_amount_percent',
        }
        
        # JSON字段映射（存储完整的列表数据）
        json_field_mapping = {
            'shopIdList': 'shop_ids',
            'devIdList': 'dev_ids',
            'operatorIdList': 'operator_ids',
            'marketplaceIdList': 'marketplace_ids',
            'labelIdList': 'label_ids',
            'brandIdList': 'brand_ids',
            'adTypeList': 'ad_types'
        }
        
        mapped_data = {}
        additional_metrics = {}
        
        # 处理JSON字段映射（优先处理，避免被普通字段映射覆盖）
        for api_key, api_value in api_data.items():
            if api_key in json_field_mapping:
                # 处理JSON字段（存储完整列表）
                json_key = json_field_mapping[api_key]
                if isinstance(api_value, list):
                    mapped_data[json_key] = json.dumps(api_value, ensure_ascii=False)
                else:
                    mapped_data[json_key] = json.dumps([api_value] if api_value else [], ensure_ascii=False)
        
        # 处理普通字段映射
        for api_key, api_value in api_data.items():
            if api_key in field_mapping:
                mapped_key = field_mapping[api_key]
                
                # 处理列表类型字段（取第一个值）
                list_fields = ['asin', 'sku', 'parent_asin', 'msku', 'marketplace_id', 'dev_name', 'operator_name', 
                              'shop_id', 'dev_id', 'operator_id', 'category_name', 'brand_name', 'brand', 'product_id']
                if mapped_key in list_fields and isinstance(api_value, list):
                    api_value = api_value[0] if api_value else None
                
                # 类型转换
                if mapped_key == 'data_date' and isinstance(api_value, str):
                    from datetime import datetime
                    mapped_data[mapped_key] = datetime.strptime(api_value, '%Y-%m-%d').date()
                elif mapped_key in ['sales_amount', 'conversion_rate', 'acos', 'ad_cost', 'ad_sales', 'cpc', 'cpa', 
                                  'ad_conversion_rate', 'refund_rate', 'return_rate', 'rating', 'profit_amount', 
                                  'profit_rate', 'avg_profit', 'available_days', 'sales_amount_last', 'sales_amount_percent',
                                  'sales_quantity_percent', 'ad_cost_last', 'ad_cost_percent', 'ad_sales_last', 'ad_sales_percent',
                                  'refund_amount_this', 'refund_amount_last', 'refund_amount_percent', 'return_count_percent',
                                  'return_rate_last', 'return_rate_percent', 'rating_last', 'rating_percent', 'rating_count_percent',
                                  'sessions_percent', 'page_views_percent', 'buy_box_percent_this', 'buy_box_percent_last',
                                  'buy_box_percent_percent', 'profit_amount_last', 'profit_amount_percent', 'profit_rate_last',
                                  'profit_rate_percent', 'natural_clicks_percent', 'natural_orders_percent', 'promotion_orders_percent',
                                  'promotion_sales_percent', 'cancel_orders_percent', 'review_rate_this', 'review_rate_last',
                                  'review_rate_percent', 'net_sales_amount_this', 'net_sales_amount_last', 'net_sales_amount_percent']:
                    try:
                        mapped_data[mapped_key] = Decimal(str(api_value)) if api_value is not None and api_value != '' else Decimal('0.00')
                    except (ValueError, TypeError):
                        mapped_data[mapped_key] = Decimal('0.00')
                elif mapped_key in ['sales_quantity', 'impressions', 'clicks', 'ad_orders', 'order_count', 
                                  'refund_count', 'return_count', 'rating_count', 'fba_inventory', 'total_inventory',
                                  'sessions', 'page_views', 'sales_quantity_last', 'return_count_last', 'rating_count_last',
                                  'sessions_last', 'page_views_last', 'natural_clicks_this', 'natural_clicks_last',
                                  'natural_orders_this', 'natural_orders_last', 'promotion_orders_this', 'promotion_orders_last',
                                  'promotion_sales_this', 'promotion_sales_last', 'cancel_orders_this', 'cancel_orders_last']:
                    try:
                        mapped_data[mapped_key] = int(api_value) if api_value is not None and api_value != '' else 0
                    except (ValueError, TypeError):
                        mapped_data[mapped_key] = 0
                elif mapped_key in ['buy_box_price']:
                    try:
                        mapped_data[mapped_key] = Decimal(str(api_value)) if api_value is not None and api_value != '' else None
                    except (ValueError, TypeError):
                        mapped_data[mapped_key] = None
                else:
                    mapped_data[mapped_key] = api_value
            elif api_key not in json_field_mapping:  # 避免重复处理JSON字段
                # 未映射的字段作为额外指标
                additional_metrics[api_key] = api_value
        
        # 处理嵌套对象字段
        if 'inventoryManage' in api_data and isinstance(api_data['inventoryManage'], dict):
            inventory_manage = api_data['inventoryManage']
            # 如果总库存数据没有从其他地方获取到，从inventoryManage获取
            if 'total_inventory' not in mapped_data or mapped_data['total_inventory'] == 0:
                if 'totalInventory' in inventory_manage:
                    try:
                        mapped_data['total_inventory'] = int(inventory_manage['totalInventory']) if inventory_manage['totalInventory'] else 0
                    except (ValueError, TypeError):
                        mapped_data['total_inventory'] = 0
        
        # 如果传入了目标日期，使用目标日期覆盖
        if target_date:
            mapped_data['data_date'] = target_date
        
        instance = cls(**mapped_data)
        if additional_metrics:
            instance.set_metrics(additional_metrics)
        
        return instance