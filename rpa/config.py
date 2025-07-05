"""
Pipiads RPA自动化配置文件
包含所有配置参数、筛选条件、路径设置等
"""

import os
from datetime import datetime

# ================================
# 基础配置
# ================================

# Pipiads账户配置
PIPIADS_CONFIG = {
    'login_url': 'https://www.pipiads.com/login',
    'username': '',  # 从环境变量读取
    'password': '',  # 从环境变量读取
    'dashboard_url': 'https://www.pipiads.com/dashboard',
    'search_url': 'https://www.pipiads.com/ad-search'
}

# 浏览器配置
BROWSER_CONFIG = {
    'headless': False,  # 是否无头模式
    'window_width': 1920,
    'window_height': 1080,
    'page_load_timeout': 30,
    'implicit_wait': 10,
    'download_dir': './downloads'
}

# ================================
# 筛选条件配置
# ================================

# 基础筛选条件（按SOP要求）
FILTER_CONFIG = {
    'platform': 'TikTok',
    'category': 'Beauty',
    'ecommerce_platform': 'Shopify',
    'target_countries': ['United States', 'United Kingdom', 'Canada', 'Australia'],
    'language': 'English',
    'date_range': 30,  # 最近30天
    'min_impressions': 500,  # 最低展示量
    'price_range': {
        'min': 3,   # 最低价格$3
        'max': 500  # 最高价格$500
    }
}

# 硬性筛选标准
HARD_CRITERIA = {
    'min_impressions': 500,
    'min_likes': 100,
    'min_like_rate': 2.0,  # 2%
    'min_running_days': 7,
    'min_comments': 20
}

# 理想状态标准
IDEAL_CRITERIA = {
    'ideal_impressions': 10000,
    'ideal_likes': 1000,
    'ideal_like_rate': 3.0,  # 3%
    'ideal_running_days': 14,
    'ideal_comments': 100
}

# 排除标准
EXCLUSION_CRITERIA = {
    'medical_claims_keywords': [
        'cure', 'treat', 'medicine', 'drug', 'prescription', 
        'FDA approved', 'medical grade', 'therapeutic'
    ],
    'max_negative_sentiment': 0.3,  # 最大负面情感比例
    'banned_sellers': [],  # 被封禁的卖家列表
    'copyright_keywords': ['Disney', 'Marvel', 'Nike', 'Louis Vuitton']
}

# ================================
# 搜索关键词配置
# ================================

# 按SOP的轮换关键词计划
DAILY_KEYWORDS = {
    0: ['skincare', 'anti-aging', 'vitamin C'],      # 周一
    1: ['makeup', 'beauty tools', 'LED'],            # 周二
    2: ['hair care', 'hair growth', 'scalp'],        # 周三
    3: ['acne treatment', 'blackhead', 'pore'],      # 周四
    4: ['eye cream', 'wrinkle', 'serum'],           # 周五
    5: ['skincare', 'weekend special'],              # 周六
    6: ['makeup', 'beauty trends']                   # 周日
}

# 美妆类别关键词库
BEAUTY_KEYWORDS = {
    'skincare': [
        'skincare', 'anti-aging', 'vitamin C', 'retinol', 'hyaluronic acid',
        'serum', 'moisturizer', 'cleanser', 'toner', 'essence', 'face mask',
        'acne treatment', 'blackhead remover', 'pore minimizer', 'eye cream'
    ],
    'makeup': [
        'makeup', 'foundation', 'lipstick', 'eyeshadow', 'mascara', 'blush',
        'concealer', 'primer', 'highlighter', 'contour', 'setting spray',
        'eyeliner', 'brow pencil', 'lip gloss'
    ],
    'hair_care': [
        'hair care', 'shampoo', 'conditioner', 'hair oil', 'hair mask',
        'scalp treatment', 'hair growth', 'hair serum', 'dry shampoo',
        'hair spray', 'heat protectant'
    ],
    'beauty_tools': [
        'beauty tools', 'facial roller', 'LED mask', 'cleansing brush',
        'hair straightener', 'curling iron', 'makeup brushes', 'beauty blender',
        'eyelash curler', 'tweezers', 'facial steamer'
    ]
}

# ================================
# 数据收集配置
# ================================

# 需要收集的产品数据字段
PRODUCT_DATA_FIELDS = [
    'product_name', 'product_url', 'ad_id', 'advertiser', 'price',
    'impressions', 'likes', 'comments', 'shares', 'like_rate',
    'engagement_rate', 'first_seen_date', 'running_days', 'countries',
    'video_duration', 'ad_copy', 'landing_page', 'shopify_store'
]

# CSS选择器配置（需要根据Pipiads实际页面调整）
SELECTORS = {
    'login': {
        'username_field': 'input[name="email"]',
        'password_field': 'input[name="password"]',
        'login_button': 'button[type="submit"]'
    },
    'search': {
        'search_input': 'input[placeholder="Search for ads"]',
        'platform_filter': 'select[name="platform"]',
        'category_filter': 'select[name="category"]',
        'country_filter': 'select[name="country"]',
        'date_filter': 'select[name="date_range"]',
        'search_button': 'button.search-btn'
    },
    'results': {
        'product_cards': '.ad-card',
        'product_name': '.ad-title',
        'advertiser': '.advertiser-name',
        'impressions': '.impressions',
        'likes': '.likes',
        'comments': '.comments',
        'like_rate': '.like-rate',
        'first_seen': '.first-seen',
        'price': '.price',
        'video_link': '.video-link',
        'landing_page': '.landing-page'
    }
}

