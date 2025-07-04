# Pipiads RPA系统部署和维护指南

## 📋 目录
1. [系统概览](#系统概览)
2. [环境准备](#环境准备)
3. [安装部署](#安装部署)
4. [配置管理](#配置管理)
5. [运行监控](#运行监控)
6. [故障排除](#故障排除)
7. [性能优化](#性能优化)
8. [安全管理](#安全管理)
9. [备份恢复](#备份恢复)
10. [升级维护](#升级维护)

---

## 系统概览

### 架构组件
Pipiads RPA系统由以下核心模块组成：

- **数据采集模块** (`data_collector.py`) - 自动化Pipiads数据抓取
- **数据处理模块** (`data_processor.py`) - 数据清洗、分析和分级
- **报告生成模块** (`report_generator.py`) - 自动生成报告和可视化
- **人机协作模块** (`human_collaboration.py`) - 管理人工审核流程
- **配置管理** (`config.py`) - 系统配置和参数管理

### 技术栈
- **编程语言：** Python 3.8+
- **Web自动化：** Selenium WebDriver
- **数据处理：** pandas, numpy, scipy
- **可视化：** matplotlib, seaborn
- **数据库：** SQLite
- **任务调度：** APScheduler
- **日志管理：** Python logging

### 系统要求
- **操作系统：** Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **内存：** 8GB+ RAM
- **存储：** 50GB+ 可用空间
- **网络：** 稳定的互联网连接
- **浏览器：** Chrome 90+ (自动下载ChromeDriver)

---

## 环境准备

### 1. Python环境安装

#### Windows
```bash
# 下载并安装Python 3.8+
# https://www.python.org/downloads/

# 验证安装
python --version
pip --version
```

#### macOS
```bash
# 使用Homebrew安装
brew install python@3.9

# 或使用pyenv
pyenv install 3.9.16
pyenv global 3.9.16
```

#### Ubuntu
```bash
sudo apt update
sudo apt install python3.9 python3.9-pip python3.9-venv
```

### 2. 创建虚拟环境
```bash
# 创建虚拟环境
python -m venv pipiads_rpa_env

# 激活虚拟环境
# Windows
pipiads_rpa_env\Scripts\activate

# macOS/Linux
source pipiads_rpa_env/bin/activate
```

### 3. 安装依赖包
```bash
pip install -r requirements.txt
```

#### requirements.txt
```text
selenium==4.15.0
pandas==2.0.3
numpy==1.24.3
matplotlib==3.7.2
seaborn==0.12.2
scipy==1.11.2
beautifulsoup4==4.12.2
requests==2.31.0
APScheduler==3.10.4
openpyxl==3.1.2
lxml==4.9.3
Pillow==10.0.0
```

### 4. 系统依赖安装

#### Chrome浏览器
```bash
# Windows: 访问 https://www.google.com/chrome/ 下载安装

# macOS
brew install --cask google-chrome

# Ubuntu
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo apt update
sudo apt install google-chrome-stable
```

#### 可选：代理工具
如果需要使用代理，安装相应的代理客户端。

---

## 安装部署

### 1. 项目部署

#### 下载项目代码
```bash
# 克隆或下载项目代码到指定目录
cd /opt/pipiads_rpa  # Linux/macOS
cd C:\pipiads_rpa    # Windows

# 复制所有RPA模块文件
# - config.py
# - data_collector.py
# - data_processor.py
# - report_generator.py
# - human_collaboration.py
# - main.py (主启动脚本)
```

#### 创建目录结构
```bash
mkdir -p outputs/charts
mkdir -p logs
mkdir -p downloads
mkdir -p backups
```

### 2. 环境变量配置

创建 `.env` 文件：
```bash
# Pipiads账户配置
PIPIADS_USERNAME=your_username
PIPIADS_PASSWORD=your_password

# 代理配置（可选）
PROXY_URL=http://proxy.example.com:8080

# 用户代理
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36

# 通知配置（可选）
NOTIFICATION_EMAIL=admin@company.com
SLACK_WEBHOOK=https://hooks.slack.com/services/xxx
```

### 3. 配置文件验证
```bash
python -c "from config import validate_config; validate_config()"
```

### 4. 初始化测试
```bash
# 测试数据采集模块
python data_collector.py

# 测试数据处理模块
python data_processor.py

# 测试报告生成模块
python report_generator.py
```

---

## 配置管理

### 1. 基础配置调整

#### 修改 `config.py` 中的关键参数：

```python
# 调整筛选条件
HARD_CRITERIA = {
    'min_impressions': 1000,      # 根据需要调整最低展示量
    'min_likes': 200,            # 调整最低点赞数
    'min_like_rate': 2.5,        # 调整最低点赞率
    'min_running_days': 10,      # 调整最低运行天数
    'min_comments': 30           # 调整最低评论数
}

# 调整价格范围
FILTER_CONFIG['price_range'] = {
    'min': 5,    # 最低价格
    'max': 200   # 最高价格
}

# 调整采集频率
SCHEDULE_CONFIG = {
    'daily_scan_time': '09:00',           # 每日扫描时间
    'competitor_monitor_time': '13:00',   # 竞品监控时间
    'daily_report_time': '18:00'         # 每日报告时间
}
```

### 2. 浏览器配置优化

```python
# 针对不同环境优化浏览器配置
BROWSER_CONFIG = {
    'headless': True,              # 生产环境建议设为True
    'window_width': 1920,
    'window_height': 1080,
    'page_load_timeout': 60,       # 增加超时时间
    'implicit_wait': 15,
    'download_dir': './downloads'
}
```

### 3. 数据质量配置

```python
# 调整异常检测敏感度
ANOMALY_DETECTION = {
    'z_score_threshold': 2.5,    # 降低阈值增加敏感度
    'iqr_multiplier': 1.2,       # 调整IQR倍数
    'enable_outlier_removal': True
}

# 调整预警阈值
ALERT_THRESHOLDS = {
    'high_potential_impressions': 15000,   # 高潜力产品展示量阈值
    'high_potential_like_rate': 3.5,      # 高潜力产品点赞率阈值
    'data_quality_threshold': 0.90        # 数据质量阈值
}
```

---

## 运行监控

### 1. 创建主启动脚本

创建 `main.py`：
```python
#!/usr/bin/env python
"""
Pipiads RPA系统主启动脚本
"""

import schedule
import time
import logging
from datetime import datetime
from data_collector import PipiadsCollector
from data_processor import DataProcessor
from report_generator import ReportGenerator
from human_collaboration import HumanCollaborationManager
from config import *

class PipiadsRPASystem:
    def __init__(self):
        self.logger = self._setup_logger()
        self.collector = PipiadsCollector()
        self.processor = DataProcessor()
        self.reporter = ReportGenerator()
        self.collaboration = HumanCollaborationManager()
        
    def _setup_logger(self):
        logger = logging.getLogger('PipiadsRPA')
        logger.setLevel(logging.INFO)
        
        handler = logging.FileHandler(
            get_output_path(PATHS['activity_log']), 
            encoding='utf-8'
        )
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
        return logger
    
    def daily_workflow(self):
        """每日工作流程"""
        try:
            self.logger.info("=== 开始每日工作流程 ===")
            
            # 1. 数据采集
            if not self.collector.start_session():
                raise Exception("采集会话启动失败")
            
            if not self.collector.login():
                raise Exception("登录失败")
            
            if not self.collector.setup_search_filters():
                raise Exception("筛选器设置失败")
            
            today_keywords = get_today_keywords()
            if not self.collector.search_products(today_keywords):
                raise Exception("产品搜索失败")
            
            # 保存采集数据
            if not self.collector.save_data():
                raise Exception("数据保存失败")
            
            data_file = get_output_path(PATHS['daily_scan_file'])
            
            # 2. 数据处理
            analysis_results = self.processor.process_data(data_file)
            if not analysis_results:
                raise Exception("数据处理失败")
            
            # 3. 生成报告
            report_files = self.reporter.generate_full_report(
                self.processor.processed_data, 
                analysis_results, 
                self.processor.alerts
            )
            
            # 4. 检查人工审核队列
            self.collaboration.run_maintenance_tasks()
            
            self.logger.info("=== 每日工作流程完成 ===")
            
        except Exception as e:
            self.logger.error(f"每日工作流程失败: {e}")
        finally:
            self.collector.close_session()
    
    def competitor_monitoring(self):
        """竞品监控"""
        try:
            self.logger.info("开始竞品监控...")
            # 实现竞品监控逻辑
            
        except Exception as e:
            self.logger.error(f"竞品监控失败: {e}")
    
    def start_scheduler(self):
        """启动任务调度器"""
        # 安排每日任务
        schedule.every().day.at(SCHEDULE_CONFIG['daily_scan_time']).do(self.daily_workflow)
        schedule.every().day.at(SCHEDULE_CONFIG['competitor_monitor_time']).do(self.competitor_monitoring)
        
        # 安排维护任务
        schedule.every().hour.do(self.collaboration.check_overdue_items)
        schedule.every().day.at("23:00").do(self.collaboration.run_maintenance_tasks)
        
        self.logger.info("任务调度器已启动")
        
        while True:
            schedule.run_pending()
            time.sleep(60)  # 每分钟检查一次

if __name__ == "__main__":
    rpa_system = PipiadsRPASystem()
    rpa_system.start_scheduler()
```

### 2. 创建服务脚本

#### Linux服务 (systemd)
创建 `/etc/systemd/system/pipiads-rpa.service`：
```ini
[Unit]
Description=Pipiads RPA System
After=network.target

[Service]
Type=simple
User=rpa_user
WorkingDirectory=/opt/pipiads_rpa
Environment=PATH=/opt/pipiads_rpa/pipiads_rpa_env/bin
ExecStart=/opt/pipiads_rpa/pipiads_rpa_env/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable pipiads-rpa
sudo systemctl start pipiads-rpa
sudo systemctl status pipiads-rpa
```

#### Windows服务
使用 `python-windows-service` 包：
```bash
pip install pywin32
python setup_service.py install
python setup_service.py start
```

### 3. 监控脚本

创建 `monitor.py`：
```python
#!/usr/bin/env python
"""
RPA系统监控脚本
"""

import os
import psutil
import json
from datetime import datetime
from pathlib import Path

def check_system_health():
    """检查系统健康状态"""
    health_status = {
        'timestamp': datetime.now().isoformat(),
        'cpu_usage': psutil.cpu_percent(interval=1),
        'memory_usage': psutil.virtual_memory().percent,
        'disk_usage': psutil.disk_usage('/').percent,
        'processes': []
    }
    
    # 检查RPA进程
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if 'main.py' in ' '.join(proc.info['cmdline']):
                health_status['processes'].append({
                    'pid': proc.info['pid'],
                    'name': proc.info['name'],
                    'status': proc.status(),
                    'cpu_percent': proc.cpu_percent(),
                    'memory_percent': proc.memory_percent()
                })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    # 检查日志文件
    log_file = Path('logs/activity_' + datetime.now().strftime('%Y%m%d') + '.log')
    if log_file.exists():
        health_status['log_file_size'] = log_file.stat().st_size
        health_status['log_last_modified'] = datetime.fromtimestamp(
            log_file.stat().st_mtime
        ).isoformat()
    
    return health_status

if __name__ == "__main__":
    health = check_system_health()
    print(json.dumps(health, indent=2, ensure_ascii=False))
```

### 4. 日志监控

创建日志轮转配置 `/etc/logrotate.d/pipiads-rpa`：
```
/opt/pipiads_rpa/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 0644 rpa_user rpa_group
}
```

---

## 故障排除

### 1. 常见问题诊断

#### 数据采集失败
```bash
# 检查网络连接
ping www.pipiads.com

# 检查浏览器版本
google-chrome --version

# 检查ChromeDriver版本
chromedriver --version

# 测试登录
python -c "
from data_collector import PipiadsCollector
collector = PipiadsCollector()
collector.start_session()
print('登录结果:', collector.login())
collector.close_session()
"
```

#### 数据处理错误
```bash
# 检查数据文件
ls -la outputs/daily_scan_*.csv

# 验证数据格式
python -c "
import pandas as pd
df = pd.read_csv('outputs/daily_scan_$(date +%Y%m%d).csv')
print('数据形状:', df.shape)
print('列名:', df.columns.tolist())
print('数据类型:', df.dtypes)
"
```

#### 内存不足
```bash
# 检查内存使用
free -h  # Linux
vm_stat # macOS

# 优化配置
# 在config.py中减少并发处理数量
# 启用数据分批处理
```

### 2. 错误日志分析

#### 日志级别配置
```python
# 在config.py中调整日志级别
logging.basicConfig(
    level=logging.DEBUG,  # 详细调试信息
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

#### 常见错误码
- **登录失败 (AUTH_ERROR)**: 检查用户名密码
- **网络超时 (NETWORK_TIMEOUT)**: 检查网络连接或增加超时时间
- **元素未找到 (ELEMENT_NOT_FOUND)**: 网站结构可能已更改
- **数据格式错误 (DATA_FORMAT_ERROR)**: 检查数据验证规则

### 3. 紧急恢复流程

#### 系统崩溃恢复
```bash
# 1. 停止服务
sudo systemctl stop pipiads-rpa

# 2. 检查损坏的文件
find outputs/ -name "*.csv" -size 0 -delete

# 3. 恢复最近的备份
cp backups/latest/* outputs/

# 4. 重启服务
sudo systemctl start pipiads-rpa
```

#### 数据库恢复
```bash
# 备份当前数据库
cp outputs/human_review.db backups/human_review_$(date +%Y%m%d).db

# 如果数据库损坏，重新初始化
python -c "
from human_collaboration import HumanCollaborationManager
hcm = HumanCollaborationManager()
print('数据库重新初始化完成')
"
```

---

## 性能优化

### 1. 系统级优化

#### 内存优化
```python
# 在config.py中添加内存优化配置
OPTIMIZATION_CONFIG = {
    'batch_size': 100,           # 批处理大小
    'max_concurrent_requests': 5, # 最大并发请求
    'memory_limit_mb': 2048,     # 内存限制
    'gc_frequency': 10           # 垃圾回收频率
}
```

#### 网络优化
```python
# 添加请求优化
NETWORK_OPTIMIZATION = {
    'connection_pool_size': 10,
    'max_retries': 3,
    'retry_delay': 2,
    'request_timeout': 30,
    'use_session_reuse': True
}
```

### 2. 代码优化

#### 数据处理优化
```python
# 使用更高效的数据处理方法
import pandas as pd

# 启用数据类型优化
def optimize_dataframe(df):
    """优化DataFrame内存使用"""
    for col in df.select_dtypes(include=['object']):
        if df[col].nunique() / len(df) < 0.5:
            df[col] = df[col].astype('category')
    
    for col in df.select_dtypes(include=['int64']):
        if df[col].min() >= 0:
            if df[col].max() < 255:
                df[col] = df[col].astype('uint8')
            elif df[col].max() < 65535:
                df[col] = df[col].astype('uint16')
    
    return df
```

#### 并行处理
```python
from concurrent.futures import ThreadPoolExecutor
import asyncio

class OptimizedCollector(PipiadsCollector):
    def parallel_collect(self, keywords):
        """并行采集多个关键词"""
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(self.search_products, [kw]) 
                      for kw in keywords]
            
            for future in futures:
                future.result()
```

### 3. 性能监控

创建性能监控脚本 `performance_monitor.py`：
```python
import time
import psutil
import threading
from datetime import datetime

class PerformanceMonitor:
    def __init__(self):
        self.metrics = []
        self.running = False
    
    def start_monitoring(self):
        self.running = True
        thread = threading.Thread(target=self._monitor_loop)
        thread.daemon = True
        thread.start()
    
    def _monitor_loop(self):
        while self.running:
            metrics = {
                'timestamp': datetime.now().isoformat(),
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_io': psutil.disk_io_counters()._asdict(),
                'network_io': psutil.net_io_counters()._asdict()
            }
            self.metrics.append(metrics)
            
            # 保留最近1000个数据点
            if len(self.metrics) > 1000:
                self.metrics = self.metrics[-1000:]
            
            time.sleep(60)  # 每分钟采集一次
```

---

## 安全管理

### 1. 凭据管理

#### 使用环境变量
```bash
# 设置环境变量
export PIPIADS_USERNAME="your_username"
export PIPIADS_PASSWORD="your_password"

# 或使用.env文件（确保不提交到版本控制）
echo "PIPIADS_USERNAME=your_username" > .env
echo "PIPIADS_PASSWORD=your_password" >> .env
chmod 600 .env
```

#### 加密存储
```python
from cryptography.fernet import Fernet

class CredentialManager:
    def __init__(self):
        self.key = self._load_or_create_key()
        self.cipher = Fernet(self.key)
    
    def _load_or_create_key(self):
        key_file = 'secret.key'
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(key_file, 'wb') as f:
                f.write(key)
            os.chmod(key_file, 0o600)
            return key
    
    def encrypt_credential(self, credential):
        return self.cipher.encrypt(credential.encode())
    
    def decrypt_credential(self, encrypted_credential):
        return self.cipher.decrypt(encrypted_credential).decode()
```

### 2. 网络安全

#### 代理配置
```python
# 配置代理服务器
PROXY_CONFIG = {
    'http': 'http://proxy.company.com:8080',
    'https': 'https://proxy.company.com:8080'
}

# 在requests中使用代理
import requests
response = requests.get(url, proxies=PROXY_CONFIG)
```

#### SSL证书验证
```python
# 启用SSL证书验证
import ssl
import certifi

ssl_context = ssl.create_default_context(cafile=certifi.where())
```

### 3. 访问控制

#### 文件权限设置
```bash
# 设置严格的文件权限
chmod 700 /opt/pipiads_rpa
chmod 600 /opt/pipiads_rpa/.env
chmod 600 /opt/pipiads_rpa/secret.key
chmod 644 /opt/pipiads_rpa/*.py
chmod 755 /opt/pipiads_rpa/outputs
```

#### 用户权限管理
```bash
# 创建专用用户
sudo useradd -r -s /bin/false rpa_user
sudo chown -R rpa_user:rpa_group /opt/pipiads_rpa
```

---

## 备份恢复

### 1. 数据备份策略

#### 每日备份脚本
创建 `backup.sh`：
```bash
#!/bin/bash

BACKUP_DIR="/opt/pipiads_rpa/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="pipiads_rpa_backup_${DATE}"

# 创建备份目录
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"

# 备份数据文件
cp -r outputs/ "${BACKUP_DIR}/${BACKUP_NAME}/"
cp -r logs/ "${BACKUP_DIR}/${BACKUP_NAME}/"

# 备份配置文件
cp config.py "${BACKUP_DIR}/${BACKUP_NAME}/"
cp .env "${BACKUP_DIR}/${BACKUP_NAME}/"

# 压缩备份
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"

# 保留最近30天的备份
find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +30 -delete

echo "备份完成: ${BACKUP_NAME}.tar.gz"
```

#### 自动备份配置
```bash
# 添加到crontab
crontab -e

# 每日2点执行备份
0 2 * * * /opt/pipiads_rpa/backup.sh
```

### 2. 云端备份

#### AWS S3备份
```python
import boto3
from datetime import datetime

class CloudBackup:
    def __init__(self):
        self.s3_client = boto3.client('s3')
        self.bucket_name = 'pipiads-rpa-backups'
    
    def upload_backup(self, file_path):
        """上传备份到S3"""
        key = f"backups/{datetime.now().strftime('%Y/%m/%d')}/{os.path.basename(file_path)}"
        
        try:
            self.s3_client.upload_file(file_path, self.bucket_name, key)
            print(f"备份已上传: s3://{self.bucket_name}/{key}")
        except Exception as e:
            print(f"上传失败: {e}")
```

### 3. 灾难恢复

#### 快速恢复脚本
创建 `restore.sh`：
```bash
#!/bin/bash

if [ $# -eq 0 ]; then
    echo "使用方法: $0 <backup_file>"
    exit 1
fi

BACKUP_FILE=$1
RESTORE_DIR="/opt/pipiads_rpa"

# 停止服务
sudo systemctl stop pipiads-rpa

# 备份当前状态
cp -r "${RESTORE_DIR}/outputs" "${RESTORE_DIR}/outputs.backup.$(date +%Y%m%d_%H%M%S)"

# 解压恢复文件
cd "${RESTORE_DIR}"
tar -xzf "$BACKUP_FILE"

# 移动文件到正确位置
BACKUP_NAME=$(basename "$BACKUP_FILE" .tar.gz)
cp -r "${BACKUP_NAME}/outputs/"* outputs/
cp -r "${BACKUP_NAME}/logs/"* logs/

# 清理临时文件
rm -rf "$BACKUP_NAME"

# 修复权限
chown -R rpa_user:rpa_group "${RESTORE_DIR}"

# 重启服务
sudo systemctl start pipiads-rpa

echo "恢复完成"
```

---

## 升级维护

### 1. 版本管理

#### 版本控制策略
```
v1.0.0 - 初始版本
v1.1.0 - 功能增强
v1.1.1 - Bug修复
```

#### 更新检查脚本
```python
import requests
import json
from packaging import version

def check_for_updates():
    """检查是否有新版本"""
    current_version = "1.0.0"
    
    try:
        # 从GitHub或内部服务器检查最新版本
        response = requests.get("https://api.github.com/repos/company/pipiads-rpa/releases/latest")
        latest_release = response.json()
        latest_version = latest_release['tag_name'].lstrip('v')
        
        if version.parse(latest_version) > version.parse(current_version):
            print(f"发现新版本: {latest_version}")
            return latest_version
        else:
            print("当前版本是最新的")
            return None
            
    except Exception as e:
        print(f"检查更新失败: {e}")
        return None
```

### 2. 自动更新

#### 更新脚本
创建 `update.sh`：
```bash
#!/bin/bash

NEW_VERSION=$1

if [ -z "$NEW_VERSION" ]; then
    echo "使用方法: $0 <new_version>"
    exit 1
fi

# 备份当前版本
echo "备份当前版本..."
./backup.sh

# 停止服务
echo "停止服务..."
sudo systemctl stop pipiads-rpa

# 下载新版本
echo "下载新版本 $NEW_VERSION..."
wget "https://github.com/company/pipiads-rpa/archive/v${NEW_VERSION}.tar.gz" -O "v${NEW_VERSION}.tar.gz"

# 解压新版本
tar -xzf "v${NEW_VERSION}.tar.gz"

# 更新文件
echo "更新文件..."
cp "pipiads-rpa-${NEW_VERSION}"/*.py ./
cp "pipiads-rpa-${NEW_VERSION}"/requirements.txt ./

# 更新依赖
echo "更新依赖..."
pip install -r requirements.txt --upgrade

# 运行数据库迁移（如有）
echo "运行数据库迁移..."
python migrate.py

# 重启服务
echo "重启服务..."
sudo systemctl start pipiads-rpa

# 清理临时文件
rm -rf "pipiads-rpa-${NEW_VERSION}" "v${NEW_VERSION}.tar.gz"

echo "更新完成到版本 $NEW_VERSION"
```

### 3. 维护任务

#### 定期维护脚本
创建 `maintenance.py`：
```python
import os
import glob
import sqlite3
from datetime import datetime, timedelta

def daily_maintenance():
    """每日维护任务"""
    print("开始每日维护...")
    
    # 清理临时文件
    temp_files = glob.glob('downloads/*.tmp')
    for file in temp_files:
        os.remove(file)
    
    # 压缩旧日志
    old_logs = glob.glob('logs/*.log.*')
    for log in old_logs:
        if os.path.getmtime(log) < (datetime.now() - timedelta(days=7)).timestamp():
            os.system(f'gzip {log}')
    
    # 优化数据库
    db_path = 'outputs/human_review.db'
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        conn.execute('VACUUM')
        conn.close()
    
    print("每日维护完成")

def weekly_maintenance():
    """每周维护任务"""
    print("开始每周维护...")
    
    # 清理过期的Excel文件
    excel_files = glob.glob('outputs/*.xlsx')
    for file in excel_files:
        if os.path.getmtime(file) < (datetime.now() - timedelta(days=30)).timestamp():
            os.remove(file)
    
    # 生成性能报告
    generate_performance_report()
    
    print("每周维护完成")

def generate_performance_report():
    """生成性能报告"""
    # 分析日志文件，生成性能报告
    pass
```

#### 健康检查
```python
def system_health_check():
    """系统健康检查"""
    issues = []
    
    # 检查磁盘空间
    disk_usage = psutil.disk_usage('/')
    if disk_usage.percent > 85:
        issues.append(f"磁盘使用率过高: {disk_usage.percent}%")
    
    # 检查内存使用
    memory = psutil.virtual_memory()
    if memory.percent > 90:
        issues.append(f"内存使用率过高: {memory.percent}%")
    
    # 检查服务状态
    try:
        result = os.system('systemctl is-active --quiet pipiads-rpa')
        if result != 0:
            issues.append("RPA服务未运行")
    except:
        issues.append("无法检查服务状态")
    
    # 检查最近的错误日志
    recent_errors = check_recent_errors()
    if recent_errors > 10:
        issues.append(f"最近24小时内有 {recent_errors} 个错误")
    
    return issues

def check_recent_errors():
    """检查最近的错误数量"""
    log_file = f"logs/activity_{datetime.now().strftime('%Y%m%d')}.log"
    if not os.path.exists(log_file):
        return 0
    
    error_count = 0
    cutoff_time = datetime.now() - timedelta(hours=24)
    
    with open(log_file, 'r') as f:
        for line in f:
            if 'ERROR' in line:
                # 简单的时间解析（实际应该更严格）
                error_count += 1
    
    return error_count
```

---

## 📞 技术支持

### 联系信息
- **技术支持邮箱：** rpa-support@company.com
- **紧急热线：** +86-xxx-xxxx-xxxx
- **文档更新：** 每季度更新

### 故障报告模板
```
故障报告
=========
时间: ___________
版本: ___________
环境: ___________
错误描述: ___________
错误日志: ___________
重现步骤: ___________
影响范围: ___________
```

### 更新日志
- **v1.0.0** (2024-01-01): 初始版本发布
- **v1.1.0** (2024-04-01): 增加人机协作功能
- **v1.2.0** (2024-07-01): 性能优化和错误修复

---

**文档版本：** v1.0  
**最后更新：** 2024年1月1日  
**下次更新：** 2024年4月1日

*本文档为内部技术文档，请妥善保管*