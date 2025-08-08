"""
Markdown API文档解析器
解析本地MD格式的接口文档，提取API接口信息
"""
import re
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from .api_template import ApiTemplate

logger = logging.getLogger(__name__)

class MarkdownApiParser:
    """Markdown API文档解析器"""
    
    def __init__(self, md_file_path: str):
        """初始化解析器"""
        self.md_file_path = md_file_path
        self.content = ""
        self.apis = {}
        self._load_content()
    
    def _load_content(self) -> None:
        """加载MD文件内容"""
        try:
            with open(self.md_file_path, 'r', encoding='utf-8') as f:
                self.content = f.read()
            logger.info(f"成功加载MD文档: {self.md_file_path}")
        except Exception as e:
            logger.error(f"加载MD文档失败: {e}")
            raise
    
    def parse_all_apis(self) -> Dict[str, ApiTemplate]:
        """解析所有API接口"""
        try:
            # 按照二级标题分割内容
            sections = self._split_by_headers()
            
            for section_title, section_content in sections.items():
                if self._is_api_section(section_title):
                    api_template = self._parse_api_section(section_title, section_content)
                    if api_template:
                        api_key = self._generate_api_key(section_title)
                        self.apis[api_key] = api_template
            
            logger.info(f"解析完成，共发现 {len(self.apis)} 个API接口")
            return self.apis
            
        except Exception as e:
            logger.error(f"解析API文档失败: {e}")
            raise
    
    def _split_by_headers(self) -> Dict[str, str]:
        """按照标题分割文档内容"""
        sections = {}
        
        # 匹配二级标题 (## 标题)
        header_pattern = r'^##\s+(.+)$'
        lines = self.content.split('\n')
        
        current_section = None
        current_content = []
        
        for line in lines:
            header_match = re.match(header_pattern, line, re.MULTILINE)
            
            if header_match:
                # 保存上一个section
                if current_section:
                    sections[current_section] = '\n'.join(current_content)
                
                # 开始新的section
                current_section = header_match.group(1).strip()
                current_content = []
            else:
                if current_section:
                    current_content.append(line)
        
        # 保存最后一个section
        if current_section:
            sections[current_section] = '\n'.join(current_content)
        
        return sections
    
    def _is_api_section(self, title: str) -> bool:
        """判断是否为API接口章节"""
        api_keywords = ['接口', 'api', 'endpoint', '数据', '获取', '查询', '同步']
        title_lower = title.lower()
        
        return any(keyword in title_lower for keyword in api_keywords)
    
    def _parse_api_section(self, title: str, content: str) -> Optional[ApiTemplate]:
        """解析单个API接口章节"""
        try:
            api_template = ApiTemplate()
            api_template.name = title
            
            # 解析接口基本信息
            self._parse_basic_info(content, api_template)
            
            # 解析请求参数
            self._parse_request_params(content, api_template)
            
            # 解析响应格式
            self._parse_response_format(content, api_template)
            
            # 解析示例
            self._parse_examples(content, api_template)
            
            return api_template
            
        except Exception as e:
            logger.error(f"解析API章节失败 [{title}]: {e}")
            return None
    
    def _parse_basic_info(self, content: str, api_template: ApiTemplate) -> None:
        """解析接口基本信息"""
        # 解析URL
        url_patterns = [
            r'(?:URL|url|地址)[:：]\s*([^\s\n]+)',
            r'(?:GET|POST|PUT|DELETE)\s+([^\s\n]+)',
            r'`([^`]+/api/[^`]+)`'
        ]
        
        for pattern in url_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                api_template.endpoint = match.group(1).strip()
                break
        
        # 解析HTTP方法
        method_match = re.search(r'(?:方法|Method)[:：]\s*(GET|POST|PUT|DELETE)', content, re.IGNORECASE)
        if method_match:
            api_template.method = method_match.group(1).upper()
        else:
            # 从URL行中提取方法
            method_in_url = re.search(r'(GET|POST|PUT|DELETE)\s+', content, re.IGNORECASE)
            if method_in_url:
                api_template.method = method_in_url.group(1).upper()
        
        # 解析描述
        desc_patterns = [
            r'(?:描述|说明|Description)[:：]\s*([^\n]+)',
            r'(?:功能|作用)[:：]\s*([^\n]+)'
        ]
        
        for pattern in desc_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                api_template.description = match.group(1).strip()
                break
    
    def _parse_request_params(self, content: str, api_template: ApiTemplate) -> None:
        """解析请求参数"""
        # 查找参数表格或列表
        param_section = self._extract_section(content, ['参数', 'Parameters', '请求参数'])
        
        if param_section:
            # 解析表格格式的参数
            table_params = self._parse_param_table(param_section)
            if table_params:
                api_template.request_params = table_params
                return
            
            # 解析列表格式的参数
            list_params = self._parse_param_list(param_section)
            if list_params:
                api_template.request_params = list_params
    
    def _parse_response_format(self, content: str, api_template: ApiTemplate) -> None:
        """解析响应格式"""
        response_section = self._extract_section(content, ['响应', 'Response', '返回', '结果'])
        
        if response_section:
            # 提取JSON示例
            json_match = re.search(r'```(?:json)?\s*\n(.*?)\n```', response_section, re.DOTALL)
            if json_match:
                try:
                    json_str = json_match.group(1).strip()
                    api_template.response_format = json.loads(json_str)
                except json.JSONDecodeError:
                    # 如果解析失败，保存原始字符串
                    api_template.response_format = json_str
            
            # 解析响应字段说明
            response_fields = self._parse_response_fields(response_section)
            if response_fields:
                api_template.response_fields = response_fields
    
    def _parse_examples(self, content: str, api_template: ApiTemplate) -> None:
        """解析示例"""
        example_section = self._extract_section(content, ['示例', 'Example', '例子'])
        
        if example_section:
            # 提取请求示例
            request_example = self._extract_code_block(example_section, ['请求', 'Request'])
            if request_example:
                api_template.request_example = request_example
            
            # 提取响应示例  
            response_example = self._extract_code_block(example_section, ['响应', 'Response'])
            if response_example:
                api_template.response_example = response_example
    
    def _extract_section(self, content: str, keywords: List[str]) -> Optional[str]:
        """提取包含关键词的章节内容"""
        for keyword in keywords:
            # 匹配三级标题或加粗文本
            patterns = [
                f'###\\s*{keyword}[^\\n]*\\n(.*?)(?=###|$)',
                f'\\*\\*{keyword}[^\\n]*\\*\\*[^\\n]*\\n(.*?)(?=\\*\\*|$)',
                f'{keyword}[:：][^\\n]*\\n(.*?)(?=\\n\\n|$)'
            ]
            
            for pattern in patterns:
                match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
                if match:
                    return match.group(1).strip()
        
        return None
    
    def _parse_param_table(self, content: str) -> Optional[Dict[str, Any]]:
        """解析表格格式的参数"""
        # 匹配Markdown表格
        table_pattern = r'\\|([^\\n]+)\\|[^\\n]*\\n\\|[-\\s\\|]+\\n((?:\\|[^\\n]+\\|[^\\n]*\\n)*)'
        table_match = re.search(table_pattern, content)
        
        if not table_match:
            return None
        
        headers = [h.strip() for h in table_match.group(1).split('|') if h.strip()]
        rows_text = table_match.group(2)
        
        params = {}
        
        for row in rows_text.strip().split('\\n'):
            if not row.strip():
                continue
            
            cells = [c.strip() for c in row.split('|') if c.strip()]
            if len(cells) >= 2:
                param_name = cells[0]
                param_info = {
                    'required': True,
                    'type': 'string',
                    'description': ''
                }
                
                # 根据表头解析信息
                for i, header in enumerate(headers[1:], 1):
                    if i < len(cells):
                        header_lower = header.lower()
                        if 'type' in header_lower or '类型' in header:
                            param_info['type'] = cells[i]
                        elif 'required' in header_lower or '必需' in header or '必填' in header:
                            param_info['required'] = cells[i].lower() in ['yes', 'true', '是', '必填']
                        elif 'desc' in header_lower or '说明' in header or '描述' in header:
                            param_info['description'] = cells[i]
                
                params[param_name] = param_info
        
        return params if params else None
    
    def _parse_param_list(self, content: str) -> Optional[Dict[str, Any]]:
        """解析列表格式的参数"""
        # 匹配列表项: - 参数名: 说明
        list_pattern = r'-\\s+([^:：]+)[:：]\\s*([^\\n]+)'
        matches = re.findall(list_pattern, content)
        
        if not matches:
            return None
        
        params = {}
        for param_name, description in matches:
            param_name = param_name.strip()
            params[param_name] = {
                'required': True,
                'type': 'string',
                'description': description.strip()
            }
        
        return params
    
    def _parse_response_fields(self, content: str) -> Optional[Dict[str, str]]:
        """解析响应字段说明"""
        # 类似参数解析
        fields = {}
        
        # 尝试表格格式
        table_params = self._parse_param_table(content)
        if table_params:
            fields = {k: v.get('description', '') for k, v in table_params.items()}
        
        # 尝试列表格式
        if not fields:
            list_matches = re.findall(r'-\\s+([^:：]+)[:：]\\s*([^\\n]+)', content)
            fields = {name.strip(): desc.strip() for name, desc in list_matches}
        
        return fields if fields else None
    
    def _extract_code_block(self, content: str, keywords: List[str]) -> Optional[str]:
        """提取代码块"""
        for keyword in keywords:
            pattern = f'{keyword}[^\\n]*\\n```[^\\n]*\\n(.*?)\\n```'
            match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None
    
    def _generate_api_key(self, title: str) -> str:
        """生成API键名"""
        # 移除特殊字符，转为小写，用下划线连接
        key = re.sub(r'[^\\w\\s]', '', title)
        key = re.sub(r'\\s+', '_', key.strip()).lower()
        
        # 简化常见术语
        replacements = {
            'product_analytics': 'product_analytics',
            'fba_inventory': 'fba_inventory', 
            'inventory_details': 'inventory_details',
            '产品分析': 'product_analytics',
            'fba库存': 'fba_inventory',
            '库存明细': 'inventory_details'
        }
        
        for old, new in replacements.items():
            if old in key:
                return new
        
        return key
    
    def get_api(self, api_key: str) -> Optional[ApiTemplate]:
        """获取指定的API模板"""
        return self.apis.get(api_key)
    
    def list_apis(self) -> List[str]:
        """列出所有API键名"""
        return list(self.apis.keys())
    
    def export_to_json(self, output_file: str = None) -> str:
        """导出解析结果为JSON"""
        result = {}
        
        for key, api_template in self.apis.items():
            result[key] = api_template.to_dict()
        
        json_str = json.dumps(result, indent=2, ensure_ascii=False)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(json_str)
            logger.info(f"API解析结果已导出到: {output_file}")
        
        return json_str