# ================================
# 输出配置
# ================================

# 文件路径配置
PATHS = {
    'output_dir': './outputs',
    'daily_scan_file': './outputs/daily_scan_{date}.csv',
    'deep_analysis_file': './outputs/deep_analysis_{date}.csv',
    'competitor_monitor_file': './outputs/competitor_monitor_{date}.csv',
    'daily_report_file': './outputs/daily_report_{date}.md',
    'excel_database': './outputs/pipiads_database.xlsx',
    'logs_dir': './logs',
    'error_log': './logs/error_{date}.log',
    'activity_log': './logs/activity_{date}.log'
}

# Excel工作表配置
EXCEL_SHEETS = {
    'daily_scan': '每日扫描记录',
    'deep_analysis': '深度分析记录',
    'competitor_monitor': '竞品监控',
    'weekly_summary': '周期汇总',
    'alerts': '预警记录'
}

# ================================
# 调度配置
# ================================

# RPA执行时间配置
SCHEDULE_CONFIG = {
    'daily_scan_time': '08:00',
    'competitor_monitor_time': '12:00',
    'daily_report_time': '17:00',
    'weekly_report_day': 'friday',
    'weekly_report_time': '18:00'
}

# 任务超时配置
TIMEOUT_CONFIG = {
    'login_timeout': 30,
    'search_timeout': 60,
    'data_collection_timeout': 300,  # 5分钟
    'report_generation_timeout': 120  # 2分钟
}

# ================================
# 预警配置
# ================================

# 预警阈值
ALERT_THRESHOLDS = {
    'high_potential_impressions': 10000,
    'high_potential_like_rate': 3.0,
    'competitor_increase_threshold': 0.3,  # 30%增长
    'data_quality_threshold': 0.95,  # 95%数据质量
    'system_error_threshold': 3  # 连续3次错误
}

# 预警通知配置
NOTIFICATION_CONFIG = {
    'email_enabled': False,
    'slack_enabled': False,
    'file_log_enabled': True,
    'console_log_enabled': True
}

# ================================
# 质量控制配置
# ================================

# 数据验证规则
VALIDATION_RULES = {
    'price_range': {'min': 0.01, 'max': 10000},
    'like_rate_range': {'min': 0, 'max': 100},
    'impressions_range': {'min': 0, 'max': 100000000},
    'running_days_range': {'min': 0, 'max': 365}
}

# 异常检测配置
ANOMALY_DETECTION = {
    'z_score_threshold': 3,  # Z-score异常检测阈值
    'iqr_multiplier': 1.5,   # IQR异常检测倍数
    'enable_outlier_removal': True
}

# ================================
# 人机协作配置
# ================================

# 需要人工审核的条件
HUMAN_REVIEW_TRIGGERS = {
    'high_potential_products': True,  # A级产品需要人工确认
    'compliance_risks': True,         # 合规风险需要专业审核
    'data_anomalies': True,          # 数据异常需要人工检查
    'new_trends': True,              # 新趋势需要人工分析
    'system_errors': True           # 系统错误需要技术介入
}

# 审核队列配置
REVIEW_QUEUE_CONFIG = {
    'max_queue_size': 50,
    'priority_levels': ['urgent', 'high', 'medium', 'low'],
    'auto_escalation_hours': 24  # 24小时未处理自动升级
}

# ================================
# 环境变量配置
# ================================

def load_env_config():
    """从环境变量加载敏感配置"""
    config = {
        'pipiads_username': os.getenv('PIPIADS_USERNAME', ''),
        'pipiads_password': os.getenv('PIPIADS_PASSWORD', ''),
        'notification_email': os.getenv('NOTIFICATION_EMAIL', ''),
        'slack_webhook': os.getenv('SLACK_WEBHOOK', ''),
        'proxy_url': os.getenv('PROXY_URL', ''),
        'user_agent': os.getenv('USER_AGENT', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
    }
    
    # 验证必要的配置
    if not config['pipiads_username'] or not config['pipiads_password']:
        print("⚠️ 警告: PIPIADS_USERNAME 或 PIPIADS_PASSWORD 环境变量未设置")
        print("请设置环境变量或在 .env 文件中配置")
    
    return config

# ================================
# 辅助函数
# ================================

def get_today_keywords():
    """获取今日应该搜索的关键词"""
    today = datetime.now().weekday()
    return DAILY_KEYWORDS.get(today, DAILY_KEYWORDS[0])

def get_output_path(template, **kwargs):
    """生成输出文件路径"""
    date_str = datetime.now().strftime('%Y%m%d')
    return template.format(date=date_str, **kwargs)

def validate_config():
    """验证配置的完整性和正确性"""
    required_env_vars = ['PIPIADS_USERNAME', 'PIPIADS_PASSWORD']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {missing_vars}")
    
    # 更新PIPIADS_CONFIG with environment variables
    env_config = load_env_config()
    PIPIADS_CONFIG['username'] = env_config['pipiads_username']
    PIPIADS_CONFIG['password'] = env_config['pipiads_password']
    
    # 创建必要的目录
    for path in [PATHS['output_dir'], PATHS['logs_dir'], BROWSER_CONFIG['download_dir']]:
        os.makedirs(path, exist_ok=True)
    
    return True

# 初始化配置
if __name__ == "__main__":
    try:
        validate_config()
        print("配置验证通过！")
        print(f"今日关键词: {get_today_keywords()}")
        print(f"输出目录: {PATHS['output_dir']}")
    except Exception as e:
        print(f"配置验证失败: {e}")