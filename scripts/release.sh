#!/bin/bash

# Ops Helios v0.1.0 Release Script
# 使用说明: ./scripts/release.sh

set -e

VERSION="v0.1.0"
RELEASE_TITLE="🎉 Ops Helios v0.1.0 - 首次发布"
RELEASE_BODY_FILE="GITHUB_RELEASE_v0.1.0.md"

echo "🚀 开始发布 Ops Helios $VERSION..."

# 检查是否在git仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 错误: 当前目录不是git仓库"
    exit 1
fi

# 检查工作区是否干净
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  警告: 工作区有未提交的更改"
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 发布已取消"
        exit 1
    fi
fi

# 检查是否有发布文档
if [[ ! -f "$RELEASE_BODY_FILE" ]]; then
    echo "❌ 错误: 发布文档 $RELEASE_BODY_FILE 不存在"
    exit 1
fi

echo "📝 准备发布信息..."

# 创建git标签
echo "🏷️  创建标签 $VERSION..."
git tag -a "$VERSION" -m "$RELEASE_TITLE"

# 推送标签到远程仓库
echo "📤 推送标签到远程仓库..."
git push origin "$VERSION"

echo "✅ 标签已创建并推送到远程仓库"

# 如果安装了gh CLI，自动创建release
if command -v gh &> /dev/null; then
    echo "🎯 使用 GitHub CLI 创建 Release..."
    
    # 使用gh创建release
    gh release create "$VERSION" \
        --title "$RELEASE_TITLE" \
        --notes-file "$RELEASE_BODY_FILE" \
        --draft=false \
        --prerelease=false
    
    echo "✅ GitHub Release 已创建: https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/releases/tag/$VERSION"
else
    echo "💡 提示: 安装 GitHub CLI (gh) 可以自动创建 Release"
    echo "   手动创建步骤:"
    echo "   1. 访问: https://github.com/your-username/ops_helios/releases/new"
    echo "   2. 选择标签: $VERSION"
    echo "   3. 发布标题: $RELEASE_TITLE"
    echo "   4. 复制 $RELEASE_BODY_FILE 内容作为发布说明"
fi

echo ""
echo "🎉 发布完成！"
echo "📋 发布总结:"
echo "   • 版本: $VERSION"
echo "   • 标签: 已创建并推送"
echo "   • 发布文档: $RELEASE_BODY_FILE"
echo ""
echo "📖 下一步:"
echo "   • 通知团队成员新版本发布"
echo "   • 更新项目文档"
echo "   • 开始规划 v0.2.0 功能"