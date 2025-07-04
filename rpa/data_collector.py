"""
Pipiads数据采集RPA模块
自动化执行SOP中的数据扫描和收集工作
"""

import time
import random
import pandas as pd
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import logging
from typing import List, Dict, Any, Optional
import json
import requests
from bs4 import BeautifulSoup

from config import *

class PipiadsCollector:
    """Pipiads数据采集器"""
    
    def __init__(self):
        self.driver = None
        self.wait = None
        self.logger = self._setup_logger()
        self.collected_data = []
        self.session_stats = {
            'start_time': None,
            'products_scanned': 0,
            'products_collected': 0,
            'errors_count': 0
        }
        
    def _setup_logger(self) -> logging.Logger:
        """设置日志记录器"""
        logger = logging.getLogger('PipiadsCollector')
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
        
    def _setup_driver(self) -> webdriver.Chrome:
        """设置浏览器驱动"""
        try:
            chrome_options = Options()
            
            # 基础配置
            if BROWSER_CONFIG['headless']:
                chrome_options.add_argument('--headless')
            chrome_options.add_argument(f'--window-size={BROWSER_CONFIG["window_width"]},{BROWSER_CONFIG["window_height"]}')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            
            # 反检测配置
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # 用户代理
            env_config = load_env_config()
            if env_config['user_agent']:
                chrome_options.add_argument(f'--user-agent={env_config["user_agent"]}')
            
            # 代理配置
            if env_config['proxy_url']:
                chrome_options.add_argument(f'--proxy-server={env_config["proxy_url"]}')
            
            # 下载目录
            prefs = {
                "download.default_directory": os.path.abspath(BROWSER_CONFIG['download_dir']),
                "download.prompt_for_download": False,
                "download.directory_upgrade": True,
                "safebrowsing.enabled": True
            }
            chrome_options.add_experimental_option("prefs", prefs)
            
            driver = webdriver.Chrome(options=chrome_options)
            driver.set_page_load_timeout(BROWSER_CONFIG['page_load_timeout'])
            driver.implicitly_wait(BROWSER_CONFIG['implicit_wait'])
            
            # 执行反检测脚本
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            return driver
            
        except Exception as e:
            self.logger.error(f"浏览器驱动设置失败: {e}")
            raise
    
    def start_session(self) -> bool:
        """启动采集会话"""
        try:
            self.logger.info("=== 开始Pipiads数据采集会话 ===")
            self.session_stats['start_time'] = datetime.now()
            
            # 设置浏览器
            self.driver = self._setup_driver()
            self.wait = WebDriverWait(self.driver, TIMEOUT_CONFIG['login_timeout'])
            
            # 验证配置
            validate_config()
            
            self.logger.info("采集会话启动成功")
            return True
            
        except Exception as e:
            self.logger.error(f"采集会话启动失败: {e}")
            return False
    
    def login(self) -> bool:
        """自动登录Pipiads"""
        try:
            self.logger.info("开始登录Pipiads...")
            
            # 访问登录页面
            self.driver.get(PIPIADS_CONFIG['login_url'])
            time.sleep(random.uniform(2, 4))
            
            # 获取环境配置
            env_config = load_env_config()
            if not env_config['pipiads_username'] or not env_config['pipiads_password']:
                raise ValueError("未设置Pipiads登录凭据")
            
            # 输入用户名
            username_field = self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, SELECTORS['login']['username_field']))
            )
            username_field.clear()
            username_field.send_keys(env_config['pipiads_username'])
            time.sleep(random.uniform(1, 2))
            
            # 输入密码
            password_field = self.driver.find_element(By.CSS_SELECTOR, SELECTORS['login']['password_field'])
            password_field.clear()
            password_field.send_keys(env_config['pipiads_password'])
            time.sleep(random.uniform(1, 2))
            
            # 点击登录按钮
            login_button = self.driver.find_element(By.CSS_SELECTOR, SELECTORS['login']['login_button'])
            login_button.click()
            
            # 等待登录完成
            self.wait.until(
                EC.url_changes(PIPIADS_CONFIG['login_url'])
            )
            
            # 验证登录成功
            current_url = self.driver.current_url
            if 'dashboard' in current_url or 'ad-search' in current_url:
                self.logger.info("登录成功")
                return True
            else:
                raise Exception(f"登录失败，当前URL: {current_url}")
                
        except Exception as e:
            self.logger.error(f"登录失败: {e}")
            self.session_stats['errors_count'] += 1
            return False
    
    def setup_search_filters(self) -> bool:
        """设置搜索筛选器"""
        try:
            self.logger.info("设置搜索筛选器...")
            
            # 访问搜索页面
            self.driver.get(PIPIADS_CONFIG['search_url'])
            time.sleep(random.uniform(2, 4))
            
            # 设置平台筛选
            try:
                platform_select = Select(self.driver.find_element(By.CSS_SELECTOR, SELECTORS['search']['platform_filter']))
                platform_select.select_by_visible_text(FILTER_CONFIG['platform'])
                time.sleep(1)
            except NoSuchElementException:
                self.logger.warning("平台筛选器未找到，跳过")
            
            # 设置类别筛选
            try:
                category_select = Select(self.driver.find_element(By.CSS_SELECTOR, SELECTORS['search']['category_filter']))
                category_select.select_by_visible_text(FILTER_CONFIG['category'])
                time.sleep(1)
            except NoSuchElementException:
                self.logger.warning("类别筛选器未找到，跳过")
            
            # 设置国家筛选
            try:
                for country in FILTER_CONFIG['target_countries']:
                    # 这里需要根据实际页面实现多选国家的逻辑
                    pass
            except Exception as e:
                self.logger.warning(f"国家筛选设置失败: {e}")
            
            # 设置日期范围
            try:
                date_select = Select(self.driver.find_element(By.CSS_SELECTOR, SELECTORS['search']['date_filter']))
                date_select.select_by_value(str(FILTER_CONFIG['date_range']))
                time.sleep(1)
            except NoSuchElementException:
                self.logger.warning("日期筛选器未找到，跳过")
            
            self.logger.info("搜索筛选器设置完成")
            return True
            
        except Exception as e:
            self.logger.error(f"搜索筛选器设置失败: {e}")
            self.session_stats['errors_count'] += 1
            return False
    
    def search_products(self, keywords: List[str]) -> bool:
        """搜索产品"""
        try:
            self.logger.info(f"搜索关键词: {keywords}")
            
            for keyword in keywords:
                self.logger.info(f"搜索关键词: {keyword}")
                
                # 输入搜索关键词
                search_input = self.driver.find_element(By.CSS_SELECTOR, SELECTORS['search']['search_input'])
                search_input.clear()
                search_input.send_keys(keyword)
                time.sleep(random.uniform(1, 2))
                
                # 点击搜索按钮
                search_button = self.driver.find_element(By.CSS_SELECTOR, SELECTORS['search']['search_button'])
                search_button.click()
                
                # 等待搜索结果加载
                self.wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, SELECTORS['results']['product_cards']))
                )
                time.sleep(random.uniform(3, 5))
                
                # 收集本次搜索的产品数据
                self._collect_current_page_data(keyword)
                
                # 随机延时，避免被检测
                time.sleep(random.uniform(2, 5))
            
            return True
            
        except Exception as e:
            self.logger.error(f"产品搜索失败: {e}")
            self.session_stats['errors_count'] += 1
            return False
    
    def _collect_current_page_data(self, keyword: str) -> None:
        """收集当前页面的产品数据"""
        try:
            # 获取所有产品卡片
            product_cards = self.driver.find_elements(By.CSS_SELECTOR, SELECTORS['results']['product_cards'])
            
            self.logger.info(f"发现 {len(product_cards)} 个产品")
            self.session_stats['products_scanned'] += len(product_cards)
            
            for i, card in enumerate(product_cards[:20]):  # 限制每页最多处理20个产品
                try:
                    product_data = self._extract_product_data(card, keyword)
                    
                    # 应用基础筛选
                    if self._passes_basic_filters(product_data):
                        self.collected_data.append(product_data)
                        self.session_stats['products_collected'] += 1
                        self.logger.info(f"收集产品: {product_data.get('product_name', 'Unknown')}")
                    
                except Exception as e:
                    self.logger.warning(f"处理第{i+1}个产品失败: {e}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"收集页面数据失败: {e}")
    
    def _extract_product_data(self, card, keyword: str) -> Dict[str, Any]:
        """从产品卡片提取数据"""
        data = {
            'collection_time': datetime.now().isoformat(),
            'search_keyword': keyword
        }
        
        try:
            # 产品名称
            try:
                name_element = card.find_element(By.CSS_SELECTOR, SELECTORS['results']['product_name'])
                data['product_name'] = name_element.text.strip()
            except NoSuchElementException:
                data['product_name'] = ''
            
            # 广告主
            try:
                advertiser_element = card.find_element(By.CSS_SELECTOR, SELECTORS['results']['advertiser'])
                data['advertiser'] = advertiser_element.text.strip()
            except NoSuchElementException:
                data['advertiser'] = ''
            
            # 展示量
            try:
                impressions_element = card.find_element(By.CSS_SELECTOR, SELECTORS['results']['impressions'])
                impressions_text = impressions_element.text.strip()
                data['impressions'] = self._parse_number(impressions_text)
            except NoSuchElementException:
                data['impressions'] = 0
            
            # 点赞数
            try:
                likes_element = card.find_element(By.CSS_SELECTOR, SELECTORS['results']['likes'])
                likes_text = likes_element.text.strip()
                data['likes'] = self._parse_number(likes_text)
            except NoSuchElementException:
                data['likes'] = 0
            
            # 评论数
            try:
                comments_element = card.find_element(By.CSS_SELECTOR, SELECTORS['results']['comments'])
                comments_text = comments_element.text.strip()
                data['comments'] = self._parse_number(comments_text)
            except NoSuchElementException:
                data['comments'] = 0
            
            # 价格
            try:
                price_element = card.find_element(By.CSS_SELECTOR, SELECTORS['results']['price'])
                price_text = price_element.text.strip()
                data['price'] = self._parse_price(price_text)
            except NoSuchElementException:
                data['price'] = 0
            
            # 首次发现日期
            try:
                first_seen_element = card.find_element(By.CSS_SELECTOR, SELECTORS['results']['first_seen'])
                first_seen_text = first_seen_element.text.strip()
                data['first_seen_date'] = self._parse_date(first_seen_text)
            except NoSuchElementException:
                data['first_seen_date'] = ''
            
            # 计算衍生指标
            if data['impressions'] > 0:
                data['like_rate'] = (data['likes'] / data['impressions']) * 100
                data['engagement_rate'] = ((data['likes'] + data['comments']) / data['impressions']) * 100
            else:
                data['like_rate'] = 0
                data['engagement_rate'] = 0
            
            # 计算运行天数
            if data['first_seen_date']:
                try:
                    first_seen = datetime.fromisoformat(data['first_seen_date'])
                    data['running_days'] = (datetime.now() - first_seen).days
                except:
                    data['running_days'] = 0
            else:
                data['running_days'] = 0
            
            # 获取产品链接
            try:
                link_element = card.find_element(By.TAG_NAME, 'a')
                data['product_url'] = link_element.get_attribute('href')
            except NoSuchElementException:
                data['product_url'] = ''
            
            return data
            
        except Exception as e:
            self.logger.error(f"提取产品数据失败: {e}")
            return data
    
    def _parse_number(self, text: str) -> int:
        """解析数字文本（支持K、M等单位）"""
        try:
            # 移除非数字字符（除了.和单位）
            text = text.replace(',', '').strip()
            
            if 'K' in text.upper():
                return int(float(text.upper().replace('K', '')) * 1000)
            elif 'M' in text.upper():
                return int(float(text.upper().replace('M', '')) * 1000000)
            else:
                return int(float(text))
        except:
            return 0
    
    def _parse_price(self, text: str) -> float:
        """解析价格文本"""
        try:
            # 提取数字
            import re
            price_match = re.search(r'[\d.]+', text.replace(',', ''))
            if price_match:
                return float(price_match.group())
            return 0.0
        except:
            return 0.0
    
    def _parse_date(self, text: str) -> str:
        """解析日期文本"""
        try:
            # 这里需要根据Pipiads的实际日期格式进行解析
            # 示例处理逻辑
            if 'day' in text:
                days_ago = int(text.split()[0])
                date = datetime.now() - timedelta(days=days_ago)
                return date.isoformat()
            return text
        except:
            return ''
    
    def _passes_basic_filters(self, data: Dict[str, Any]) -> bool:
        """检查产品是否通过基础筛选"""
        try:
            # 硬性标准检查
            if data['impressions'] < HARD_CRITERIA['min_impressions']:
                return False
            
            if data['likes'] < HARD_CRITERIA['min_likes']:
                return False
            
            if data['like_rate'] < HARD_CRITERIA['min_like_rate']:
                return False
            
            if data['running_days'] < HARD_CRITERIA['min_running_days']:
                return False
            
            if data['comments'] < HARD_CRITERIA['min_comments']:
                return False
            
            # 价格范围检查
            price = data.get('price', 0)
            if price < FILTER_CONFIG['price_range']['min'] or price > FILTER_CONFIG['price_range']['max']:
                return False
            
            # 排除标准检查
            product_name = data.get('product_name', '').lower()
            for keyword in EXCLUSION_CRITERIA['medical_claims_keywords']:
                if keyword.lower() in product_name:
                    return False
            
            for keyword in EXCLUSION_CRITERIA['copyright_keywords']:
                if keyword.lower() in product_name:
                    return False
            
            return True
            
        except Exception as e:
            self.logger.warning(f"筛选检查失败: {e}")
            return False
    
    def monitor_competitors(self, competitor_products: List[str]) -> Dict[str, Any]:
        """监控竞品动态"""
        try:
            self.logger.info("开始竞品监控...")
            
            competitor_data = {}
            
            for product in competitor_products:
                self.logger.info(f"监控产品: {product}")
                
                # 搜索特定产品
                search_input = self.driver.find_element(By.CSS_SELECTOR, SELECTORS['search']['search_input'])
                search_input.clear()
                search_input.send_keys(product)
                
                search_button = self.driver.find_element(By.CSS_SELECTOR, SELECTORS['search']['search_button'])
                search_button.click()
                
                time.sleep(random.uniform(3, 5))
                
                # 收集竞品数据
                current_data = self._collect_competitor_data(product)
                competitor_data[product] = current_data
                
                time.sleep(random.uniform(2, 4))
            
            return competitor_data
            
        except Exception as e:
            self.logger.error(f"竞品监控失败: {e}")
            return {}
    
    def _collect_competitor_data(self, product_name: str) -> Dict[str, Any]:
        """收集单个竞品的详细数据"""
        try:
            # 获取第一个匹配的产品
            product_cards = self.driver.find_elements(By.CSS_SELECTOR, SELECTORS['results']['product_cards'])
            
            if not product_cards:
                return {}
            
            # 提取第一个产品的数据
            data = self._extract_product_data(product_cards[0], product_name)
            
            # 添加竞品监控特定的字段
            data['monitor_timestamp'] = datetime.now().isoformat()
            data['competitor_product'] = True
            
            return data
            
        except Exception as e:
            self.logger.error(f"收集竞品数据失败: {e}")
            return {}
    
    def save_data(self) -> bool:
        """保存收集的数据"""
        try:
            if not self.collected_data:
                self.logger.warning("没有数据需要保存")
                return False
            
            # 转换为DataFrame
            df = pd.DataFrame(self.collected_data)
            
            # 保存为CSV
            csv_file = get_output_path(PATHS['daily_scan_file'])
            df.to_csv(csv_file, index=False, encoding='utf-8')
            self.logger.info(f"数据已保存到: {csv_file}")
            
            # 更新Excel数据库
            self._update_excel_database(df)
            
            return True
            
        except Exception as e:
            self.logger.error(f"保存数据失败: {e}")
            return False
    
    def _update_excel_database(self, df: pd.DataFrame) -> None:
        """更新Excel数据库"""
        try:
            excel_file = PATHS['excel_database']
            
            if os.path.exists(excel_file):
                # 读取现有数据
                with pd.ExcelWriter(excel_file, mode='a', if_sheet_exists='overlay') as writer:
                    df.to_excel(writer, sheet_name=EXCEL_SHEETS['daily_scan'], 
                               startrow=writer.sheets[EXCEL_SHEETS['daily_scan']].max_row, 
                               index=False, header=False)
            else:
                # 创建新文件
                with pd.ExcelWriter(excel_file) as writer:
                    df.to_excel(writer, sheet_name=EXCEL_SHEETS['daily_scan'], index=False)
            
            self.logger.info("Excel数据库已更新")
            
        except Exception as e:
            self.logger.error(f"更新Excel数据库失败: {e}")
    
    def generate_session_summary(self) -> Dict[str, Any]:
        """生成会话总结"""
        end_time = datetime.now()
        duration = end_time - self.session_stats['start_time']
        
        summary = {
            'session_duration': str(duration),
            'products_scanned': self.session_stats['products_scanned'],
            'products_collected': self.session_stats['products_collected'],
            'collection_rate': (self.session_stats['products_collected'] / 
                              max(self.session_stats['products_scanned'], 1)) * 100,
            'errors_count': self.session_stats['errors_count'],
            'high_potential_products': len([p for p in self.collected_data 
                                          if p.get('like_rate', 0) > IDEAL_CRITERIA['ideal_like_rate']]),
            'average_like_rate': sum(p.get('like_rate', 0) for p in self.collected_data) / 
                               max(len(self.collected_data), 1)
        }
        
        return summary
    
    def close_session(self) -> None:
        """关闭采集会话"""
        try:
            # 生成会话总结
            summary = self.generate_session_summary()
            self.logger.info(f"会话总结: {summary}")
            
            # 保存数据
            self.save_data()
            
            # 关闭浏览器
            if self.driver:
                self.driver.quit()
            
            self.logger.info("=== 采集会话已结束 ===")
            
        except Exception as e:
            self.logger.error(f"关闭会话失败: {e}")

# 使用示例
if __name__ == "__main__":
    collector = PipiadsCollector()
    
    try:
        # 启动会话
        if not collector.start_session():
            exit(1)
        
        # 登录
        if not collector.login():
            exit(1)
        
        # 设置筛选器
        if not collector.setup_search_filters():
            exit(1)
        
        # 获取今日关键词并搜索
        today_keywords = get_today_keywords()
        if not collector.search_products(today_keywords):
            exit(1)
        
        # 监控竞品（示例）
        competitor_products = ["LED面膜", "维C精华", "胶原蛋白"]
        competitor_data = collector.monitor_competitors(competitor_products)
        
        print("数据采集完成！")
        
    except KeyboardInterrupt:
        print("用户中断执行")
    except Exception as e:
        print(f"执行失败: {e}")
    finally:
        collector.close_session()