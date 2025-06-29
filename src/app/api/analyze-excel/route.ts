import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";

// 定义分析结果的结构
const analysisSchema = z.object({
  summary: z.string().describe("分析总结，简要描述数据的整体情况"),
  insights: z.array(z.object({
    type: z.enum(["positive", "negative", "warning", "info"]).describe("洞察类型"),
    title: z.string().describe("洞察标题"),
    description: z.string().describe("洞察描述"),
    value: z.string().optional().describe("相关数值或指标")
  })).describe("关键洞察列表"),
  recommendations: z.array(z.object({
    priority: z.enum(["high", "medium", "low"]).describe("优先级"),
    category: z.string().describe("建议类别"),
    title: z.string().describe("建议标题"),
    description: z.string().describe("详细建议"),
    impact: z.string().describe("预期影响")
  })).describe("优化建议列表")
});

// 数据分析辅助函数
function analyzeDataStructure(headers: string[], data: any[][]): string {
  const analysis = {
    totalRows: data.length,
    totalColumns: headers.length,
    dataTypes: {} as Record<string, string>,
    missingData: {} as Record<string, number>,
    sampleData: data.slice(0, 5)
  };

  // 分析每列的数据类型和缺失情况
  headers.forEach((header, index) => {
    const columnData = data.map(row => row[index]).filter(val => val != null && val !== "");
    const totalNonNull = columnData.length;
    const missingCount = data.length - totalNonNull;
    
    analysis.missingData[header] = missingCount;

    // 简单的数据类型检测
    if (totalNonNull > 0) {
      const firstValue = columnData[0];
      if (typeof firstValue === "number" || !isNaN(Number(firstValue))) {
        analysis.dataTypes[header] = "numeric";
      } else if (header.toLowerCase().includes("date") || header.toLowerCase().includes("time")) {
        analysis.dataTypes[header] = "datetime";
      } else {
        analysis.dataTypes[header] = "text";
      }
    }
  });

  return JSON.stringify(analysis, null, 2);
}

// 生成示例图表数据
function generateChartData(headers: string[], data: any[][]): any[] {
  const charts = [];

  // 查找数值列
  const numericColumns = headers.filter((header, index) => {
    const columnData = data.slice(0, 10).map(row => row[index]);
    return columnData.some(val => !isNaN(Number(val)) && val != null);
  });

  // 查找分类列
  const categoryColumns = headers.filter((header, index) => {
    const columnData = data.slice(0, 10).map(row => row[index]);
    return columnData.some(val => isNaN(Number(val)) && val != null);
  });

  // 生成趋势图（如果有日期列）
  const dateColumns = headers.filter(header => 
    header.toLowerCase().includes("date") || header.toLowerCase().includes("time")
  );

  if (dateColumns.length > 0 && numericColumns.length > 0) {
    const dateIndex = headers.indexOf(dateColumns[0]);
    const valueIndex = headers.indexOf(numericColumns[0]);
    
    const trendData = data.slice(0, 10).map(row => ({
      name: row[dateIndex] || "N/A",
      value: Number(row[valueIndex]) || 0
    }));

    charts.push({
      type: "line",
      title: `${numericColumns[0]} 趋势分析`,
      data: trendData
    });
  }

  // 生成分类统计图
  if (categoryColumns.length > 0 && numericColumns.length > 0) {
    const categoryIndex = headers.indexOf(categoryColumns[0]);
    const valueIndex = headers.indexOf(numericColumns[0]);
    
    const categoryStats: Record<string, number> = {};
    data.slice(0, 20).forEach(row => {
      const category = row[categoryIndex]?.toString() || "未知";
      const value = Number(row[valueIndex]) || 0;
      categoryStats[category] = (categoryStats[category] || 0) + value;
    });

    const barData = Object.entries(categoryStats).map(([name, value]) => ({
      name: name.length > 10 ? name.substring(0, 10) + "..." : name,
      value
    }));

    charts.push({
      type: "bar",
      title: `${categoryColumns[0]} 分类统计`,
      data: barData.slice(0, 8) // 限制显示数量
    });
  }

  return charts;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, headers, filename } = body;

    if (!data || !headers || !Array.isArray(data) || !Array.isArray(headers)) {
      return NextResponse.json({ error: "无效的数据格式" }, { status: 400 });
    }

    // 分析数据结构
    const dataStructure = analyzeDataStructure(headers, data);
    
    // 生成样本数据用于AI分析
    const sampleData = data.slice(0, 20);
    const sampleWithHeaders = [headers, ...sampleData];

    // 构建AI分析提示
    const analysisPrompt = `
作为一名专业的亚马逊数据分析师，请分析以下Excel数据并提供专业的洞察和建议。

文件名: ${filename}
数据结构: ${dataStructure}

数据样本 (前20行):
${JSON.stringify(sampleWithHeaders, null, 2)}

请从以下角度进行分析:
1. 销售表现和趋势
2. 产品竞争力
3. 库存管理
4. 广告效果 (如有相关数据)
5. 客户满意度 (如有评价数据)
6. 财务指标

请提供:
- 数据的整体分析总结
- 3-6个关键洞察 (包含正面、负面、警告等不同类型)
- 3-8个具体的优化建议 (按优先级排序)

注意：
- 洞察要具体、可行，避免泛泛而谈
- 建议要结合亚马逊平台特点
- 考虑数据的完整性和可信度
- 用中文回答
`;

    // 调用AI进行分析
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: analysisSchema,
      prompt: analysisPrompt,
      temperature: 0.7,
    });

    // 生成图表数据
    const charts = generateChartData(headers, data);

    const response = {
      ...result.object,
      charts
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("AI分析错误:", error);
    
    // 如果AI分析失败，返回基本的统计分析
    const fallbackAnalysis = {
      summary: "数据已成功加载，包含多个维度的亚马逊运营数据。由于AI服务暂时不可用，请手动查看数据预览进行初步分析。",
      insights: [
        {
          type: "info" as const,
          title: "数据完整性",
          description: "数据文件已成功解析，可以进行进一步的手动分析",
          value: "数据加载成功"
        },
        {
          type: "warning" as const,
          title: "AI分析服务",
          description: "AI智能分析服务暂时不可用，建议稍后重试或联系技术支持",
        }
      ],
      recommendations: [
        {
          priority: "medium" as const,
          category: "系统",
          title: "重试AI分析",
          description: "稍后重新尝试AI分析功能，或检查网络连接",
          impact: "获得更深入的数据洞察和专业建议"
        }
      ],
      charts: []
    };

    return NextResponse.json(fallbackAnalysis);
  }
}