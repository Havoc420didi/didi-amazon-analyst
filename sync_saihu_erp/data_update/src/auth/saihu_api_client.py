"""
赛狐ERP API客户端
处理需要签名的API请求
"""
import json
import requests
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from .oauth_client import oauth_client
from .api_signer import api_signer
from ..config.settings import settings

logger = logging.getLogger(__name__)

class SaihuApiClient:
    """赛狐ERP API客户端"""
    
    def __init__(self):
        """初始化API客户端"""
        self.base_url = settings.get('api.base_url', 'https://openapi.sellfox.com')
        self.oauth_client = oauth_client
        self.api_signer = api_signer
        self.session = requests.Session()
        
        # 设置默认请求头
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SaihuERP-DataSync/1.0'
        })
        
        logger.info("赛狐ERP API客户端初始化完成")
    
    def make_signed_request(self,
                          endpoint: str,
                          method: str = 'POST',
                          body_data: Optional[Dict[str, Any]] = None,
                          timeout: int = 60) -> Optional[requests.Response]:
        """
        发起带签名的API请求
        
        Args:
            endpoint: API端点路径
            method: HTTP方法（赛狐ERP使用POST请求）
            body_data: 请求体数据
            timeout: 超时时间
            
        Returns:
            Response对象，失败返回None
        """
        try:
            # 获取访问令牌
            access_token = self.oauth_client.get_access_token()
            if not access_token:
                logger.error("无法获取访问令牌")
                return None
            
            # 打印获取到的token
            print(f"🔑 获取到的访问令牌: {access_token}")
            
            # 生成签名参数（传入URL路径）
            sign_params = self.api_signer.generate_sign_params(
                access_token=access_token,
                url=endpoint,
                method='post'
            )
            
            # 构建完整URL
            url = f"{self.base_url}{endpoint}"
            
            logger.info(f"发起签名API请求: {method} {url}")
            print(f"🔗 请求URL: {url}")
            print(f"📝 签名参数: {sign_params}")
            print(f"📦 请求体数据: {json.dumps(body_data, ensure_ascii=False, indent=2) if body_data else 'None'}")
            logger.debug(f"签名参数: {sign_params}")
            logger.debug(f"请求体数据: {body_data}")
            
            # 发起POST请求
            response = self.session.post(
                url=url,
                params=sign_params,  # 签名参数作为查询参数
                json=body_data,      # 请求体数据作为JSON
                timeout=timeout
            )
            
            logger.debug(f"API响应: {response.status_code}")
            
            # 打印响应信息
            print(f"📊 响应状态码: {response.status_code}")
            if response.text:
                try:
                    response_data = response.json()
                    print(f"📋 响应内容: {json.dumps(response_data, ensure_ascii=False, indent=2)}")
                except:
                    print(f"📋 响应内容: {response.text}")
            
            # 检查响应状态
            if response.status_code == 200:
                return response
            else:
                logger.error(f"API请求失败: {response.status_code} - {response.text}")
                return response  # 返回响应以便调用者分析错误
                
        except requests.exceptions.RequestException as e:
            logger.error(f"API请求异常: {e}")
            return None
        except Exception as e:
            logger.error(f"签名API请求失败: {e}")
            return None
    
    def fetch_product_analytics(self,
                              start_date: str,
                              end_date: str,
                              page_no: int = 1,
                              page_size: int = 100,
                              currency: str = "USD",
                              **kwargs) -> Optional[Dict[str, Any]]:
        """
        获取产品分析数据 - 严格按照官方文档
        
        Args:
            start_date: 开始日期 (yyyy-MM-dd)
            end_date: 结束日期 (yyyy-MM-dd)
            page_no: 页码
            page_size: 每页大小
            currency: 货币类型
            **kwargs: 其他查询参数
            
        Returns:
            产品分析数据，失败返回None
        """
        # 严格按照官方文档构建请求体 - 只包含必需参数
        body_data = {
            'startDate': start_date,
            'endDate': end_date,
            'pageNo': str(page_no),
            'pageSize': str(page_size),
            'currency': currency
        }
        
        # 添加官方文档中的可选数组参数
        array_params = [
            'marketplaceIdList', 'shopIdList', 'devIdList', 'operatorIdList',
            'labelIdList', 'brandIdList', 'onlineStatusList', 'adTypeList', 
            'searchContentList'
        ]
        
        for param in array_params:
            if param in kwargs and kwargs[param] is not None:
                if isinstance(kwargs[param], list):
                    body_data[param] = kwargs[param]
                else:
                    body_data[param] = [str(kwargs[param])]
        
        # 添加官方文档中的可选字符串参数
        string_params = [
            'tagId', 'searchType', 'searchMode', 'asinType', 'mergeAsin', 'fullCid', 
            'labelQuery', 'isNewOrMovingOrInStock', 'compareType', 'preStartDate', 
            'preEndDate', 'lowCostStore', 'openDateStart', 'openDateEnd', 'orderBy', 'desc'
        ]
        
        for param in string_params:
            if param in kwargs and kwargs[param] is not None:
                body_data[param] = str(kwargs[param])
        
        try:
            response = self.make_signed_request(
                endpoint='/api/productAnalyze/new/pageList.json',
                method='POST',
                body_data=body_data
            )
            
            if response and response.status_code == 200:
                data = response.json()
                if data.get('code') == 0:
                    logger.info(f"获取产品分析数据成功: {start_date} 到 {end_date}")
                    return data.get('data', {})
                else:
                    logger.error(f"产品分析API返回错误: {data.get('code')} - {data.get('msg')}")
                    return None
            elif response and response.status_code == 400:
                data = response.json()
                if data.get('code') == 40019:  # 调用超过限制
                    logger.warning(f"API调用频率限制，等待5秒后重试...")
                    import time
                    time.sleep(5)
                    return None  # 调用者可以重试
                else:
                    logger.error(f"产品分析API请求失败: {response.status_code} - {response.text}")
                    return None
            else:
                logger.error(f"产品分析API请求失败: {response.status_code if response else 'None'}")
                return None
                
        except Exception as e:
            logger.error(f"获取产品分析数据异常: {e}")
            return None
    
    def fetch_fba_inventory(self,
                          page_no: int = 1,
                          page_size: int = 100,
                          hide_zero: bool = True,
                          currency: str = "USD",
                          hide_deleted_prd: bool = True,
                          need_merge_share: bool = False,
                          **kwargs) -> Optional[Dict[str, Any]]:
        """
        获取FBA库存数据
        
        Args:
            page_no: 页码
            page_size: 每页大小
            hide_zero: 是否隐藏总库存为0的数据
            currency: 货币类型
            hide_deleted_prd: 是否隐藏已删除产品
            need_merge_share: 是否需要合并共享
            **kwargs: 其他查询参数
            
        Returns:
            FBA库存数据，失败返回None
        """
        # 严格按照官方文档构建请求体
        body_data = {
            'pageNo': str(page_no),
            'pageSize': str(page_size), 
            'currency': currency,
            'hideZero': str(hide_zero).lower(),
            'hideDeletedPrd': str(hide_deleted_prd).lower(),
            'needMergeShare': str(need_merge_share).lower()
        }
        
        # 只添加官方文档中明确定义的可选参数
        # 字符串类型参数
        if 'productDevIds' in kwargs and kwargs['productDevIds'] is not None:
            body_data['productDevIds'] = str(kwargs['productDevIds'])
        
        if 'commodityDevIds' in kwargs and kwargs['commodityDevIds'] is not None:
            body_data['commodityDevIds'] = str(kwargs['commodityDevIds']) 
        
        # 数组类型参数（官方文档中的array[string]）
        array_params = ['skus', 'asins', 'commodityIds', 'productIds', 'shopIdList']
        for param in array_params:
            if param in kwargs and kwargs[param] is not None:
                if isinstance(kwargs[param], list):
                    body_data[param] = kwargs[param]
                else:
                    body_data[param] = [str(kwargs[param])]
        
        try:
            response = self.make_signed_request(
                endpoint='/api/inventoryManage/fba/pageList.json',
                method='POST',
                body_data=body_data
            )
            
            if response and response.status_code == 200:
                data = response.json()
                if data.get('code') == 0:
                    logger.info(f"获取FBA库存数据成功")
                    return data.get('data', {})
                else:
                    logger.error(f"FBA库存API返回错误: {data.get('code')} - {data.get('msg')}")
                    return None
            else:
                logger.error(f"FBA库存API请求失败: {response.status_code if response else 'None'}")
                return None
                
        except Exception as e:
            logger.error(f"获取FBA库存数据异常: {e}")
            return None
    
    def fetch_warehouse_inventory(self,
                                page_no: int = 1,
                                page_size: int = 100,
                                warehouse_id: str = None,
                                is_hidden: bool = True,
                                commodity_skus: list = None,
                                fn_sku_list: list = None,
                                create_time_start: str = None,
                                create_time_end: str = None,
                                modified_time_start: str = None,
                                modified_time_end: str = None,
                                **kwargs) -> Optional[Dict[str, Any]]:
        """
        获取库存明细数据
        
        Args:
            page_no: 页码
            page_size: 每页大小
            warehouse_id: 仓库ID
            is_hidden: 是否隐藏库存为0的数据
            commodity_skus: 商品SKU列表
            fn_sku_list: FN SKU列表
            create_time_start: 创建时间开始 (格式: 2022-01-01 00:00:00)
            create_time_end: 创建时间结束 (格式: 2022-01-01 23:59:59)
            modified_time_start: 修改时间开始 (格式: 2022-01-01 00:00:00)
            modified_time_end: 修改时间结束 (格式: 2022-01-01 23:59:59)
            **kwargs: 其他查询参数
            
        Returns:
            库存明细数据，失败返回None
        """
        # 严格按照官方文档构建请求体
        body_data = {
            'pageNo': str(page_no),
            'pageSize': str(page_size),
            'isHidden': str(is_hidden).lower()
        }
        
        # 可选参数 - 字符串类型
        if warehouse_id is not None:
            body_data['warehouseId'] = str(warehouse_id)
        
        # 可选参数 - 数组类型
        if commodity_skus is not None:
            if isinstance(commodity_skus, list):
                body_data['commoditySkus'] = commodity_skus
            else:
                body_data['commoditySkus'] = [str(commodity_skus)]
        
        if fn_sku_list is not None:
            if isinstance(fn_sku_list, list):
                body_data['fnSkuList'] = fn_sku_list
            else:
                body_data['fnSkuList'] = [str(fn_sku_list)]
        
        # 可选参数 - 时间类型
        if create_time_start is not None:
            body_data['createTimeStart'] = str(create_time_start)
        
        if create_time_end is not None:
            body_data['createTimeEnd'] = str(create_time_end)
        
        if modified_time_start is not None:
            body_data['modifiedTimeStart'] = str(modified_time_start)
        
        if modified_time_end is not None:
            body_data['modifiedTimeEnd'] = str(modified_time_end)
        
        # 添加其他参数（保持向后兼容）
        for key, value in kwargs.items():
            if key not in body_data:
                body_data[key] = value
        
        try:
            response = self.make_signed_request(
                endpoint='/api/warehouseManage/warehouseItemList.json',
                method='POST',
                body_data=body_data
            )
            
            if response and response.status_code == 200:
                data = response.json()
                if data.get('code') == 0:
                    logger.info(f"获取库存明细数据成功")
                    return data.get('data', {})
                else:
                    logger.error(f"库存明细API返回错误: {data.get('code')} - {data.get('msg')}")
                    return None
            else:
                logger.error(f"库存明细API请求失败: {response.status_code if response else 'None'}")
                return None
                
        except Exception as e:
            logger.error(f"获取库存明细数据异常: {e}")
            return None
    
    def fetch_all_pages(self, 
                       fetch_func,
                       max_pages: Optional[int] = None,
                       delay_seconds: float = 2.0,
                       **kwargs) -> list:
        """
        获取所有分页数据 - 添加延迟避免API调用频率限制
        
        Args:
            fetch_func: 数据获取函数
            max_pages: 最大页数限制
            delay_seconds: 每页之间的延迟时间（秒）
            **kwargs: 传递给fetch_func的参数
            
        Returns:
            所有数据的列表
        """
        import time
        all_data = []
        page_no = 1
        
        while True:
            try:
                # 添加延迟避免API调用频率限制（除了第一页）
                if page_no > 1:
                    logger.info(f"等待 {delay_seconds} 秒后继续抓取...")
                    time.sleep(delay_seconds)
                
                # 获取当前页数据
                result = fetch_func(page_no=page_no, **kwargs)
                
                if not result:
                    logger.warning(f"第 {page_no} 页数据获取失败")
                    break
                
                # 提取数据行
                rows = result.get('rows', [])
                if not rows:
                    logger.info(f"第 {page_no} 页无数据，抓取完成")
                    break
                
                all_data.extend(rows)
                
                # 检查是否还有更多页
                total_page = result.get('totalPage', 0)
                if page_no >= total_page:
                    logger.info(f"已抓取完所有 {total_page} 页数据")
                    break
                
                # 检查最大页数限制
                if max_pages and page_no >= max_pages:
                    logger.warning(f"已达到最大页数限制: {max_pages}")
                    break
                
                page_no += 1
                logger.info(f"已获取 {len(all_data)} 条数据，继续获取第 {page_no} 页")
                
            except Exception as e:
                logger.error(f"获取第 {page_no} 页数据异常: {e}")
                # 如果是频率限制错误，等待更长时间后重试
                if "调用超过限制" in str(e) or "40019" in str(e):
                    logger.warning(f"遇到API频率限制，等待10秒后重试...")
                    time.sleep(10)
                    continue
                break
        
        logger.info(f"分页抓取完成，共获取 {len(all_data)} 条数据")
        return all_data

# 全局API客户端实例
saihu_api_client = SaihuApiClient()