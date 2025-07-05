"""
Pipiads数据处理和分析RPA模块
自动化执行SOP中的数据分析、筛选、分级工作
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
import logging
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

from config import *

class DataProcessor:
    """数据处理和分析器"""
    
    def __init__(self):
        self.logger = self._setup_logger()
        self.raw_data = None
        self.processed_data = None
        self.analysis_results = {}
        self.alerts = []
        self.human_review_queue = []
        
    def _setup_logger(self) -> logging.Logger:
        """设置日志记录器"""
        logger = logging.getLogger('DataProcessor')
        logger.setLevel(logging.INFO)
        
        # 文件处理器
        log_file = get_output_path(PATHS['activity_log'])
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.INFO)
        
        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # 格式器
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        return logger
    
    def load_data(self, data_source: str) -> bool:
        """加载数据"""
        try:
            self.logger.info(f"加载数据: {data_source}")
            
            if data_source.endswith('.csv'):
                self.raw_data = pd.read_csv(data_source)
            elif data_source.endswith('.xlsx'):
                self.raw_data = pd.read_excel(data_source)
            else:
                # 直接传入DataFrame
                self.raw_data = data_source
            
            self.logger.info(f"数据加载完成，共 {len(self.raw_data)} 条记录")
            return True
            
        except Exception as e:
            self.logger.error(f"数据加载失败: {e}")
            return False
    
    def clean_data(self) -> pd.DataFrame:
        """数据清洗和验证"""
        try:
            self.logger.info("开始数据清洗...")
            
            df = self.raw_data.copy()
            original_count = len(df)
            
            # 1. 移除重复数据
            df = df.drop_duplicates(subset=['product_name', 'advertiser'], keep='last')
            self.logger.info(f"移除重复数据: {original_count - len(df)} 条")
            
            # 2. 数据类型转换和清理
            df = self._standardize_data_types(df)
            
            # 3. 数据验证
            df = self._validate_data_ranges(df)
            
            # 4. 处理缺失值
            df = self._handle_missing_values(df)
            
            # 5. 异常值检测和处理
            df = self._detect_and_handle_outliers(df)
            
            self.logger.info(f"数据清洗完成，剩余 {len(df)} 条有效记录")
            return df
            
        except Exception as e:
            self.logger.error(f"数据清洗失败: {e}")
            return self.raw_data
    
    def _standardize_data_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """标准化数据类型"""
        try:
            # 数值字段
            numeric_fields = ['impressions', 'likes', 'comments', 'shares', 'price', 
                            'like_rate', 'engagement_rate', 'running_days']
            
            for field in numeric_fields:
                if field in df.columns:
                    df[field] = pd.to_numeric(df[field], errors='coerce').fillna(0)
            
            # 文本字段
            text_fields = ['product_name', 'advertiser', 'search_keyword']
            for field in text_fields:
                if field in df.columns:
                    df[field] = df[field].astype(str).str.strip()
            
            # 日期字段
            date_fields = ['collection_time', 'first_seen_date']
            for field in date_fields:
                if field in df.columns:
                    df[field] = pd.to_datetime(df[field], errors='coerce')
            
            return df
            
        except Exception as e:
            self.logger.error(f"数据类型标准化失败: {e}")
            return df
    
    def _validate_data_ranges(self, df: pd.DataFrame) -> pd.DataFrame:
        """验证数据范围"""
        try:
            # 价格范围验证
            price_range = VALIDATION_RULES['price_range']
            mask = (df['price'] >= price_range['min']) & (df['price'] <= price_range['max'])
            invalid_count = len(df) - mask.sum()
            if invalid_count > 0:
                self.logger.warning(f"发现 {invalid_count} 条价格异常数据")
                df = df[mask]
            
            # 点赞率范围验证
            like_rate_range = VALIDATION_RULES['like_rate_range']
            mask = (df['like_rate'] >= like_rate_range['min']) & (df['like_rate'] <= like_rate_range['max'])
            invalid_count = len(df) - mask.sum()
            if invalid_count > 0:
                self.logger.warning(f"发现 {invalid_count} 条点赞率异常数据")
                df = df[mask]
            
            # 展示量范围验证
            impressions_range = VALIDATION_RULES['impressions_range']
            mask = (df['impressions'] >= impressions_range['min']) & (df['impressions'] <= impressions_range['max'])
            invalid_count = len(df) - mask.sum()
            if invalid_count > 0:
                self.logger.warning(f"发现 {invalid_count} 条展示量异常数据")
                df = df[mask]
            
            return df
            
        except Exception as e:
            self.logger.error(f"数据范围验证失败: {e}")
            return df
    
    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """处理缺失值"""
        try:
            # 对于关键数值字段，用0填充
            key_numeric_fields = ['impressions', 'likes', 'comments', 'price']
            for field in key_numeric_fields:
                if field in df.columns:
                    df[field] = df[field].fillna(0)
            
            # 对于文本字段，用空字符串填充
            text_fields = ['product_name', 'advertiser']
            for field in text_fields:
                if field in df.columns:
                    df[field] = df[field].fillna('')
            
            # 移除产品名称为空的记录
            df = df[df['product_name'] != '']
            
            return df
            
        except Exception as e:
            self.logger.error(f"缺失值处理失败: {e}")
            return df
    
    def _detect_and_handle_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """检测和处理异常值"""
        try:
            if not ANOMALY_DETECTION['enable_outlier_removal']:
                return df
            
            # 使用IQR方法检测异常值
            numeric_fields = ['impressions', 'likes', 'like_rate', 'price']
            
            for field in numeric_fields:
                if field in df.columns:
                    Q1 = df[field].quantile(0.25)
                    Q3 = df[field].quantile(0.75)
                    IQR = Q3 - Q1
                    
                    lower_bound = Q1 - ANOMALY_DETECTION['iqr_multiplier'] * IQR
                    upper_bound = Q3 + ANOMALY_DETECTION['iqr_multiplier'] * IQR
                    
                    outliers = df[(df[field] < lower_bound) | (df[field] > upper_bound)]
                    
                    if len(outliers) > 0:
                        self.logger.info(f"{field}字段发现 {len(outliers)} 个异常值")
                        
                        # 将异常值添加到人工审核队列
                        for _, row in outliers.iterrows():
                            self._add_to_human_review(
                                row.to_dict(), 
                                f"{field}字段异常值", 
                                'medium'
                            )
                        
                        # 移除异常值
                        df = df[(df[field] >= lower_bound) & (df[field] <= upper_bound)]
            
            return df
            
        except Exception as e:
            self.logger.error(f"异常值检测失败: {e}")
            return df
    
    def calculate_metrics(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算关键指标"""
        try:
            self.logger.info("计算关键指标...")
            
            # 重新计算参与率（确保准确性）
            shares_col = df['shares'] if 'shares' in df.columns else 0
            df['engagement_rate'] = np.where(
                df['impressions'] > 0,
                ((df['likes'] + df['comments'] + shares_col) / df['impressions']) * 100,
                0
            )
            
            # 重新计算点赞率
            df['like_rate'] = np.where(
                df['impressions'] > 0,
                (df['likes'] / df['impressions']) * 100,
                0
            )
            
            # 计算评论率
            df['comment_rate'] = np.where(
                df['impressions'] > 0,
                (df['comments'] / df['impressions']) * 100,
                0
            )
            
            # 计算病毒传播指数
            df['viral_index'] = (
                df['like_rate'] * 0.4 + 
                df['comment_rate'] * 0.3 + 
                df['engagement_rate'] * 0.3
            )
            
            # 计算每日平均指标
            df['daily_likes'] = np.where(
                df['running_days'] > 0,
                df['likes'] / df['running_days'],
                df['likes']
            )
            
            df['daily_impressions'] = np.where(
                df['running_days'] > 0,
                df['impressions'] / df['running_days'],
                df['impressions']
            )
            
            # 计算价格竞争力指数（基于同类产品价格分布）
            df['price_competitiveness'] = self._calculate_price_competitiveness(df)
            
            # 计算产品成熟度评分
            df['maturity_score'] = self._calculate_maturity_score(df)
            
            return df
            
        except Exception as e:
            self.logger.error(f"关键指标计算失败: {e}")
            return df
    
    def _calculate_price_competitiveness(self, df: pd.DataFrame) -> pd.Series:
        """计算价格竞争力指数"""
        try:
            # 计算每个产品在其价格区间的位置
            price_percentile = df['price'].rank(pct=True) * 100
            
            # 价格竞争力指数：越低价格，竞争力越高
            competitiveness = 100 - price_percentile
            
            return competitiveness
            
        except Exception as e:
            self.logger.error(f"价格竞争力计算失败: {e}")
            return pd.Series([50] * len(df))  # 默认中等竞争力
    
    def _calculate_maturity_score(self, df: pd.DataFrame) -> pd.Series:
        """计算产品成熟度评分"""
        try:
            # 基于运行天数、展示量增长趋势等因素
            running_days_score = np.clip(df['running_days'] / 30 * 100, 0, 100)
            impressions_score = np.clip(np.log10(df['impressions'] + 1) / 6 * 100, 0, 100)
            
            # 综合评分
            maturity_score = (running_days_score * 0.6 + impressions_score * 0.4)
            
            return maturity_score
            
        except Exception as e:
            self.logger.error(f"成熟度评分计算失败: {e}")
            return pd.Series([50] * len(df))
    
    def apply_filters(self, df: pd.DataFrame) -> pd.DataFrame:
        """应用SOP筛选标准"""
        try:
            self.logger.info("应用SOP筛选标准...")
            
            original_count = len(df)
            
            # 应用硬性标准
            mask = (
                (df['impressions'] >= HARD_CRITERIA['min_impressions']) &
                (df['likes'] >= HARD_CRITERIA['min_likes']) &
                (df['like_rate'] >= HARD_CRITERIA['min_like_rate']) &
                (df['running_days'] >= HARD_CRITERIA['min_running_days']) &
                (df['comments'] >= HARD_CRITERIA['min_comments'])
            )
            
            df_filtered = df[mask].copy()
            
            # 应用排除标准
            df_filtered = self._apply_exclusion_criteria(df_filtered)
            
            filtered_count = len(df_filtered)
            self.logger.info(f"筛选完成: {original_count} -> {filtered_count} 条记录")
            
            return df_filtered
            
        except Exception as e:
            self.logger.error(f"筛选标准应用失败: {e}")
            return df
    
    def _apply_exclusion_criteria(self, df: pd.DataFrame) -> pd.DataFrame:
        """应用排除标准"""
        try:
            # 医疗宣称关键词排除
            medical_keywords = EXCLUSION_CRITERIA['medical_claims_keywords']
            for keyword in medical_keywords:
                mask = ~df['product_name'].str.contains(keyword, case=False, na=False)
                excluded_count = len(df) - mask.sum()
                if excluded_count > 0:
                    self.logger.info(f"排除含有 '{keyword}' 的产品: {excluded_count} 个")
                df = df[mask]
            
            # 版权关键词排除
            copyright_keywords = EXCLUSION_CRITERIA['copyright_keywords']
            for keyword in copyright_keywords:
                mask = ~df['product_name'].str.contains(keyword, case=False, na=False)
                excluded_count = len(df) - mask.sum()
                if excluded_count > 0:
                    self.logger.info(f"排除含有 '{keyword}' 的产品: {excluded_count} 个")
                df = df[mask]
            
            return df
            
        except Exception as e:
            self.logger.error(f"排除标准应用失败: {e}")
            return df
    
    def rank_products(self, df: pd.DataFrame) -> pd.DataFrame:
        """产品排名和分级"""
        try:
            self.logger.info("进行产品排名和分级...")
            
            # 计算综合评分
            df['overall_score'] = self._calculate_overall_score(df)
            
            # 根据评分排序
            df = df.sort_values('overall_score', ascending=False)
            
            # 分配等级
            df['recommendation_level'] = self._assign_recommendation_levels(df)
            
            # 计算排名
            df['rank'] = range(1, len(df) + 1)
            
            # 标记高潜力产品
            df['high_potential'] = (
                (df['like_rate'] >= ALERT_THRESHOLDS['high_potential_like_rate']) &
                (df['impressions'] >= ALERT_THRESHOLDS['high_potential_impressions'])
            )
            
            return df
            
        except Exception as e:
            self.logger.error(f"产品排名分级失败: {e}")
            return df
    
    def _calculate_overall_score(self, df: pd.DataFrame) -> pd.Series:
        """计算产品综合评分"""
        try:
            # 各指标权重
            weights = {
                'like_rate': 0.25,
                'engagement_rate': 0.20,
                'viral_index': 0.15,
                'impressions': 0.15,
                'maturity_score': 0.10,
                'price_competitiveness': 0.10,
                'running_days': 0.05
            }
            
            # 标准化各指标到0-100范围
            normalized_scores = {}
            
            for metric, weight in weights.items():
                if metric in df.columns:
                    # 使用分位数标准化，避免极值影响
                    min_val = df[metric].quantile(0.05)
                    max_val = df[metric].quantile(0.95)
                    
                    normalized = np.clip(
                        (df[metric] - min_val) / (max_val - min_val) * 100,
                        0, 100
                    )
                    normalized_scores[metric] = normalized * weight
                else:
                    normalized_scores[metric] = pd.Series([0] * len(df))
            
            # 计算加权总分
            overall_score = sum(normalized_scores.values())
            
            return overall_score
            
        except Exception as e:
            self.logger.error(f"综合评分计算失败: {e}")
            return pd.Series([50] * len(df))
    
    def _assign_recommendation_levels(self, df: pd.DataFrame) -> pd.Series:
        """分配推荐等级"""
        try:
            levels = []
            
            for _, row in df.iterrows():
                score = row['overall_score']
                like_rate = row['like_rate']
                impressions = row['impressions']
                running_days = row['running_days']
                
                # A级：优先开发
                if (score >= 80 and 
                    like_rate >= IDEAL_CRITERIA['ideal_like_rate'] and 
                    impressions >= IDEAL_CRITERIA['ideal_impressions'] and
                    running_days >= IDEAL_CRITERIA['ideal_running_days']):
                    levels.append('A')
                    
                    # 添加到人工审核队列
                    self._add_to_human_review(
                        row.to_dict(), 
                        'A级高潜力产品，建议优先开发', 
                        'high'
                    )
                
                # B级：推荐开发
                elif (score >= 60 and 
                      like_rate >= HARD_CRITERIA['min_like_rate'] and 
                      impressions >= HARD_CRITERIA['min_impressions']):
                    levels.append('B')
                
                # C级：谨慎考虑
                elif score >= 40:
                    levels.append('C')
                
                # D级：不推荐
                else:
                    levels.append('D')
            
            return pd.Series(levels)
            
        except Exception as e:
            self.logger.error(f"推荐等级分配失败: {e}")
            return pd.Series(['C'] * len(df))
    
    def detect_alerts(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """检测预警信号"""
        try:
            self.logger.info("检测预警信号...")
            
            alerts = []
            
            # 高潜力产品预警
            high_potential = df[
                (df['like_rate'] >= ALERT_THRESHOLDS['high_potential_like_rate']) &
                (df['impressions'] >= ALERT_THRESHOLDS['high_potential_impressions'])
            ]
            
            if len(high_potential) > 0:
                alerts.append({
                    'type': 'high_potential',
                    'level': 'info',
                    'message': f'发现 {len(high_potential)} 个高潜力产品',
                    'products': high_potential['product_name'].tolist()[:5],
                    'timestamp': datetime.now().isoformat()
                })
            
            # 数据质量预警
            data_quality = len(df) / len(self.raw_data) if len(self.raw_data) > 0 else 0
            if data_quality < ALERT_THRESHOLDS['data_quality_threshold']:
                alerts.append({
                    'type': 'data_quality',
                    'level': 'warning',
                    'message': f'数据质量较低: {data_quality:.1%}',
                    'details': f'原始数据: {len(self.raw_data)}, 有效数据: {len(df)}',
                    'timestamp': datetime.now().isoformat()
                })
            
            # 趋势变化预警
            trend_alerts = self._detect_trend_changes(df)
            alerts.extend(trend_alerts)
            
            self.alerts = alerts
            self.logger.info(f"检测到 {len(alerts)} 个预警信号")
            
            return alerts
            
        except Exception as e:
            self.logger.error(f"预警检测失败: {e}")
            return []
    
    def _detect_trend_changes(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """检测趋势变化"""
        try:
            trend_alerts = []
            
            # 分析新兴关键词
            recent_products = df[df['running_days'] <= 7]  # 最近一周的新产品
            if len(recent_products) > 0:
                # 分析关键词频率
                keyword_counts = {}
                for name in recent_products['product_name']:
                    words = name.lower().split()
                    for word in words:
                        if len(word) > 3:  # 忽略短词
                            keyword_counts[word] = keyword_counts.get(word, 0) + 1
                
                # 找出高频新兴关键词
                emerging_keywords = [k for k, v in keyword_counts.items() if v >= 3]
                
                if emerging_keywords:
                    trend_alerts.append({
                        'type': 'emerging_trend',
                        'level': 'info',
                        'message': f'发现新兴趋势关键词: {", ".join(emerging_keywords[:5])}',
                        'keywords': emerging_keywords,
                        'timestamp': datetime.now().isoformat()
                    })
            
            # 价格趋势分析
            avg_price = df['price'].mean()
            median_price = df['price'].median()
            
            if avg_price > median_price * 1.5:  # 平均价格显著高于中位数
                trend_alerts.append({
                    'type': 'price_trend',
                    'level': 'info',
                    'message': f'价格趋势偏高，平均价格: ${avg_price:.2f}, 中位数: ${median_price:.2f}',
                    'avg_price': avg_price,
                    'median_price': median_price,
                    'timestamp': datetime.now().isoformat()
                })
            
            return trend_alerts
            
        except Exception as e:
            self.logger.error(f"趋势变化检测失败: {e}")
            return []
    
    def _add_to_human_review(self, item: Dict[str, Any], reason: str, priority: str) -> None:
        """添加到人工审核队列"""
        if HUMAN_REVIEW_TRIGGERS.get('high_potential_products', False):
            review_item = {
                'id': f"review_{len(self.human_review_queue) + 1}",
                'item': item,
                'reason': reason,
                'priority': priority,
                'timestamp': datetime.now().isoformat(),
                'status': 'pending'
            }
            self.human_review_queue.append(review_item)
    
    def generate_analysis_summary(self, df: pd.DataFrame) -> Dict[str, Any]:
        """生成分析总结"""
        try:
            summary = {
                'analysis_time': datetime.now().isoformat(),
                'total_products': len(df),
                'recommendation_distribution': df['recommendation_level'].value_counts().to_dict(),
                'high_potential_count': df['high_potential'].sum(),
                'average_metrics': {
                    'like_rate': df['like_rate'].mean(),
                    'engagement_rate': df['engagement_rate'].mean(),
                    'price': df['price'].mean(),
                    'impressions': df['impressions'].mean()
                },
                'top_products': df.head(5)[['product_name', 'recommendation_level', 'overall_score']].to_dict('records'),
                'alerts_count': len(self.alerts),
                'human_review_count': len(self.human_review_queue)
            }
            
            self.analysis_results = summary
            return summary
            
        except Exception as e:
            self.logger.error(f"分析总结生成失败: {e}")
            return {}
    
    def save_processed_data(self, df: pd.DataFrame) -> bool:
        """保存处理后的数据"""
        try:
            # 保存深度分析数据
            analysis_file = get_output_path(PATHS['deep_analysis_file'])
            df.to_csv(analysis_file, index=False, encoding='utf-8')
            self.logger.info(f"分析数据已保存到: {analysis_file}")
            
            # 保存预警数据
            if self.alerts:
                alerts_df = pd.DataFrame(self.alerts)
                alerts_file = get_output_path('./outputs/alerts_{date}.csv')
                alerts_df.to_csv(alerts_file, index=False, encoding='utf-8')
                self.logger.info(f"预警数据已保存到: {alerts_file}")
            
            # 保存人工审核队列
            if self.human_review_queue:
                review_df = pd.DataFrame(self.human_review_queue)
                review_file = get_output_path('./outputs/human_review_queue_{date}.csv')
                review_df.to_csv(review_file, index=False, encoding='utf-8')
                self.logger.info(f"审核队列已保存到: {review_file}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"保存处理数据失败: {e}")
            return False
    
    def process_data(self, data_source: str) -> Dict[str, Any]:
        """完整的数据处理流程"""
        try:
            self.logger.info("=== 开始数据处理流程 ===")
            
            # 1. 加载数据
            if not self.load_data(data_source):
                return {}
            
            # 2. 数据清洗
            cleaned_data = self.clean_data()
            
            # 3. 计算指标
            enriched_data = self.calculate_metrics(cleaned_data)
            
            # 4. 应用筛选
            filtered_data = self.apply_filters(enriched_data)
            
            # 5. 产品排名
            ranked_data = self.rank_products(filtered_data)
            
            # 6. 预警检测
            alerts = self.detect_alerts(ranked_data)
            
            # 7. 生成总结
            summary = self.generate_analysis_summary(ranked_data)
            
            # 8. 保存数据
            self.save_processed_data(ranked_data)
            
            self.processed_data = ranked_data
            
            self.logger.info("=== 数据处理流程完成 ===")
            return summary
            
        except Exception as e:
            self.logger.error(f"数据处理流程失败: {e}")
            return {}

# 使用示例
if __name__ == "__main__":
    processor = DataProcessor()
    
    # 处理示例数据
    sample_data = pd.DataFrame({
        'product_name': ['维C精华液', 'LED面膜', '玻尿酸面膜'],
        'impressions': [15000, 25000, 8000],
        'likes': [450, 750, 200],
        'comments': [89, 156, 45],
        'price': [29.99, 89.99, 19.99],
        'running_days': [14, 21, 7],
        'advertiser': ['品牌A', '品牌B', '品牌C']
    })
    
    # 执行处理流程
    results = processor.process_data(sample_data)
    
    print("数据处理结果:")
    print(f"总产品数: {results.get('total_products', 0)}")
    print(f"高潜力产品: {results.get('high_potential_count', 0)}")
    print(f"预警数量: {results.get('alerts_count', 0)}")
    print(f"待审核数量: {results.get('human_review_count', 0)}")