#!/usr/bin/env python3
"""
macOS 部署验证脚本
验证 RPA 系统是否正确安装和配置
"""

import sys
import os
import subprocess
import platform

def print_section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print('='*50)

def check_system():
    """检查系统信息"""
    print_section("系统信息")
    print(f"操作系统: {platform.system()}")
    print(f"版本: {platform.mac_ver()[0] if platform.system() == 'Darwin' else platform.version()}")
    print(f"架构: {platform.machine()}")
    print(f"Python 版本: {sys.version}")
    
    if platform.system() != 'Darwin':
        print("⚠️  警告: 此脚本专为 macOS 设计")
        return False
    return True

def check_python():
    """检查 Python 环境"""
    print_section("Python 环境")
    
    # 检查 Python 版本
    version = sys.version_info
    print(f"Python 版本: {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 版本必须 >= 3.8")
        return False
    else:
        print("✅ Python 版本符合要求")
    
    # 检查虚拟环境
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("✅ 在虚拟环境中运行")
    else:
        print("⚠️  建议在虚拟环境中运行")
    
    return True

def check_dependencies():
    """检查依赖包"""
    print_section("依赖包检查")
    
    required_packages = [
        'selenium',
        'pandas',
        'numpy',
        'matplotlib',
        'requests',
        'beautifulsoup4',
        'openpyxl',
        'webdriver_manager',
        'APScheduler',
        'psutil'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - 未安装")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n需要安装的包: pip install {' '.join(missing_packages)}")
        return False
    
    return True

def check_chrome():
    """检查 Chrome 浏览器"""
    print_section("Chrome 浏览器")
    
    try:
        # 检查 Chrome 是否安装
        result = subprocess.run(['which', 'google-chrome'], capture_output=True, text=True)
        if result.returncode != 0:
            # 尝试 macOS 的路径
            chrome_path = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            if os.path.exists(chrome_path):
                print("✅ Chrome 已安装")
                # 获取版本
                try:
                    version_result = subprocess.run([chrome_path, '--version'], capture_output=True, text=True)
                    print(f"   版本: {version_result.stdout.strip()}")
                except:
                    print("   无法获取版本信息")
            else:
                print("❌ Chrome 未安装")
                print("   请运行: brew install --cask google-chrome")
                return False
        else:
            print("✅ Chrome 已安装")
    except Exception as e:
        print(f"❌ 检查 Chrome 时出错: {e}")
        return False
    
    return True

def check_environment_variables():
    """检查环境变量"""
    print_section("环境变量")
    
    required_vars = ['PIPIADS_USERNAME', 'PIPIADS_PASSWORD']
    missing_vars = []
    
    # 检查 .env 文件
    if os.path.exists('.env'):
        print("✅ 找到 .env 文件")
        try:
            with open('.env', 'r') as f:
                env_content = f.read()
                for var in required_vars:
                    if var in env_content:
                        print(f"✅ {var} 已设置")
                    else:
                        print(f"❌ {var} 未设置")
                        missing_vars.append(var)
        except:
            print("⚠️  无法读取 .env 文件")
    else:
        print("⚠️  未找到 .env 文件")
        
    # 检查系统环境变量
    for var in required_vars:
        if os.getenv(var):
            print(f"✅ {var} 已在系统环境变量中设置")
        elif var in missing_vars:
            print(f"❌ {var} 未设置")
    
    return len(missing_vars) == 0

def check_directories():
    """检查必要的目录"""
    print_section("目录结构")
    
    required_dirs = ['outputs', 'logs', 'downloads', 'outputs/charts']
    
    for dir_path in required_dirs:
        if os.path.exists(dir_path):
            print(f"✅ {dir_path}")
        else:
            print(f"❌ {dir_path} - 不存在")
            try:
                os.makedirs(dir_path, exist_ok=True)
                print(f"   已创建 {dir_path}")
            except Exception as e:
                print(f"   创建失败: {e}")
                return False
    
    return True

def check_modules():
    """检查 RPA 模块"""
    print_section("RPA 模块")
    
    modules = [
        'config.py',
        'data_collector.py',
        'data_processor.py',
        'report_generator.py',
        'human_collaboration.py',
        'main.py',
        'api_integration.py'
    ]
    
    all_present = True
    
    for module in modules:
        if os.path.exists(module):
            print(f"✅ {module}")
            # 尝试导入检查语法
            try:
                module_name = module.replace('.py', '')
                __import__(module_name)
            except ImportError as e:
                print(f"   ⚠️  导入错误: {e}")
            except Exception as e:
                print(f"   ⚠️  其他错误: {e}")
        else:
            print(f"❌ {module} - 文件不存在")
            all_present = False
    
    return all_present

def main():
    """主函数"""
    print("🔍 Pipiads RPA 系统部署验证")
    print("="*50)
    
    checks = [
        ("系统检查", check_system),
        ("Python 环境", check_python),
        ("依赖包", check_dependencies),
        ("Chrome 浏览器", check_chrome),
        ("环境变量", check_environment_variables),
        ("目录结构", check_directories),
        ("RPA 模块", check_modules)
    ]
    
    results = []
    
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ {name} 检查失败: {e}")
            results.append((name, False))
    
    # 总结
    print_section("验证结果")
    
    all_passed = True
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{name}: {status}")
        if not result:
            all_passed = False
    
    print("\n" + "="*50)
    if all_passed:
        print("✅ 所有检查通过！系统已准备就绪。")
        print("\n可以运行以下命令启动 RPA:")
        print("  python main.py --mode once  # 单次运行")
        print("  python main.py              # 调度模式")
    else:
        print("❌ 部分检查未通过，请修复上述问题后重试。")
        print("\n请参考 macOS_部署指南.md 获取详细部署说明。")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())