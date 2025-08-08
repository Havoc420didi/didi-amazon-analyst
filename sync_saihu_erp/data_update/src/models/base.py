"""
基础模型类
"""
from datetime import datetime
from typing import Dict, Any, Optional
import json
from sqlalchemy.ext.declarative import declarative_base

# SQLAlchemy基础类
Base = declarative_base()

class BaseModel:
    """基础数据模型类"""
    
    def __init__(self, **kwargs):
        """初始化模型实例"""
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    def to_dict(self) -> Dict[str, Any]:
        """将模型转换为字典"""
        result = {}
        for key, value in self.__dict__.items():
            if key.startswith('_'):
                continue
            
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif hasattr(value, 'to_dict'):
                result[key] = value.to_dict()
            else:
                result[key] = value
        
        return result
    
    def to_json(self) -> str:
        """将模型转换为JSON字符串"""
        return json.dumps(self.to_dict(), default=str, ensure_ascii=False)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        """从字典创建模型实例"""
        return cls(**data)
    
    @classmethod
    def from_json(cls, json_str: str):
        """从JSON字符串创建模型实例"""
        return cls.from_dict(json.loads(json_str))
    
    def update_from_dict(self, data: Dict[str, Any]) -> None:
        """从字典更新模型属性"""
        for key, value in data.items():
            if hasattr(self, key):
                setattr(self, key, value)
    
    def get_insert_sql(self, table_name: str) -> tuple:
        """生成插入SQL语句和参数"""
        data = self.to_dict()
        
        # 过滤掉None值和特殊字段
        filtered_data = {k: v for k, v in data.items() 
                        if v is not None and not k.startswith('_')}
        
        if not filtered_data:
            raise ValueError("没有有效的数据可以插入")
        
        columns = list(filtered_data.keys())
        placeholders = ['%s'] * len(columns)
        values = list(filtered_data.values())
        
        sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
        
        return sql, tuple(values)
    
    def get_update_sql(self, table_name: str, where_conditions: Dict[str, Any]) -> tuple:
        """生成更新SQL语句和参数"""
        data = self.to_dict()
        
        # 过滤掉None值和特殊字段
        update_data = {k: v for k, v in data.items() 
                      if v is not None and not k.startswith('_') 
                      and k not in where_conditions}
        
        if not update_data:
            raise ValueError("没有有效的数据可以更新")
        
        # 构建UPDATE部分
        update_clauses = [f"{k} = %s" for k in update_data.keys()]
        update_values = list(update_data.values())
        
        # 构建WHERE部分
        where_clauses = [f"{k} = %s" for k in where_conditions.keys()]
        where_values = list(where_conditions.values())
        
        sql = (f"UPDATE {table_name} SET {', '.join(update_clauses)} "
               f"WHERE {' AND '.join(where_clauses)}")
        
        return sql, tuple(update_values + where_values)
    
    def __str__(self) -> str:
        """字符串表示"""
        return f"{self.__class__.__name__}({self.to_dict()})"
    
    def __repr__(self) -> str:
        """对象表示"""
        return self.__str__()