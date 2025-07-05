#!/bin/bash

# Pipiads RPA macOS 快速启动脚本
# 自动检查环境并启动 RPA 系统

echo "🚀 Pipiads RPA macOS 快速启动脚本"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查操作系统
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ 此脚本仅支持 macOS${NC}"
    exit 1
fi

# 检查 Python
echo -e "\n${YELLOW}检查 Python 环境...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 未安装${NC}"
    echo "请运行: brew install python@3.11"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo -e "${GREEN}✅ Python $PYTHON_VERSION 已安装${NC}"

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo -e "\n${YELLOW}创建虚拟环境...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✅ 虚拟环境创建成功${NC}"
fi

# 激活虚拟环境
echo -e "\n${YELLOW}激活虚拟环境...${NC}"
source venv/bin/activate

# 升级 pip
echo -e "\n${YELLOW}升级 pip...${NC}"
pip install --upgrade pip setuptools wheel --quiet

# 检查并安装依赖
echo -e "\n${YELLOW}检查依赖包...${NC}"
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt --quiet
    echo -e "${GREEN}✅ 依赖包安装完成${NC}"
else
    echo -e "${RED}❌ requirements.txt 文件不存在${NC}"
    exit 1
fi

# 检查 Chrome
echo -e "\n${YELLOW}检查 Chrome 浏览器...${NC}"
if [ -d "/Applications/Google Chrome.app" ]; then
    echo -e "${GREEN}✅ Chrome 已安装${NC}"
else
    echo -e "${RED}❌ Chrome 未安装${NC}"
    echo "请运行: brew install --cask google-chrome"
    exit 1
fi

# 创建必要目录
echo -e "\n${YELLOW}创建必要目录...${NC}"
mkdir -p outputs/charts logs downloads backups
echo -e "${GREEN}✅ 目录创建完成${NC}"

# 检查环境变量
echo -e "\n${YELLOW}检查环境变量...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}创建 .env 文件...${NC}"
    cat > .env << 'EOF'
# Pipiads 账户配置
PIPIADS_USERNAME=your_username_here
PIPIADS_PASSWORD=your_password_here

# 用户代理
USER_AGENT=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
EOF
    echo -e "${YELLOW}⚠️  请编辑 .env 文件，设置您的 Pipiads 账户信息${NC}"
    echo "完成后重新运行此脚本"
    exit 1
fi

# 读取环境变量
export $(cat .env | grep -v '^#' | xargs)

# 验证必要的环境变量
if [ -z "$PIPIADS_USERNAME" ] || [ "$PIPIADS_USERNAME" == "your_username_here" ]; then
    echo -e "${RED}❌ 请在 .env 文件中设置正确的 PIPIADS_USERNAME${NC}"
    exit 1
fi

if [ -z "$PIPIADS_PASSWORD" ] || [ "$PIPIADS_PASSWORD" == "your_password_here" ]; then
    echo -e "${RED}❌ 请在 .env 文件中设置正确的 PIPIADS_PASSWORD${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 环境变量配置正确${NC}"

# 运行验证脚本
echo -e "\n${YELLOW}运行系统验证...${NC}"
if [ -f "verify_deployment.py" ]; then
    python3 verify_deployment.py
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 系统验证失败，请修复问题后重试${NC}"
        exit 1
    fi
fi

# 选择运行模式
echo -e "\n${GREEN}系统准备就绪！${NC}"
echo -e "\n请选择运行模式:"
echo "1) 单次运行测试"
echo "2) 启动调度模式（持续运行）"
echo "3) 运行配置检查"
echo "4) 退出"

read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo -e "\n${YELLOW}启动单次运行测试...${NC}"
        python3 main.py --mode once --task daily
        ;;
    2)
        echo -e "\n${YELLOW}启动调度模式...${NC}"
        echo "按 Ctrl+C 停止运行"
        python3 main.py --mode scheduler
        ;;
    3)
        echo -e "\n${YELLOW}运行配置检查...${NC}"
        python3 main.py --config-check
        ;;
    4)
        echo "退出"
        exit 0
        ;;
    *)
        echo -e "${RED}无效选项${NC}"
        exit 1
        ;;
esac