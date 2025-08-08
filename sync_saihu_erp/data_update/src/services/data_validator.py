"""
数据完整性验证服务
确保同步数据的完整性和一致性
"""
import hashlib
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass

@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    stats: Dict[str, Any]

class DataIntegrityValidator:
    """数据完整性验证器"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def validate_inventory_data(self, records: List[Dict[str, Any]]) -> ValidationResult:
        """验证库存数据完整性"""
        errors = []
        warnings = []
        stats = {
            'total_records': len(records),
            'valid_records': 0,
            'invalid_records': 0,
            'missing_fields': {},
            'data_type_issues': []
        }
        
        if not records:
            return ValidationResult(False, ["无数据需要验证"], [], stats)
        
        # 必需的字段
        required_fields = {
            'asin': str,
            'productName': str,
            'totalInventory': (int, float),
            'fbaAvailable': (int, float),
            'salesPerson': str
        }
        
        # 可选字段及其类型
        optional_fields = {
            'fbaInTransit': (int, float),
            'localAvailable': (int, float),
            'averageSales': (int, float),
            'dailySalesAmount': (int, float),
            'adSpend': (int, float),
            'adImpressions': (int, float),
            'adOrderCount': (int, float)
        }
        
        for i, record in enumerate(records):
            record_errors = []
            record_warnings = []
            
            # 检查必需字段
            for field, field_type in required_fields.items():
                if field not in record or record[field] is None:
                    error = f"记录{i}: 缺失必需字段 '{field}'"
                    record_errors.append(error)
                    stats['missing_fields'][field] = stats['missing_fields'].get(field, 0) + 1
                elif not isinstance(record[field], field_type):
                    error = f"记录{i}: 字段'{field}'类型错误，期望{field_type}，得到{type(record[field])}"
                    record_warnings.append(error)
                    stats['data_type_issues'].append(error)
            
            # 检查数值字段的合理性
            if 'totalInventory' in record and record['totalInventory'] is not None:
                try:
                    inventory = float(record['totalInventory'])
                    if inventory < 0:
                        error = f"记录{i}: 库存数量({inventory})不能为负数"
                        record_errors.append(error)
                    elif inventory > 1000000:  # 合理范围检查
                        warning = f"记录{i}: 库存数量({inventory})异常高，请检查"
                        record_warnings.append(warning)
                except (ValueError, TypeError):
                    error = f"记录{i}: 库存数量格式无效"
                    record_errors.append(error)
            
            # 检查ASIN格式
            if 'asin' in record and record['asin']:
                asin = str(record['asin']).strip()
                if not asin or len(asin) != 10 or not asin.isalnum():
                    warning = f"记录{i}: ASIN格式可疑: '{asin}'"
                    record_warnings.append(warning)
            
            # 检查业务逻辑
            self._validate_business_logic(record, record_errors, record_warnings)
            
            if not record_errors:
                stats['valid_records'] += 1
            else:
                stats['invalid_records'] += 1
                errors.extend(record_errors)
            
            warnings.extend(record_warnings)
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            stats=stats
        )
    
    def _validate_business_logic(self, record: Dict[str, Any], 
                               errors: List[str], warnings: List[str]) -> None:
        """验证业务逻辑一致性"""
        
        # FBA检查
        if all(field in record and record[field] is not None 
               for field in ['totalInventory', 'fbaAvailable', 'fbaInTransit']):
            try:
                total = float(record['totalInventory'])
                fba_avail = float(record['fbaAvailable'])
                fba_transit = float(record['fbaInTransit'])
                
                calculated_total = fba_avail + fba_transit
                if abs(total - calculated_total) > 1:  # 允许1个单位误差
                    error = f"库存计算不一致: {total} != {calculated_total}"
                    warnings.append(error)
            except (ValueError, TypeError):
                pass
        
        # 销量验证
        if 'averageSales' in record and record['averageSales'] is not None:
            try:
                avg_sales = float(record['averageSales'])
                if avg_sales < 0:
                    error = f"日均销量({avg_sales})不能为负"
                    errors.append(error)
            except (ValueError, TypeError):
                error = f"日均销量数据无效"
                errors.append(error)
    
    def calculate_data_checksum(self, records: List[Dict[str, Any]]) -> str:
        """计算数据的完整性校验和"""
        if not records:
            return ""
        
        # 对关键字段进行排序和序列化
        sorted_records = []
        for record in records:
            # 选择关键字段进行校验，排除可能变化的时间戳
            key_fields = {
                'asin': record.get('asin'),
                'productName': record.get('productName'),
                'salesPerson': record.get('salesPerson'),
                'marketplace': record.get('marketplace'),
                'totalInventory': record.get('totalInventory'),
                'fbaAvailable': record.get('fbaAvailable'),
                'averageSales': record.get('averageSales')
            }
            sorted_records.append(key_fields)
        
        # 排序确保一致性
        sorted_records = sorted(sorted_records, key=lambda x: str(x.get('asin', '')))
        
        # 计算校验和
        data_str = json.dumps(sorted_records, sort_keys=True, ensure_ascii=False)
        checksum = hashlib.md5(data_str.encode()).hexdigest()
        
        return checksum
    
    def detect_duplicates(self, records: List[Dict[str, Any]]) -> Dict[str, List[int]]:
        """检测重复记录"""
        seen = {}
        duplicates = {}
        
        for i, record in enumerate(records):
            # 使用ASIN+市场作为唯一标识
            key = (
                str(record.get('asin', '')),
                str(record.get('marketplace', ''))
            )
            
            if key in seen:
                if str(key) not in duplicates:
                    duplicates[str(key)] = [seen[key]]
                duplicates[str(key)].append(i)
            else:
                seen[key] = i
        
        return {k: v for k, v in duplicates.items() if len(v) > 1}
    
    def validate_sync_result(self, original: List[Dict[str, Any]], 
                          processed: List[Dict[str, Any]]) -> ValidationResult:
        """验证同步结果"""
        errors = []
        warnings = []
        
        original_count = len(original)
        processed_count = len(processed)
        
        if original_count != processed_count:
            error = f"数据数量不一致: 原始{original_count}条 → 处理后{processed_count}条"
            errors.append(error)
        
        # 检查关键字段完整性
        original_asins = {str(r.get('asin', '')) for r in original}
        processed_asins = {str(r.get('asin', '')) for r in processed}
        
        missing_asins = original_asins - processed_asins
        extra_asins = processed_asins - original_asins
        
        if missing_asins:
            error = f"缺失产品: {len(missing_asins)}个 ({','.join(list(missing_asins)[:5])}...)"
            errors.append(error)
        
        if extra_asins:
            warning = f"新增产品: {len(extra_asins)}个 ({','.join(list(extra_asins)[:5])}...)"
            warnings.append(warning)
        
        # 计算校验和对比
        original_checksum = self.calculate_data_checksum(original)
        processed_checksum = self.calculate_data_checksum(processed)
        
        # 注意：这里使用关键字段比较，不是完整数据
        different_checksum = original_checksum != processed_checksum
        
        stats = {
            'original_count': original_count,
            'processed_count': processed_count,
            'missing_count': len(missing_asins),
            'extra_count': len(extra_asins),
            'original_checksum': original_checksum[:8] + "...",
            'processed_checksum': processed_checksum[:8] + "...",
            'is_checksum_different': different_checksum
        }
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            stats=stats
        )

# 全局验证器实例
validator = DataIntegrityValidator()