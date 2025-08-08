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
                 **kwargs):
        """初始化产品分析数据"""
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
    
    def calculate_ctr(self) -> Decimal:
        """计算点击率 (CTR = clicks / impressions)"""
        if self.impressions and self.impressions > 0:
            return Decimal(str(self.clicks / self.impressions))
        return Decimal('0.0000')
    
    def calculate_revenue_per_click(self) -> Decimal:
        """计算每次点击收入 (RPC = sales_amount / clicks)"""
        if self.clicks and self.clicks > 0:
            return self.sales_amount / self.clicks
        return Decimal('0.00')
    
    def is_valid(self) -> bool:
        """验证数据有效性"""
        # 至少需要有ASIN
        if not self.asin:
            return False
            
        if not self.data_date:
            return False
        
        if self.sales_amount is not None and self.sales_amount < 0:
            return False
        
        if self.sales_quantity is not None and self.sales_quantity < 0:
            return False
        
        if self.conversion_rate is not None and (self.conversion_rate < 0 or self.conversion_rate > 100):
            return False
        
        if self.acos is not None and self.acos < 0:
            return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = super().to_dict()
        
        # 处理日期类型
        if isinstance(self.data_date, date):
            data['data_date'] = self.data_date.isoformat()
        
        # 处理Decimal类型
        for key in ['sales_amount', 'conversion_rate', 'acos']:
            if key in data and isinstance(data[key], Decimal):
                data[key] = float(data[key])
        
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
            'productIdList': 'product_id'  # 取第一个产品ID
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
                                  'profit_rate', 'avg_profit', 'available_days']:
                    try:
                        mapped_data[mapped_key] = Decimal(str(api_value)) if api_value is not None and api_value != '' else Decimal('0.00')
                    except (ValueError, TypeError):
                        mapped_data[mapped_key] = Decimal('0.00')
                elif mapped_key in ['sales_quantity', 'impressions', 'clicks', 'ad_orders', 'order_count', 
                                  'refund_count', 'return_count', 'rating_count', 'fba_inventory', 'total_inventory',
                                  'sessions', 'page_views']:
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
    
    def get_unique_key(self) -> tuple:
        """获取唯一键用于去重"""
        return (self.product_id, self.data_date)
    
    def __str__(self) -> str:
        return f"ProductAnalytics(product_id={self.product_id}, date={self.data_date}, sales={self.sales_amount})"