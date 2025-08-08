"""
赛狐ERP API签名生成器
根据API文档要求生成请求签名
"""
import hashlib
import hmac
import time
import random
import logging
from typing import Dict, Any, Optional
from ..config.secure_config import config

logger = logging.getLogger(__name__)

class ApiSigner:
    """API签名生成器"""
    
    def __init__(self):
        """初始化签名生成器"""
        # 使用安全配置获取凭据
        api_credentials = config.get_api_credentials()
        self.client_id = api_credentials.client_id
        self.client_secret = api_credentials.client_secret
        logger.info("API签名生成器初始化完成")
    
    def generate_timestamp(self) -> str:
        """生成13位毫秒时间戳"""
        return str(int(time.time() * 1000))
    
    def generate_nonce(self) -> str:
        """生成随机整数值"""
        return str(random.randint(100000, 999999))
    
    def generate_sign(self, 
                     access_token: str,
                     timestamp: str, 
                     nonce: str,
                     url: str,
                     method: str = 'post') -> str:
        """
        生成请求签名 - 使用正确的赛狐ERP HMAC SHA256签名算法
        
        Args:
            access_token: 访问令牌
            timestamp: 时间戳
            nonce: 随机数
            url: 接口请求路径（如：/api/order/pageList.json）
            method: 请求方式（默认post）
            
        Returns:
            签名字符串
        """
        try:
            # 验签参数（按照官方文档要求）
            params = {
                'access_token': access_token,
                'client_id': self.client_id,
                'method': method,
                'nonce': nonce,
                'timestamp': timestamp,
                'url': url
            }
            
            # 按参数名排序，拼接成key=value&格式
            sorted_items = sorted(params.items())
            param_str = '&'.join([f"{key}={value}" for key, value in sorted_items])
            
            logger.debug(f"签名参数字符串: {param_str}")
            
            # 使用HMAC SHA256签名，client_secret作为密钥
            signature = hmac.new(
                self.client_secret.encode('utf-8'),
                param_str.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            logger.debug(f"生成HMAC SHA256签名: {signature}")
            return signature
            
        except Exception as e:
            logger.error(f"签名生成失败: {e}")
            raise
    
    def generate_sign_params(self, 
                           access_token: str,
                           url: str,
                           method: str = 'post') -> Dict[str, str]:
        """
        生成完整的签名参数
        
        Args:
            access_token: 访问令牌
            url: 接口请求路径
            method: 请求方式
            
        Returns:
            包含所有签名参数的字典
        """
        timestamp = self.generate_timestamp()
        nonce = self.generate_nonce()
        sign = self.generate_sign(access_token, timestamp, nonce, url, method)
        
        return {
            'access_token': access_token,
            'client_id': self.client_id,
            'timestamp': timestamp,
            'nonce': nonce,
            'sign': sign
        }
    
    def validate_timestamp(self, timestamp: str) -> bool:
        """
        验证时间戳是否在有效范围内（15分钟内）
        
        Args:
            timestamp: 13位毫秒时间戳
            
        Returns:
            是否有效
        """
        try:
            request_time = int(timestamp) / 1000
            current_time = time.time()
            time_diff = abs(current_time - request_time)
            
            # 15分钟 = 900秒
            is_valid = time_diff <= 900
            
            if not is_valid:
                logger.warning(f"时间戳超出有效范围: {time_diff}秒")
            
            return is_valid
            
        except (ValueError, TypeError) as e:
            logger.error(f"时间戳格式错误: {e}")
            return False

# 全局签名生成器实例
api_signer = ApiSigner()