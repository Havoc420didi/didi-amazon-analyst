"""
测试配置文件
包含测试用的认证信息和配置
"""
import os
from datetime import datetime

# 测试认证信息
TEST_AUTH_CONFIG = {
    "client_id": "368000",
    "client_secret": "3cc6efdf-6861-42e0-b9a5-874a0296640b",
    "auth_type": "oauth2"  # 或 "client_credentials"
}

# 测试API配置
TEST_API_CONFIG = {
    "base_url": "https://openapi.sellfox.com",
    "auth_endpoint": "/api/oauth/v2/token.json",
    "timeout": 30,
    "retry_count": 2,
    "rate_limit": {
        "requests_per_minute": 60,
        "burst_size": 5
    }
}

# 测试数据库配置
TEST_DB_CONFIG = {
    "host": os.getenv("TEST_DB_HOST", "localhost"),
    "port": int(os.getenv("TEST_DB_PORT", "3306")),
    "user": os.getenv("TEST_DB_USER", "root"),
    "password": os.getenv("TEST_DB_PASSWORD", ""),
    "database": os.getenv("TEST_DB_NAME", "saihu_erp_sync_test"),
    "charset": "utf8mb4"
}

# 测试数据配置
TEST_DATA_CONFIG = {
    "sample_product_ids": ["PROD001", "PROD002", "PROD003"],
    "sample_skus": ["SKU001", "SKU002", "SKU003"], 
    "sample_marketplace_ids": ["ATVPDKIKX0DER", "A1PA6795UKMFR9"],
    "sample_warehouse_codes": ["WH001", "WH002"],
    "test_date_range": {
        "start_date": "2025-07-16",
        "end_date": "2025-07-22"
    }
}

# 测试场景配置
TEST_SCENARIOS = {
    "auth_test": {
        "valid_credentials": True,
        "invalid_credentials": True,
        "token_refresh": True
    },
    "data_fetch_test": {
        "product_analytics": True,
        "fba_inventory": True,
        "inventory_details": True,
        "pagination": True,
        "error_handling": True
    },
    "data_processing_test": {
        "data_cleaning": True,
        "data_validation": True,
        "data_transformation": True,
        "duplicate_handling": True
    },
    "integration_test": {
        "full_sync_flow": True,
        "scheduler_test": True,
        "error_recovery": True
    }
}

# 性能测试配置
PERFORMANCE_TEST_CONFIG = {
    "concurrent_requests": 5,
    "large_data_size": 1000,
    "load_test_duration": 60,  # seconds
    "memory_limit_mb": 512
}

# 测试环境配置
TEST_ENV_CONFIG = {
    "log_level": "DEBUG",
    "test_output_dir": "tests/output",
    "mock_server_port": 8080,
    "cleanup_after_test": True
}