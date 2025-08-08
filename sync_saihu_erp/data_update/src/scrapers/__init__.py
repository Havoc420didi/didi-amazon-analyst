# scrapers模块初始化
from .base_scraper import BaseScraper
from .product_analytics_scraper import ProductAnalyticsScraper
from .fba_inventory_scraper import FbaInventoryScraper
from .inventory_details_scraper import InventoryDetailsScraper

__all__ = [
    'BaseScraper',
    'ProductAnalyticsScraper',
    'FbaInventoryScraper', 
    'InventoryDetailsScraper'
]