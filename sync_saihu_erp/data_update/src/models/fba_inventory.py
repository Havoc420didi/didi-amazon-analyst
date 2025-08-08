"""
FBA库存数据模型
"""
from datetime import datetime, date
from typing import Optional, Dict, Any
from .base import BaseModel

class FbaInventory(BaseModel):
    """FBA库存数据模型"""
    
    def __init__(self,
                 id: Optional[int] = None,
                 sku: str = None,
                 fn_sku: Optional[str] = None,
                 asin: Optional[str] = None,
                 marketplace_id: str = None,
                 marketplace_name: Optional[str] = None,
                 shop_id: Optional[str] = None,
                 available_quantity: Optional[int] = None,
                 reserved_quantity: Optional[int] = None,
                 inbound_quantity: Optional[int] = None,
                 inbound_shipped_quantity: Optional[int] = None,
                 inbound_receiving_quantity: Optional[int] = None,
                 researching_quantity: Optional[int] = None,
                 defective_quantity: Optional[int] = None,
                 unfulfillable_quantity: Optional[int] = None,
                 total_quantity: Optional[int] = None,
                 commodity_id: Optional[str] = None,
                 commodity_name: Optional[str] = None,
                 commodity_sku: Optional[str] = None,
                 snapshot_date: date = None,
                 created_at: Optional[datetime] = None,
                 updated_at: Optional[datetime] = None):
        """初始化FBA库存数据"""
        self.id = id
        self.sku = sku
        self.fn_sku = fn_sku
        self.asin = asin
        self.marketplace_id = marketplace_id
        self.marketplace_name = marketplace_name
        self.shop_id = shop_id
        self.available_quantity = available_quantity or 0
        self.reserved_quantity = reserved_quantity or 0
        self.inbound_quantity = inbound_quantity or 0
        self.inbound_shipped_quantity = inbound_shipped_quantity or 0
        self.inbound_receiving_quantity = inbound_receiving_quantity or 0
        self.researching_quantity = researching_quantity or 0
        self.defective_quantity = defective_quantity or 0
        self.unfulfillable_quantity = unfulfillable_quantity or 0
        self.total_quantity = total_quantity or 0
        self.commodity_id = commodity_id
        self.commodity_name = commodity_name
        self.commodity_sku = commodity_sku
        self.snapshot_date = snapshot_date
        self.created_at = created_at
        self.updated_at = updated_at
    
    def calculate_total_quantity(self) -> int:
        """计算总库存数量"""
        total = (self.available_quantity + self.reserved_quantity + 
                self.inbound_quantity + self.researching_quantity + 
                self.defective_quantity + self.unfulfillable_quantity)
        self.total_quantity = total
        return total
    
    def get_available_rate(self) -> float:
        """获取可用库存占比"""
        if self.total_quantity and self.total_quantity > 0:
            return self.available_quantity / self.total_quantity
        return 0.0
    
    def is_low_stock(self, threshold: int = 10) -> bool:
        """检查是否为低库存"""
        return self.available_quantity < threshold
    
    def is_out_of_stock(self) -> bool:
        """检查是否缺货"""
        return self.available_quantity <= 0
    
    def is_valid(self) -> bool:
        """验证数据有效性"""
        if not self.sku or not self.marketplace_id or not self.snapshot_date:
            return False
        
        # 检查数量是否为负数
        quantities = [
            self.available_quantity, self.reserved_quantity,
            self.inbound_quantity, self.researching_quantity,
            self.unfulfillable_quantity, self.total_quantity
        ]
        
        for qty in quantities:
            if qty is not None and qty < 0:
                return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = super().to_dict()
        
        # 处理日期类型
        if isinstance(self.snapshot_date, date):
            data['snapshot_date'] = self.snapshot_date.isoformat()
        
        return data
    
    @classmethod
    def from_api_response(cls, api_data: Dict[str, Any], snapshot_date: date = None) -> 'FbaInventory':
        """从API响应数据创建实例"""
        # 字段映射 - 根据实际API响应字段名
        field_mapping = {
            'commoditySku': 'commodity_sku',
            'sku': 'sku',
            'fnSku': 'fn_sku',
            'asin': 'asin', 
            'marketplaceId': 'marketplace_id',
            'warehouseName': 'marketplace_name',
            'shopId': 'shop_id',
            'shopIdList': 'shop_id',  # 支持shopIdList参数
            'available': 'available_quantity',
            'reservedCustomerorders': 'reserved_quantity',
            'inboundWorking': 'inbound_quantity',
            'inboundShipped': 'inbound_shipped_quantity',
            'inboundReceiving': 'inbound_receiving_quantity',
            'research': 'researching_quantity',
            'unfulfillable': 'unfulfillable_quantity',
            'totalInventory': 'total_quantity',
            'commodityId': 'commodity_id',
            'commodityName': 'commodity_name',
            # 支持新的API字段格式
            'skus': 'sku',
            'asins': 'asin',
            'commodityIds': 'commodity_id',
            'productIds': 'product_id'
        }
        
        mapped_data = {}
        
        for api_key, api_value in api_data.items():
            if api_key in field_mapping:
                mapped_key = field_mapping[api_key]
                
                # 类型转换
                if mapped_key.endswith('_quantity'):
                    # API返回的可能是字符串，需要转换为整数
                    try:
                        mapped_data[mapped_key] = int(api_value) if api_value is not None and api_value != '' else 0
                    except (ValueError, TypeError):
                        mapped_data[mapped_key] = 0
                else:
                    mapped_data[mapped_key] = api_value
        
        # 设置快照日期
        if snapshot_date:
            mapped_data['snapshot_date'] = snapshot_date
        elif 'snapshotDate' in api_data:
            from datetime import datetime
            date_str = api_data['snapshotDate']
            mapped_data['snapshot_date'] = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        instance = cls(**mapped_data)
        
        # 如果API没有返回总数量，则自动计算
        if not instance.total_quantity:
            instance.calculate_total_quantity()
        
        return instance
    
    def get_unique_key(self) -> tuple:
        """获取唯一键用于去重"""
        return (self.sku, self.marketplace_id, self.snapshot_date)
    
    def get_stock_status(self) -> str:
        """获取库存状态"""
        if self.is_out_of_stock():
            return 'out_of_stock'
        elif self.is_low_stock():
            return 'low_stock'
        else:
            return 'normal'
    
    def __str__(self) -> str:
        return f"FbaInventory(sku={self.sku}, marketplace={self.marketplace_id}, available={self.available_quantity})"