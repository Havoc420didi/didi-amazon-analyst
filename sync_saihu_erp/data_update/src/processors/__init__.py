# processors模块初始化
from .base_processor import BaseProcessor
from .product_analytics_processor import ProductAnalyticsProcessor
from .inventory_merge_processor import InventoryMergeProcessor

__all__ = [
    'BaseProcessor',
    'ProductAnalyticsProcessor',
    'InventoryMergeProcessor'
]