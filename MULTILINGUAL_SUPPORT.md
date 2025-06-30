# 🌐 多语言支持说明 / Multilingual Support Guide

## 概述 / Overview

Amazon Analyst 现在提供完整的中英文双语支持，包括产品数据分析页和AI运营决策分析功能。

Amazon Analyst now provides complete bilingual support in Chinese and English, including product data analysis pages and AI operations analysis features.

## 支持的语言 / Supported Languages

- 🇨🇳 **中文 (简体)** - Chinese (Simplified)
- 🇺🇸 **English** - 英语

## 功能覆盖 / Feature Coverage

### ✅ 已完成多语言支持的功能 / Completed Multilingual Features

#### 📊 产品数据分析页 / Product Data Analysis Pages
- **页面标题和导航** / Page titles and navigation
- **产品信息展示** / Product information display
- **库存数据字段** / Inventory data fields
- **销售和广告数据标签** / Sales and advertising data labels
- **数据趋势指示器** / Data trend indicators

#### 🤖 AI运营分析功能 / AI Operations Analysis Features
- **分析启动界面** / Analysis start interface
- **实时流式分析显示** / Real-time streaming analysis display
- **思考过程、深度分析、行动建议** / Thinking process, deep analysis, action recommendations
- **分析状态和进度提示** / Analysis status and progress indicators
- **错误信息和用户通知** / Error messages and user notifications

#### 📋 数据表格组件 / Data Table Components
- **库存数据列表** / Inventory data list
- **搜索和筛选界面** / Search and filter interface
- **分页导航** / Pagination navigation
- **操作按钮** / Action buttons

#### ⭐ 评价和反馈系统 / Rating and Feedback System
- **分析评价界面** / Analysis rating interface
- **反馈表单** / Feedback forms
- **评价等级描述** / Rating scale descriptions
- **提交状态提示** / Submission status indicators

#### 📚 历史分析管理 / Analysis History Management
- **历史记录列表** / History record list
- **详情查看模态框** / Detail view modals
- **删除确认对话框** / Delete confirmation dialogs

### 🔄 语言切换 / Language Switching

系统根据用户浏览器语言自动检测，也可以通过URL参数手动切换：

The system automatically detects user browser language, or can be manually switched via URL parameters:

- **中文**: `http://localhost:3000/zh/inventory/analysis/{asin}`
- **English**: `http://localhost:3000/en/inventory/analysis/{asin}`

## 技术实现 / Technical Implementation

### 🛠️ 使用的技术栈 / Technology Stack

- **next-intl**: 国际化框架 / Internationalization framework
- **TypeScript**: 类型安全的翻译键 / Type-safe translation keys
- **服务端渲染**: 支持SSR的翻译 / SSR-compatible translations
- **客户端渲染**: 交互组件的实时翻译 / Real-time translations for interactive components

### 📁 文件结构 / File Structure

```
src/i18n/
├── messages/
│   ├── zh.json          # 中文翻译文件
│   └── en.json          # 英文翻译文件
├── locale.ts            # 语言配置
├── navigation.ts        # 路由配置
└── request.ts           # 请求配置
```

### 🔑 翻译键结构 / Translation Key Structure

```json
{
  "ai_analysis": {
    "page_title": "产品数据详情",
    "product_info": {
      "title": "产品信息",
      "fields": {
        "asin": "ASIN",
        "product_name": "品名"
      }
    },
    "operations_analysis": {
      "title": "AI运营决策分析",
      "streaming": {
        "thinking_process": "思考过程",
        "deep_analysis": "深度分析"
      }
    }
  }
}
```

## 使用方法 / Usage

### 在服务端组件中 / In Server Components

```typescript
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('ai_analysis');
  
  return (
    <h1>{t('page_title')}</h1>
  );
}
```

### 在客户端组件中 / In Client Components

```typescript
'use client';
import { useTranslations } from 'next-intl';

export function Component() {
  const t = useTranslations('ai_analysis.operations_analysis');
  
  return (
    <button>{t('start_analysis')}</button>
  );
}
```

## 添加新翻译 / Adding New Translations

### 1. 更新翻译文件 / Update Translation Files

在 `src/i18n/messages/zh.json` 和 `src/i18n/messages/en.json` 中添加新的键值对：

Add new key-value pairs in both translation files:

```json
// zh.json
{
  "new_section": {
    "new_key": "新的中文文本"
  }
}

// en.json  
{
  "new_section": {
    "new_key": "New English text"
  }
}
```

### 2. 在组件中使用 / Use in Components

```typescript
const t = useTranslations('new_section');
return <span>{t('new_key')}</span>;
```

## 最佳实践 / Best Practices

### ✅ 推荐做法 / Recommended Practices

1. **层次化组织翻译键** / Organize translation keys hierarchically
2. **使用描述性的键名** / Use descriptive key names
3. **保持中英文翻译同步** / Keep Chinese and English translations in sync
4. **对长文本使用插值** / Use interpolation for long texts with variables
5. **测试所有语言版本** / Test all language versions

### ❌ 避免的做法 / Practices to Avoid

1. **在UI中直接写硬编码文本** / Hardcoding text directly in UI
2. **使用模糊不清的键名** / Using unclear key names
3. **忘记更新某个语言的翻译** / Forgetting to update translations for any language
4. **在翻译文件中使用HTML** / Using HTML in translation files

## 测试多语言功能 / Testing Multilingual Features

### 本地测试 / Local Testing

1. 启动开发服务器 / Start development server:
```bash
pnpm dev
```

2. 访问不同语言版本 / Visit different language versions:
- 中文: http://localhost:3000/zh/inventory
- English: http://localhost:3000/en/inventory

3. 验证功能 / Verify features:
- 页面文本显示正确语言 / Page text displays in correct language
- 交互元素响应正确 / Interactive elements respond correctly
- 错误信息显示对应语言 / Error messages show in corresponding language

## 问题排查 / Troubleshooting

### 常见问题 / Common Issues

1. **翻译键不显示** / Translation keys not displaying
   - 检查键名是否正确 / Check if key names are correct
   - 确认翻译文件语法正确 / Ensure translation file syntax is correct

2. **语言切换不生效** / Language switching not working
   - 检查URL路径是否包含正确的locale / Check if URL path includes correct locale
   - 清除浏览器缓存 / Clear browser cache

3. **部分文本未翻译** / Some text not translated
   - 检查是否使用了useTranslations hook / Check if useTranslations hook is used
   - 确认翻译键在所有语言文件中都存在 / Ensure translation keys exist in all language files

## 未来扩展 / Future Extensions

### 计划支持的功能 / Planned Features

- 🌍 **更多语言支持** / More language support (日本语、Deutsch、Français)
- 🎯 **上下文相关翻译** / Context-aware translations
- 📱 **移动端优化** / Mobile optimization
- 🔄 **实时语言切换** / Real-time language switching
- 📊 **翻译覆盖率监控** / Translation coverage monitoring

---

## 贡献指南 / Contributing Guidelines

如果您想为多语言功能做出贡献，请：

If you'd like to contribute to multilingual features:

1. 确保所有新功能都有对应的翻译 / Ensure all new features have corresponding translations
2. 遵循现有的翻译键命名规范 / Follow existing translation key naming conventions  
3. 测试所有支持的语言 / Test all supported languages
4. 更新此文档以反映新增功能 / Update this documentation to reflect new features

感谢您的贡献！/ Thank you for your contribution!