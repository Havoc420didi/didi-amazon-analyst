#!/bin/bash

# 30天产品分析数据抓取启动脚本
# 一键启动30天数据抓取和保存到product_analytics2表

echo "🚀 启动Amazon产品分析30天数据抓取"
echo "================================="

# 1. 设置环境
export PYTHONPATH=sync_saihu_erp/data_update/src:$PYTHONPATH
echo "✅ 环境配置完成"  

# 2. 直接进入Python交互式执行
echo "📅 准备抓取30天数据范围："
echo "   开始日期：$(date -v-31d '+%Y-%m-%d')"
echo "   结束日期：$(date -v-1d '+%Y-%m-%d')"

echo ""
echo "🔍 可执行以下命令："
echo ""

# 显示可直接运行的Python命令
cat << 'EOF'

🔧 3种启动方式：

【方式1】直接Python执行：
```python
# 通过现有Python环境
python3 sync_saihu_erp/data_update/sync_now.py
```

【方式2】使用现有API：
curl -X POST http://localhost:3000/api/ad-data/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"taskType": "product_analytics", "days": 30}'

【方式3】数据库直接操作：
```sql
-- 通过PostgreSQL直接创建表
psql 'postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst' -f sql/product_analytics2_schema.sql
```

EOF

echo "🎯 快速启动："
echo "1. 进入同步目录：cd sync_saihu_erp/data_update"
echo "2. 启动同步：python3 sync_now.py"
echo "3. 验证数据：psql 'postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst'"