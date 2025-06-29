"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Download,
  BarChart3,
  PieChart,
  LineChart
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, LineChart as RechartsLineChart, Line } from "recharts";
import { useTranslations } from "next-intl";

interface AnalysisResult {
  summary: string;
  insights: {
    type: "positive" | "negative" | "warning" | "info";
    title: string;
    description: string;
    value?: string;
  }[];
  recommendations: {
    priority: "high" | "medium" | "low";
    category: string;
    title: string;
    description: string;
    impact: string;
  }[];
  charts?: {
    type: "bar" | "pie" | "line";
    title: string;
    data: any[];
  }[];
}

interface AnalysisResultsProps {
  result: AnalysisResult;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export function AnalysisResults({ result }: AnalysisResultsProps) {
  const t = useTranslations("analysis.analysis_results");
  const getInsightIcon = (type: string) => {
    switch (type) {
      case "positive":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "negative":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case "positive":
        return "border-green-200 bg-green-50";
      case "negative":
        return "border-red-200 bg-red-50";
      case "warning":
        return "border-yellow-200 bg-yellow-50";
      default:
        return "border-blue-200 bg-blue-50";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  const renderChart = (chart: any) => {
    switch (chart.type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <RechartsPieChart data={chart.data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value">
                {chart.data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </RechartsPieChart>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLineChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
            </RechartsLineChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  const exportResults = () => {
    const content = `
# ${t("export.title")}

## ${t("export.summary_title")}
${result.summary}

## ${t("export.insights_title")}
${result.insights.map(insight => `
### ${insight.title}
${insight.description}
${insight.value ? `${t("export.value_label")}: ${insight.value}` : ""}
`).join("")}

## ${t("export.recommendations_title")}
${result.recommendations.map(rec => `
### ${rec.title} (${t(`priority.${rec.priority}`)}${t("priority_suffix")})
**${t("export.category_label")}**: ${rec.category}
**${t("export.description_label")}**: ${rec.description}
**${t("export.impact_label")}**: ${rec.impact}
`).join("")}

---
${t("export.generated_time")}: ${new Date().toLocaleString()}
    `;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amazon-analysis-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 分析总结 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>{t("analysis_summary")}</span>
            </CardTitle>
            <Button onClick={exportResults} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              {t("export_report")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            {result.summary}
          </p>
        </CardContent>
      </Card>

      {/* 关键洞察 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("key_insights")}</CardTitle>
          <CardDescription>{t("key_insights_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {result.insights.map((insight, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
              >
                <div className="flex items-start space-x-3">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {insight.description}
                    </p>
                    {insight.value && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {insight.value}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 可视化图表 */}
      {result.charts && result.charts.length > 0 && (
        <div className="grid gap-6">
          {result.charts.map((chart, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  {chart.type === "bar" && <BarChart3 className="h-5 w-5" />}
                  {chart.type === "pie" && <PieChart className="h-5 w-5" />}
                  {chart.type === "line" && <LineChart className="h-5 w-5" />}
                  <span>{chart.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderChart(chart)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 优化建议 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("optimization_suggestions")}</CardTitle>
          <CardDescription>{t("optimization_suggestions_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {result.recommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{rec.title}</h4>
                  <Badge variant={getPriorityColor(rec.priority) as any}>
                    {t(`priority.${rec.priority}`)}{t("priority_suffix")}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  <span className="font-medium">{t("category")}:</span> {rec.category}
                </div>
                <p className="text-sm mb-3">{rec.description}</p>
                <Separator className="my-2" />
                <div className="text-sm">
                  <span className="font-medium text-green-600">{t("expected_impact")}:</span>
                  <span className="ml-2">{rec.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}