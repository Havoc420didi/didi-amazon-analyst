# Pipiads RPA系统 macOS 部署指南

## 📋 目录
1. [系统要求](#系统要求)
2. [环境准备](#环境准务)
3. [依赖安装](#依赖安装)
4. [配置设置](#配置设置)
5. [安装部署](#安装部署)
6. [运行测试](#运行测试)
7. [问题排查](#问题排查)
8. [性能优化](#性能优化)
9. [维护监控](#维护监控)

---

## 🖥️ 系统要求

### macOS 版本支持
- **推荐：** macOS 12 (Monterey) 或更高版本
- **最低：** macOS 10.15 (Catalina)
- **架构：** Intel (x86_64) 和 Apple Silicon (M1/M2/M3) 均支持

### 硬件要求
- **CPU：** 4核心或以上（Apple Silicon 性能更佳）
- **内存：** 8GB RAM（推荐 16GB）
- **存储：** 50GB 可用空间（SSD推荐）
- **网络：** 稳定的互联网连接

### 必要软件
- **Xcode Command Line Tools**
- **Homebrew** (推荐的包管理器)
- **Chrome 浏览器** (最新版本)

---

## 🛠️ 环境准备

### 1. 安装 Xcode Command Line Tools
```bash
# 安装 Xcode 命令行工具
xcode-select --install

# 验证安装
xcode-select -p
```

### 2. 安装 Homebrew
```bash
# 安装 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 验证安装
brew --version

# 更新 Homebrew
brew update
```

### 3. 安装 Python
```bash
# 使用 Homebrew 安装 Python 3.9+
brew install python@3.11

# 验证安装
python3 --version
pip3 --version

# 设置 Python 别名（可选）
echo 'alias python=python3' >> ~/.zshrc
echo 'alias pip=pip3' >> ~/.zshrc
source ~/.zshrc
```

### 4. 安装 Git（如果需要）
```bash
# 安装 Git
brew install git

# 配置 Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 📦 依赖安装

### 1. 创建项目目录
```bash
# 创建项目目录
mkdir -p ~/Projects/pipiads_rpa
cd ~/Projects/pipiads_rpa
```

### 2. 创建虚拟环境
```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 验证虚拟环境
which python
which pip
```

### 3. 升级 pip 和安装工具
```bash
# 升级 pip
pip install --upgrade pip setuptools wheel

# 安装 requirements.txt 中的依赖
pip install -r requirements.txt
```

### 4. 安装 Chrome 浏览器
```bash
# 使用 Homebrew 安装 Chrome
brew install --cask google-chrome

# 或手动下载安装
# 访问 https://www.google.com/chrome/ 下载安装包
```

### 5. 安装系统级依赖
```bash
# 安装可能需要的系统库
brew install wget curl

# 安装数据库相关工具（可选）
brew install sqlite3

# 安装监控工具
pip install psutil
```

---

## ⚙️ 配置设置

### 1. 创建目录结构
```bash
# 在项目根目录下创建必要目录
mkdir -p outputs/charts
mkdir -p logs
mkdir -p downloads
mkdir -p backups
mkdir -p config
```

### 2. 设置环境变量
```bash
# 创建 .env 文件
cat > .env << 'EOF'
# Pipiads 账户配置
PIPIADS_USERNAME=your_username_here
PIPIADS_PASSWORD=your_password_here

# 可选：代理配置
# PROXY_URL=http://proxy.example.com:8080

# 用户代理字符串
USER_AGENT=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36

# 通知配置（可选）
# NOTIFICATION_EMAIL=admin@company.com
# SLACK_WEBHOOK=https://hooks.slack.com/services/xxx
EOF

# 设置文件权限
chmod 600 .env
```

### 3. macOS 特定配置
```bash
# 允许终端访问文件夹（如果需要）
# 系统偏好设置 > 安全性与隐私 > 隐私 > 完全磁盘访问权限 > 添加终端

# 配置防火墙例外（如果需要）
# 系统偏好设置 > 安全性与隐私 > 防火墙 > 防火墙选项
```

### 4. 字体配置（支持中文显示）
```bash
# 安装中文字体（如果没有）
# 系统偏好设置 > 语言与地区 > 添加中文

# 验证字体可用性
python3 -c "
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
fonts = [f.name for f in fm.fontManager.ttflist if '中文' in f.name or 'Chinese' in f.name or 'GB' in f.name]
print('可用中文字体:', fonts[:5])
"
```

---

## 🚀 安装部署

### 1. 复制 RPA 代码文件
```bash
# 确保以下文件在项目目录中：
ls -la
# main.py
# config.py
# data_collector.py
# data_processor.py
# human_collaboration.py
# report_generator.py
# requirements.txt
```

### 2. 验证配置
```bash
# 激活虚拟环境
source venv/bin/activate

# 测试配置
python3 -c "
from config import validate_config
try:
    validate_config()
    print('✅ 配置验证通过')
except Exception as e:
    print(f'❌ 配置验证失败: {e}')
"
```

### 3. 创建启动脚本
```bash
# 创建启动脚本
cat > start_rpa.sh << 'EOF'
#!/bin/bash

# Pipiads RPA 启动脚本 for macOS

# 设置项目路径
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "❌ 虚拟环境不存在，请先创建虚拟环境"
    exit 1
fi

# 激活虚拟环境
source venv/bin/activate

# 检查环境变量
if [ ! -f ".env" ]; then
    echo "❌ .env 文件不存在，请先创建配置文件"
    exit 1
fi

# 导入环境变量
export $(cat .env | grep -v '^#' | xargs)

# 检查必要的环境变量
if [ -z "$PIPIADS_USERNAME" ] || [ -z "$PIPIADS_PASSWORD" ]; then
    echo "❌ 请在 .env 文件中设置 PIPIADS_USERNAME 和 PIPIADS_PASSWORD"
    exit 1
fi

# 创建日志目录
mkdir -p logs

echo "🚀 启动 Pipiads RPA 系统..."
echo "📁 项目目录: $PROJECT_DIR"
echo "🐍 Python 版本: $(python --version)"
echo "⏰ 启动时间: $(date)"

# 启动 RPA 系统
python main.py "$@"
EOF

# 设置执行权限
chmod +x start_rpa.sh
```

### 4. 创建停止脚本
```bash
# 创建停止脚本
cat > stop_rpa.sh << 'EOF'
#!/bin/bash

echo "🛑 停止 Pipiads RPA 系统..."

# 查找并停止 Python 进程
pkill -f "python.*main.py" && echo "✅ RPA 系统已停止" || echo "ℹ️  未找到运行中的 RPA 进程"

# 清理临时文件
find downloads/ -name "*.tmp" -delete 2>/dev/null
echo "🧹 临时文件已清理"
EOF

chmod +x stop_rpa.sh
```

### 5. 创建系统服务（可选）
```bash
# 使用 launchd 创建系统服务
cat > ~/Library/LaunchAgents/com.pipiads.rpa.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pipiads.rpa</string>
    <key>ProgramArguments</key>
    <array>
        <string>$HOME/Projects/pipiads_rpa/start_rpa.sh</string>
        <string>--mode</string>
        <string>scheduler</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$HOME/Projects/pipiads_rpa</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Projects/pipiads_rpa/logs/rpa.out.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Projects/pipiads_rpa/logs/rpa.error.log</string>
</dict>
</plist>
EOF

# 加载服务
launchctl load ~/Library/LaunchAgents/com.pipiads.rpa.plist

# 启动服务
launchctl start com.pipiads.rpa
```

---

## 🐛 最新 Bug 修复（2024年更新）

### 已修复的问题
1. **DataFrame 访问错误** - 修复了所有 `.get()` 方法的错误使用
2. **导入缺失** - 添加了 `os` 和 `re` 模块的导入
3. **路径问题** - 修复了相对路径为绝对路径
4. **日期解析** - 改进了日期解析逻辑
5. **环境变量** - 改进了环境变量验证和提示

### 一键验证脚本
```bash
# 运行部署验证脚本
python3 verify_deployment.py
```

---

## 🧪 运行测试

### 1. 单元测试
```bash
# 激活虚拟环境
source venv/bin/activate

# 测试配置模块
python3 -c "
import config
print('✅ config.py 导入成功')
print('📂 输出目录:', config.PATHS['output_dir'])
print('🔍 今日关键词:', config.get_today_keywords())
"

# 测试数据采集模块（基础测试）
python3 -c "
from data_collector import PipiadsCollector
collector = PipiadsCollector()
print('✅ 数据采集模块初始化成功')
"

# 测试数据处理模块
python3 -c "
from data_processor import DataProcessor
processor = DataProcessor()
print('✅ 数据处理模块初始化成功')
"

# 测试报告生成模块
python3 -c "
from report_generator import ReportGenerator
generator = ReportGenerator()
print('✅ 报告生成模块初始化成功')
"

# 测试人机协作模块
python3 -c "
from human_collaboration import HumanCollaborationManager
collaboration = HumanCollaborationManager()
print('✅ 人机协作模块初始化成功')
print('📍 数据库路径:', collaboration.db_path)
"
```

### 2. 集成测试
```bash
# 测试完整流程（干运行）
python3 main.py --config-check

# 单次运行测试
python3 main.py --mode once --task daily

# 检查生成的文件
ls -la outputs/
ls -la logs/
```

### 3. 浏览器测试
```bash
# 测试 Chrome 和 ChromeDriver
python3 -c "
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

options = Options()
options.add_argument('--headless')
service = Service(ChromeDriverManager().install())

try:
    driver = webdriver.Chrome(service=service, options=options)
    driver.get('https://www.google.com')
    print('✅ Chrome WebDriver 测试成功')
    print('📄 页面标题:', driver.title)
    driver.quit()
except Exception as e:
    print('❌ Chrome WebDriver 测试失败:', e)
"
```

---

## 🔧 问题排查

### 常见问题及解决方案

#### 1. Python 版本问题
```bash
# 问题：Python 版本不兼容
# 解决：
brew uninstall python@3.x
brew install python@3.11
brew link --overwrite python@3.11
```

#### 2. ChromeDriver 问题
```bash
# 问题：ChromeDriver 无法启动
# 解决方案1：重新安装 Chrome
brew uninstall --cask google-chrome
brew install --cask google-chrome

# 解决方案2：清除 ChromeDriver 缓存
rm -rf ~/.wdm/drivers/chromedriver/

# 解决方案3：手动允许 ChromeDriver
# 系统偏好设置 > 安全性与隐私 > 通用 > 仍要打开
```

#### 3. 权限问题
```bash
# 问题：文件权限不足
# 解决：
chmod -R 755 ~/Projects/pipiads_rpa
chmod 600 .env

# 问题：无法访问某些文件夹
# 解决：在系统偏好设置中给予终端完全磁盘访问权限
```

#### 4. 网络连接问题
```bash
# 测试网络连接
ping -c 3 www.pipiads.com
curl -I https://www.pipiads.com

# 如果使用代理
export http_proxy=http://proxy.example.com:8080
export https_proxy=http://proxy.example.com:8080
```

#### 5. 内存不足问题
```bash
# 检查内存使用
vm_stat | head -5

# 清理内存
sudo purge

# 优化配置（在 config.py 中）
BROWSER_CONFIG['headless'] = True  # 使用无头模式
```

#### 6. 中文字体问题
```bash
# 安装额外字体
brew install --cask font-source-han-sans
brew install --cask font-source-han-serif

# 测试字体
python3 -c "
import matplotlib.pyplot as plt
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS']
plt.text(0.5, 0.5, '测试中文显示', fontsize=14)
plt.savefig('font_test.png')
print('字体测试完成，请检查 font_test.png')
"
```

### 日志分析
```bash
# 查看实时日志
tail -f logs/activity_$(date +%Y%m%d).log

# 查看错误日志
grep "ERROR" logs/activity_$(date +%Y%m%d).log

# 查看启动日志
cat logs/rpa.out.log
cat logs/rpa.error.log
```

---

## ⚡ 性能优化

### 1. macOS 特定优化
```bash
# 增加文件描述符限制
echo 'ulimit -n 10240' >> ~/.zshrc

# 优化 Python 性能
export PYTHONOPTIMIZE=1
export PYTHONDONTWRITEBYTECODE=1

# 使用更快的 Python 解释器（可选）
# brew install pypy3
```

### 2. 系统配置优化
```bash
# 在 config.py 中添加 macOS 优化配置
cat >> config.py << 'EOF'

# macOS 特定优化配置
MACOS_OPTIMIZATION = {
    'use_metal_acceleration': True,  # 使用 Metal 加速（Apple Silicon）
    'optimize_for_battery': False,   # 是否优化电池使用
    'use_unified_memory': True,      # Apple Silicon 统一内存优化
    'background_processing': True    # 后台处理模式
}
EOF
```

### 3. 监控脚本
```bash
# 创建 macOS 专用监控脚本
cat > monitor_macos.py << 'EOF'
#!/usr/bin/env python3
import psutil
import subprocess
import json
from datetime import datetime

def get_macos_system_info():
    """获取 macOS 系统信息"""
    try:
        # 获取 CPU 信息
        cpu_info = subprocess.check_output(['sysctl', '-n', 'machdep.cpu.brand_string'], text=True).strip()
        
        # 获取内存信息
        memory_pressure = subprocess.check_output(['memory_pressure'], text=True)
        
        # 获取磁盘使用情况
        disk_usage = psutil.disk_usage('/')
        
        # 获取进程信息
        rpa_processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            if 'python' in proc.info['name'].lower() and 'main.py' in str(proc.cmdline()):
                rpa_processes.append(proc.info)
        
        return {
            'timestamp': datetime.now().isoformat(),
            'cpu_info': cpu_info,
            'cpu_percent': psutil.cpu_percent(interval=1),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_percent': disk_usage.percent,
            'rpa_processes': rpa_processes,
            'system': 'macOS'
        }
    except Exception as e:
        return {'error': str(e)}

if __name__ == "__main__":
    info = get_macos_system_info()
    print(json.dumps(info, indent=2, ensure_ascii=False))
EOF

chmod +x monitor_macos.py
```

---

## 🔄 维护监控

### 1. 自动备份脚本
```bash
# 创建 macOS 备份脚本
cat > backup_macos.sh << 'EOF'
#!/bin/bash

# macOS 备份脚本
BACKUP_DIR="$HOME/Backups/pipiads_rpa"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="$HOME/Projects/pipiads_rpa"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份项目文件
tar -czf "$BACKUP_DIR/pipiads_rpa_$DATE.tar.gz" \
    -C "$PROJECT_DIR" \
    --exclude='venv' \
    --exclude='*.pyc' \
    --exclude='__pycache__' \
    --exclude='.git' \
    .

# 使用 Time Machine 排除临时文件
tmutil addexclusion "$PROJECT_DIR/downloads"
tmutil addexclusion "$PROJECT_DIR/venv"

echo "✅ 备份完成: pipiads_rpa_$DATE.tar.gz"

# 清理超过 30 天的备份
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

# 可选：上传到 iCloud Drive
# cp "$BACKUP_DIR/pipiads_rpa_$DATE.tar.gz" "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Backups/"
EOF

chmod +x backup_macos.sh
```

### 2. 使用 cron 定时任务
```bash
# 编辑 crontab
crontab -e

# 添加定时任务
# 每日 2 AM 执行备份
0 2 * * * $HOME/Projects/pipiads_rpa/backup_macos.sh

# 每周日 3 AM 清理日志
0 3 * * 0 find $HOME/Projects/pipiads_rpa/logs -name "*.log" -mtime +7 -delete
```

### 3. 系统通知
```bash
# 创建通知脚本
cat > notify_macos.py << 'EOF'
#!/usr/bin/env python3
import subprocess
import sys

def send_notification(title, message, sound=True):
    """发送 macOS 系统通知"""
    cmd = [
        'osascript', '-e',
        f'display notification "{message}" with title "{title}"'
    ]
    
    if sound:
        cmd.extend(['-e', 'beep'])
    
    try:
        subprocess.run(cmd, check=True)
        return True
    except subprocess.CalledProcessError:
        return False

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        send_notification(sys.argv[1], sys.argv[2])
    else:
        send_notification("Pipiads RPA", "系统运行正常")
EOF

chmod +x notify_macos.py
```

### 4. 创建状态仪表板
```bash
# 创建 macOS 状态仪表板
cat > dashboard_macos.py << 'EOF'
#!/usr/bin/env python3
import tkinter as tk
from tkinter import ttk
import threading
import time
import json
import subprocess
from datetime import datetime

class RPADashboard:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Pipiads RPA 状态监控")
        self.root.geometry("600x400")
        
        # 创建界面
        self.create_widgets()
        
        # 启动监控线程
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self.monitor_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
    
    def create_widgets(self):
        # 状态标签
        self.status_label = ttk.Label(self.root, text="系统状态: 检查中...", font=("Arial", 16))
        self.status_label.pack(pady=10)
        
        # 信息文本框
        self.info_text = tk.Text(self.root, height=20, width=70)
        self.info_text.pack(pady=10)
        
        # 按钮框架
        button_frame = ttk.Frame(self.root)
        button_frame.pack(pady=10)
        
        ttk.Button(button_frame, text="启动 RPA", command=self.start_rpa).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="停止 RPA", command=self.stop_rpa).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="刷新状态", command=self.refresh_status).pack(side=tk.LEFT, padx=5)
    
    def monitor_loop(self):
        while self.monitoring:
            self.refresh_status()
            time.sleep(30)  # 每30秒刷新一次
    
    def refresh_status(self):
        try:
            # 运行监控脚本
            result = subprocess.run(['python3', 'monitor_macos.py'], 
                                  capture_output=True, text=True)
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                self.update_display(data)
            else:
                self.info_text.insert(tk.END, f"监控错误: {result.stderr}\n")
        except Exception as e:
            self.info_text.insert(tk.END, f"监控异常: {e}\n")
    
    def update_display(self, data):
        # 更新状态标签
        if 'error' in data:
            self.status_label.config(text="系统状态: 错误", foreground="red")
        else:
            self.status_label.config(text="系统状态: 正常", foreground="green")
        
        # 更新信息文本
        self.info_text.delete(1.0, tk.END)
        info = f"""
更新时间: {data.get('timestamp', 'N/A')}
CPU 使用率: {data.get('cpu_percent', 0):.1f}%
内存使用率: {data.get('memory_percent', 0):.1f}%
磁盘使用率: {data.get('disk_percent', 0):.1f}%
CPU 信息: {data.get('cpu_info', 'N/A')}

RPA 进程:
"""
        for proc in data.get('rpa_processes', []):
            info += f"  PID: {proc['pid']}, CPU: {proc['cpu_percent']:.1f}%, 内存: {proc['memory_percent']:.1f}%\n"
        
        if not data.get('rpa_processes'):
            info += "  未找到运行中的 RPA 进程\n"
        
        self.info_text.insert(1.0, info)
    
    def start_rpa(self):
        subprocess.Popen(['./start_rpa.sh', '--mode', 'scheduler'])
        self.info_text.insert(tk.END, f"{datetime.now()}: 启动 RPA 系统\n")
    
    def stop_rpa(self):
        subprocess.run(['./stop_rpa.sh'])
        self.info_text.insert(tk.END, f"{datetime.now()}: 停止 RPA 系统\n")
    
    def run(self):
        self.root.mainloop()
        self.monitoring = False

if __name__ == "__main__":
    dashboard = RPADashboard()
    dashboard.run()
EOF

chmod +x dashboard_macos.py
```

---

## 📱 快速使用指南

### 一键启动命令
```bash
# 切换到项目目录
cd ~/Projects/pipiads_rpa

# 激活虚拟环境并启动
source venv/bin/activate && ./start_rpa.sh
```

### 一键停止命令
```bash
./stop_rpa.sh
```

### 状态检查命令
```bash
# 检查系统状态
python3 monitor_macos.py

# 检查日志
tail -20 logs/activity_$(date +%Y%m%d).log
```

### GUI 监控面板
```bash
# 启动图形界面监控
python3 dashboard_macos.py
```

---

## 🔗 相关资源

### 官方文档
- [Selenium Documentation](https://selenium-python.readthedocs.io/)
- [pandas Documentation](https://pandas.pydata.org/docs/)
- [Python 官方文档](https://docs.python.org/3/)

### macOS 特定资源
- [Homebrew](https://brew.sh/)
- [macOS 开发者文档](https://developer.apple.com/documentation/macos)
- [launchd 文档](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)

### 故障排查资源
- [Chrome WebDriver 故障排查](https://chromedriver.chromium.org/troubleshooting)
- [Python 虚拟环境指南](https://docs.python.org/3/tutorial/venv.html)

---

## 📞 技术支持

### 联系方式
- **技术支持邮箱:** rpa-support@company.com
- **macOS 专项支持:** macos-support@company.com
- **紧急热线:** +86-xxx-xxxx-xxxx

### 故障报告
遇到问题时，请提供以下信息：
```bash
# 收集系统信息
system_profiler SPSoftwareDataType > system_info.txt
python3 --version >> system_info.txt
pip list >> system_info.txt
```

---

**文档版本:** v1.0 for macOS  
**最后更新:** 2024年1月1日  
**适用系统:** macOS 10.15+  
**测试环境:** macOS 12.0 (Monterey), Apple M1

*本指南专门针对 macOS 系统优化，确保最佳兼容性和性能*