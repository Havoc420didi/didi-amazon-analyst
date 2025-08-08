"""
库存明细数据模型
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any
from .base import BaseModel

class InventoryDetails(BaseModel):
    """库存明细数据模型"""
    
    def __init__(self,
                 id: Optional[int] = None,
                 item_id: str = None,
                 item_name: Optional[str] = None,
                 sku: str = None,
                 fn_sku: Optional[str] = None,
                 warehouse_code: str = None,
                 warehouse_name: Optional[str] = None,
                 quantity: Optional[int] = None,
                 available_quantity: Optional[int] = None,
                 reserved_quantity: Optional[int] = None,
                 stock_defective: Optional[int] = None,
                 stock_wait: Optional[int] = None,
                 stock_plan: Optional[int] = None,
                 status: Optional[str] = None,
                 cost_price: Optional[Decimal] = None,
                 total_purchase: Optional[Decimal] = None,
                 batch_number: Optional[str] = None,
                 expiry_date: Optional[date] = None,
                 location: Optional[str] = None,
                 snapshot_date: date = None,
                 created_at: Optional[datetime] = None,
                 updated_at: Optional[datetime] = None):
        """初始化库存明细数据"""
        self.id = id
        self.item_id = item_id
        self.item_name = item_name
        self.sku = sku
        self.fn_sku = fn_sku
        self.warehouse_code = warehouse_code
        self.warehouse_name = warehouse_name
        self.quantity = quantity or 0
        self.available_quantity = available_quantity or 0
        self.reserved_quantity = reserved_quantity or 0
        self.stock_defective = stock_defective or 0
        self.stock_wait = stock_wait or 0
        self.stock_plan = stock_plan or 0
        self.status = status or 'active'
        self.cost_price = cost_price or Decimal('0.00')
        self.total_purchase = total_purchase or Decimal('0.00')
        self.batch_number = batch_number
        self.expiry_date = expiry_date
        self.location = location
        self.snapshot_date = snapshot_date
        self.created_at = created_at
        self.updated_at = updated_at
    
    def calculate_total_value(self) -> Decimal:
        """计算库存总价值"""
        if self.quantity and self.cost_price:
            return Decimal(str(self.quantity)) * self.cost_price
        return Decimal('0.00')
    
    def is_expired(self, check_date: date = None) -> bool:
        """检查是否过期"""
        if not self.expiry_date:
            return False
        
        check_date = check_date or date.today()
        return self.expiry_date <= check_date
    
    def days_to_expiry(self, check_date: date = None) -> Optional[int]:
        """计算距离过期的天数"""
        if not self.expiry_date:
            return None
        
        check_date = check_date or date.today()
        delta = self.expiry_date - check_date
        return delta.days
    
    def is_low_stock(self, threshold: int = 10) -> bool:
        """检查是否为低库存"""
        return self.available_quantity < threshold
    
    def is_active(self) -> bool:
        """检查是否为活跃状态"""
        return self.status == 'active'
    
    def is_valid(self) -> bool:
        """验证数据有效性"""
        if not self.item_id or not self.sku or not self.warehouse_code or not self.snapshot_date:
            return False
        
        # 检查数量是否为负数
        quantities = [self.quantity, self.available_quantity, self.reserved_quantity, 
                     self.stock_defective, self.stock_wait, self.stock_plan]
        for qty in quantities:
            if qty is not None and qty < 0:
                return False
        
        # 检查价格是否为负数
        if self.cost_price is not None and self.cost_price < 0:
            return False
        
        # 检查状态是否有效
        valid_statuses = ['active', 'inactive', 'blocked', 'damaged']
        if self.status and self.status not in valid_statuses:
            return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = super().to_dict()
        
        # 处理日期类型
        if isinstance(self.snapshot_date, date):
            data['snapshot_date'] = self.snapshot_date.isoformat()
        
        if isinstance(self.expiry_date, date):
            data['expiry_date'] = self.expiry_date.isoformat()
        
        # 处理Decimal类型
        if isinstance(self.cost_price, Decimal):
            data['cost_price'] = float(self.cost_price)
        
        return data
    
    @classmethod
    def from_api_response(cls, api_data: Dict[str, Any], snapshot_date: date = None) -> 'InventoryDetails':
        """从API响应数据创建实例"""
        # 字段映射 - 根据实际API响应字段名
        field_mapping = {
            'commodityId': 'item_id',
            'commodityName': 'item_name',
            'commoditySku': 'sku',
            'fnSku': 'fn_sku',
            'warehouseId': 'warehouse_code',
            'warehouseName': 'warehouse_name',
            'stockAllNum': 'quantity',
            'stockAvailable': 'available_quantity',
            'stockOccupy': 'reserved_quantity',
            'stockDefective': 'stock_defective',
            'stockWait': 'stock_wait',
            'stockPlan': 'stock_plan',
            'perPurchase': 'cost_price',
            'totalPurchase': 'total_purchase'
        }
        
        mapped_data = {}
        
        for api_key, api_value in api_data.items():
            if api_key in field_mapping:
                mapped_key = field_mapping[api_key]
                
                # 类型转换
                if mapped_key in ['quantity', 'available_quantity', 'reserved_quantity', 
                                'stock_defective', 'stock_wait', 'stock_plan']:
                    # API返回的可能是字符串，需要转换为整数
                    try:
                        mapped_data[mapped_key] = int(api_value) if api_value is not None and api_value != '' else 0
                    except (ValueError, TypeError):
                        mapped_data[mapped_key] = 0
                elif mapped_key in ['cost_price', 'total_purchase']:
                    # 处理价格字段
                    try:
                        mapped_data[mapped_key] = Decimal(str(api_value)) if api_value is not None and api_value != '' else Decimal('0.00')
                    except (ValueError, TypeError):
                        mapped_data[mapped_key] = Decimal('0.00')
                elif mapped_key == 'expiry_date' and isinstance(api_value, str):
                    from datetime import datetime
                    try:
                        mapped_data[mapped_key] = datetime.strptime(api_value, '%Y-%m-%d').date()
                    except ValueError:
                        mapped_data[mapped_key] = None
                else:
                    mapped_data[mapped_key] = api_value
        
        # 设置快照日期
        if snapshot_date:
            mapped_data['snapshot_date'] = snapshot_date
        elif 'snapshotDate' in api_data:
            from datetime import datetime
            date_str = api_data['snapshotDate']
            mapped_data['snapshot_date'] = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        return cls(**mapped_data)
    
    def get_unique_key(self) -> tuple:
        """获取唯一键用于去重"""
        return (self.item_id, self.warehouse_code, self.snapshot_date)
    
    def get_stock_level(self) -> str:
        """获取库存水平"""
        if self.available_quantity <= 0:
            return 'empty'
        elif self.is_low_stock():
            return 'low'
        elif self.available_quantity >= 100:
            return 'high'
        else:
            return 'normal'
    
    def get_expiry_status(self) -> str:
        """获取过期状态"""
        if not self.expiry_date:
            return 'no_expiry'
        
        days = self.days_to_expiry()
        if days is None:
            return 'no_expiry'
        elif days < 0:
            return 'expired'
        elif days <= 30:
            return 'expiring_soon'
        else:
            return 'normal'
    
    def __str__(self) -> str:
        return f"InventoryDetails(item_id={self.item_id}, warehouse={self.warehouse_code}, quantity={self.quantity})"