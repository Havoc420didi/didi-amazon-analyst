"""
广告数据合并器

实现广告数据的合并和计算逻辑：
- 广告曝光量、广告点击量、广告花费、广告订单量进行加总
- 计算广告点击率、广告转化率、ACOAS等指标
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class AdMerger:
    """广告数据合并器"""
    
    def __init__(self):
        """初始化广告合并器"""
        self.logger = logger
    
    def merge_ad_data(self, inventory_point: Dict[str, Any]) -> Dict[str, Any]:
        """
        合并和计算广告数据
        
        Args:
            inventory_point: 库存点数据
            
        Returns:
            包含计算后广告指标的库存点数据
        """
        if not inventory_point:
            self.logger.warning("库存点数据为空")
            return inventory_point
        
        if not isinstance(inventory_point, dict):
            self.logger.warning("库存点数据格式无效")
            return inventory_point
        
        try:
            # 获取基础广告数据
            ad_impressions = inventory_point.get('ad_impressions', 0) or 0
            ad_clicks = inventory_point.get('ad_clicks', 0) or 0
            ad_spend = inventory_point.get('ad_spend', 0) or 0
            ad_order_count = inventory_point.get('ad_order_count', 0) or 0
            ad_sales = inventory_point.get('ad_sales', 0) or 0
            
            # 计算广告指标
            ad_metrics = self._calculate_ad_metrics(
                ad_impressions, ad_clicks, ad_spend, ad_order_count, ad_sales, inventory_point
            )
            
            # 更新库存点数据
            inventory_point.update(ad_metrics)
            
            self.logger.debug(f"广告数据合并完成: {inventory_point.get('asin', 'Unknown')}")
            
            return inventory_point
            
        except Exception as e:
            self.logger.error(f"广告数据合并失败: {e}")
            # 出错时返回原始数据，添加默认的广告指标
            inventory_point.update({
                'ad_ctr': 0.0,
                'ad_cvr': 0.0, 
                'acoas': 0.0,
                'ad_cpc': 0.0,
                'ad_roas': 0.0
            })
            return inventory_point
    
    def _calculate_ad_metrics(self, ad_impressions: float, ad_clicks: float, ad_spend: float, 
                            ad_order_count: float, ad_sales: float, inventory_point: Dict[str, Any]) -> Dict[str, Any]:
        """
        计算广告指标
        
        Args:
            ad_impressions: 广告曝光量
            ad_clicks: 广告点击量
            ad_spend: 广告花费
            ad_order_count: 广告订单量
            ad_sales: 广告销售额
            inventory_point: 库存点数据（用于获取其他计算所需数据）
            
        Returns:
            计算后的广告指标字典
        """
        metrics = {}
        
        # 1. 广告点击率 (CTR) = 广告点击量 / 广告曝光量
        metrics['ad_ctr'] = self._safe_divide(ad_clicks, ad_impressions, precision=4)
        
        # 2. 广告转化率 (CVR) = 广告订单量 / 广告点击量
        metrics['ad_cvr'] = self._safe_divide(ad_order_count, ad_clicks, precision=4)
        
        # 3. 计算ACOAS = 广告花费 / (日均销售额 * 7)
        daily_sales_amount = self._calculate_daily_sales_amount(inventory_point)
        weekly_sales_amount = daily_sales_amount * 7
        metrics['acoas'] = self._safe_divide(ad_spend, weekly_sales_amount, precision=4)
        
        # 4. 计算广告平均点击成本 (CPC) = 广告花费 / 广告点击量
        metrics['ad_cpc'] = self._safe_divide(ad_spend, ad_clicks, precision=2)
        
        # 5. 计算广告投资回报率 (ROAS) = 广告销售额 / 广告花费
        metrics['ad_roas'] = self._safe_divide(ad_sales, ad_spend, precision=2)
        
        # 6. 计算广告销售转化率 = 广告销售额 / 广告点击量
        metrics['ad_sales_per_click'] = self._safe_divide(ad_sales, ad_clicks, precision=2)
        
        # 7. 广告成本占销售额比例 = 广告花费 / 广告销售额
        metrics['ad_cost_ratio'] = self._safe_divide(ad_spend, ad_sales, precision=4)
        
        self.logger.debug(f"广告指标计算完成: CTR={metrics['ad_ctr']}, CVR={metrics['ad_cvr']}, ACOAS={metrics['acoas']}")
        
        return metrics
    
    def _calculate_daily_sales_amount(self, inventory_point: Dict[str, Any]) -> float:
        """
        计算日均销售额
        
        根据设计文档的要求：日均销售额 = 平均销量 * 平均售价
        """
        try:
            # 获取平均销量
            average_sales = inventory_point.get('average_sales', 0) or 0
            
            # 获取平均售价，需要从字符串中提取数值
            average_price_str = inventory_point.get('average_price', '') or ''
            average_price = self._extract_price_from_string(average_price_str)
            
            # 计算日均销售额
            daily_sales_amount = average_sales * average_price
            
            self.logger.debug(f"日均销售额计算: {average_sales} * {average_price} = {daily_sales_amount}")
            
            return daily_sales_amount
            
        except Exception as e:
            self.logger.warning(f"日均销售额计算失败: {e}")
            return 0.0
    
    def _extract_price_from_string(self, price_str: str) -> float:
        """
        从价格字符串中提取数值
        
        例如: "US$25.99" -> 25.99
        """
        if not price_str:
            return 0.0
        
        try:
            import re
            # 使用正则表达式提取数字（包括小数点）
            price_match = re.search(r'[\d.]+', str(price_str))
            if price_match:
                return float(price_match.group())
            
            return 0.0
            
        except Exception as e:
            self.logger.warning(f"价格提取失败: {price_str}, 错误: {e}")
            return 0.0
    
    def _safe_divide(self, numerator: float, denominator: float, precision: int = 2) -> float:
        """
        安全除法，避免除零错误
        
        Args:
            numerator: 分子
            denominator: 分母
            precision: 小数位数
            
        Returns:
            计算结果，除零时返回0.0
        """
        try:
            if denominator == 0 or denominator is None:
                return 0.0
            
            result = numerator / denominator
            return round(result, precision)
            
        except Exception as e:
            self.logger.warning(f"除法计算失败: {numerator}/{denominator}, 错误: {e}")
            return 0.0
    
    def get_ad_summary(self, inventory_points: list) -> Dict[str, Any]:
        """
        获取广告数据汇总统计
        
        Args:
            inventory_points: 库存点列表
            
        Returns:
            广告数据汇总统计
        """
        if not inventory_points:
            return {}
        
        try:
            total_impressions = sum(point.get('ad_impressions', 0) or 0 for point in inventory_points)
            total_clicks = sum(point.get('ad_clicks', 0) or 0 for point in inventory_points)
            total_spend = sum(point.get('ad_spend', 0) or 0 for point in inventory_points)
            total_orders = sum(point.get('ad_order_count', 0) or 0 for point in inventory_points)
            total_sales = sum(point.get('ad_sales', 0) or 0 for point in inventory_points)
            
            # 计算整体指标
            overall_ctr = self._safe_divide(total_clicks, total_impressions, 4)
            overall_cvr = self._safe_divide(total_orders, total_clicks, 4)
            overall_roas = self._safe_divide(total_sales, total_spend, 2)
            overall_cpc = self._safe_divide(total_spend, total_clicks, 2)
            
            # 统计有广告数据的库存点数量
            points_with_ads = sum(1 for point in inventory_points 
                                if (point.get('ad_impressions', 0) or 0) > 0)
            
            return {
                'total_inventory_points': len(inventory_points),
                'points_with_ads': points_with_ads,
                'ad_coverage_rate': self._safe_divide(points_with_ads, len(inventory_points), 4),
                'total_ad_impressions': total_impressions,
                'total_ad_clicks': total_clicks,
                'total_ad_spend': total_spend,
                'total_ad_orders': total_orders,
                'total_ad_sales': total_sales,
                'overall_ctr': overall_ctr,
                'overall_cvr': overall_cvr,
                'overall_roas': overall_roas,
                'overall_cpc': overall_cpc
            }
            
        except Exception as e:
            self.logger.error(f"广告数据汇总失败: {e}")
            return {}
    
    def validate_ad_data(self, inventory_point: Dict[str, Any]) -> Dict[str, str]:
        """
        验证广告数据的合理性
        
        Args:
            inventory_point: 库存点数据
            
        Returns:
            验证结果字典，key为字段名，value为警告信息
        """
        warnings = {}
        
        try:
            ad_impressions = inventory_point.get('ad_impressions', 0) or 0
            ad_clicks = inventory_point.get('ad_clicks', 0) or 0
            ad_spend = inventory_point.get('ad_spend', 0) or 0
            ad_ctr = inventory_point.get('ad_ctr', 0) or 0
            ad_cpc = inventory_point.get('ad_cpc', 0) or 0
            
            # 验证CTR是否合理（通常在0-20%之间）
            if ad_ctr > 0.2:
                warnings['ad_ctr'] = f"广告点击率异常高: {ad_ctr*100:.2f}%"
            
            # 验证CPC是否合理（通常不会超过100美元）
            if ad_cpc > 100:
                warnings['ad_cpc'] = f"广告点击成本异常高: ${ad_cpc:.2f}"
            
            # 验证数据一致性
            if ad_impressions > 0 and ad_clicks == 0:
                warnings['consistency'] = "有曝光但无点击，数据可能不一致"
                
            if ad_clicks > 0 and ad_spend == 0:
                warnings['consistency'] = "有点击但无花费，数据可能不一致"
            
            return warnings
            
        except Exception as e:
            self.logger.error(f"广告数据验证失败: {e}")
            return {'validation_error': str(e)}