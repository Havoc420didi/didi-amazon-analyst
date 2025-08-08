"""
API模板类
用于存储解析后的API接口信息
"""
from typing import Dict, Any, Optional, List
import json

class ApiTemplate:
    """API接口模板类"""
    
    def __init__(self):
        """初始化API模板"""
        self.name: str = ""                           # 接口名称
        self.endpoint: str = ""                       # 接口端点
        self.method: str = "GET"                      # HTTP方法
        self.description: str = ""                    # 接口描述
        self.request_params: Dict[str, Any] = {}      # 请求参数
        self.response_format: Any = None              # 响应格式
        self.response_fields: Dict[str, str] = {}     # 响应字段说明
        self.request_example: str = ""                # 请求示例
        self.response_example: str = ""               # 响应示例
        self.headers: Dict[str, str] = {}             # 请求头
        self.timeout: int = 30                        # 超时时间
        self.retry_count: int = 3                     # 重试次数
        self.rate_limit: Optional[int] = None         # 限流设置
    
    def build_request_url(self, base_url: str, params: Dict[str, Any] = None) -> str:
        """构建完整的请求URL"""
        url = f"{base_url.rstrip('/')}/{self.endpoint.lstrip('/')}"
        
        if params and self.method.upper() == 'GET':
            # GET请求参数附加到URL
            param_strs = []
            for key, value in params.items():
                if value is not None:
                    param_strs.append(f"{key}={value}")
            
            if param_strs:
                separator = '&' if '?' in url else '?'
                url += separator + '&'.join(param_strs)
        
        return url
    
    def build_request_headers(self, additional_headers: Dict[str, str] = None) -> Dict[str, str]:
        """构建请求头"""
        headers = self.headers.copy()
        
        # 默认请求头
        default_headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'SaihuERP-DataSync/1.0'
        }
        
        # 合并请求头（优先级：additional_headers > self.headers > default_headers）
        for key, value in default_headers.items():
            if key not in headers:
                headers[key] = value
        
        if additional_headers:
            headers.update(additional_headers)
        
        return headers
    
    def build_request_body(self, params: Dict[str, Any] = None) -> Optional[str]:
        """构建请求体"""
        if self.method.upper() in ['POST', 'PUT', 'PATCH'] and params:
            # 过滤有效参数
            valid_params = {}
            
            for key, value in params.items():
                # 检查参数是否在接口定义中
                if key in self.request_params or not self.request_params:
                    if value is not None:
                        valid_params[key] = value
            
            if valid_params:
                return json.dumps(valid_params, default=str, ensure_ascii=False)
        
        return None
    
    def validate_params(self, params: Dict[str, Any]) -> tuple[bool, List[str]]:
        """验证请求参数"""
        errors = []
        
        if not self.request_params:
            # 如果没有参数定义，跳过验证
            return True, errors
        
        # 检查必需参数
        for param_name, param_info in self.request_params.items():
            if param_info.get('required', False):
                if param_name not in params or params[param_name] is None:
                    errors.append(f"缺少必需参数: {param_name}")
        
        # 检查参数类型（简单验证）
        for param_name, param_value in params.items():
            if param_name in self.request_params:
                param_info = self.request_params[param_name]
                expected_type = param_info.get('type', 'string').lower()
                
                if param_value is not None:
                    if expected_type == 'int' and not isinstance(param_value, int):
                        try:
                            int(param_value)
                        except (ValueError, TypeError):
                            errors.append(f"参数 {param_name} 应为整数类型")
                    
                    elif expected_type == 'float' and not isinstance(param_value, (int, float)):
                        try:
                            float(param_value)
                        except (ValueError, TypeError):
                            errors.append(f"参数 {param_name} 应为数字类型")
                    
                    elif expected_type == 'bool' and not isinstance(param_value, bool):
                        if str(param_value).lower() not in ['true', 'false', '1', '0']:
                            errors.append(f"参数 {param_name} 应为布尔类型")
        
        return len(errors) == 0, errors
    
    def get_required_params(self) -> List[str]:
        """获取必需参数列表"""
        return [
            param_name for param_name, param_info in self.request_params.items()
            if param_info.get('required', False)
        ]
    
    def get_optional_params(self) -> List[str]:
        """获取可选参数列表"""
        return [
            param_name for param_name, param_info in self.request_params.items()
            if not param_info.get('required', False)
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'name': self.name,
            'endpoint': self.endpoint,
            'method': self.method,
            'description': self.description,
            'request_params': self.request_params,
            'response_format': self.response_format,
            'response_fields': self.response_fields,
            'request_example': self.request_example,
            'response_example': self.response_example,
            'headers': self.headers,
            'timeout': self.timeout,
            'retry_count': self.retry_count,
            'rate_limit': self.rate_limit
        }
    
    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ApiTemplate':
        """从字典创建实例"""
        template = cls()
        
        for key, value in data.items():
            if hasattr(template, key):
                setattr(template, key, value)
        
        return template
    
    @classmethod
    def from_json(cls, json_str: str) -> 'ApiTemplate':
        """从JSON字符串创建实例"""
        data = json.loads(json_str)
        return cls.from_dict(data)
    
    def clone(self) -> 'ApiTemplate':
        """克隆API模板"""
        return ApiTemplate.from_dict(self.to_dict())
    
    def merge_config(self, config: Dict[str, Any]) -> None:
        """合并外部配置"""
        if 'timeout' in config:
            self.timeout = config['timeout']
        
        if 'retry_count' in config:
            self.retry_count = config['retry_count']
        
        if 'rate_limit' in config:
            self.rate_limit = config['rate_limit']
        
        if 'headers' in config:
            self.headers.update(config['headers'])
    
    def __str__(self) -> str:
        return f"ApiTemplate(name={self.name}, method={self.method}, endpoint={self.endpoint})"
    
    def __repr__(self) -> str:
        return self.__str__()