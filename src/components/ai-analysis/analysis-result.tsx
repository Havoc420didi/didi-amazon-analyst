/**
 * AI分析结果展示组件
 * 展示AI智能体生成的分析报告和行动建议
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Copy,
  Download,
  Star,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Package,
  Target,
  DollarSign,
  Clock
} from 'lucide-react';
import { AIAnalysisResult } from '@/types/ai-analysis';
import { InventoryPoint } from '@/types/inventory';
import { toast } from 'sonner';

interface AnalysisResultProps {
  result: AIAnalysisResult;
  inventoryPoint: InventoryPoint;
  onRating?: (rating: number, feedback?: string) => void;
}

export function AnalysisResult({ result, inventoryPoint, onRating }: AnalysisResultProps) {
  const [rating, setRating] = useState<number>(0);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);

  // 解析分析内容，分离"分析"和"行动"部分
  const parseAnalysisContent = (content: string) => {
    const sections = content.split(/## (分析|行动)/);
    
    let analysisSection = '';
    let actionSection = '';
    
    for (let i = 1; i < sections.length; i += 2) {
      const sectionTitle = sections[i];
      const sectionContent = sections[i + 1] || '';
      
      if (sectionTitle === '分析') {
        analysisSection = sectionContent.trim();
      } else if (sectionTitle === '行动') {
        actionSection = sectionContent.trim();
      }
    }
    
    return { analysisSection, actionSection };
  };

  const { analysisSection, actionSection } = parseAnalysisContent(result.analysis_content);

  // 提取行动项目
  const extractActionItems = (actionText: string): string[] => {
    const lines = actionText.split('\n').filter(line => line.trim());
    return lines.filter(line => /^\d+\./.test(line.trim()))
                .map(line => line.replace(/^\d+\.\s*/, '').trim());
  };

  const actionItems = extractActionItems(actionSection);

  // 获取风险等级显示
  const getRiskLevelDisplay = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return { color: 'destructive', icon: AlertCircle, text: '高风险', bgColor: 'bg-red-50' };
      case 'medium':
        return { color: 'warning', icon: TrendingDown, text: '中等风险', bgColor: 'bg-yellow-50' };
      case 'low':
        return { color: 'success', icon: CheckCircle2, text: '低风险', bgColor: 'bg-green-50' };
    }
  };

  const riskDisplay = getRiskLevelDisplay(result.recommendations.risk_level);
  const RiskIcon = riskDisplay.icon;

  // 复制内容到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.analysis_content);
      toast.success('分析内容已复制到剪贴板');
    } catch (error) {
      toast.error('复制失败');
    }
  };

  // 下载分析报告
  const handleDownload = () => {
    const content = `# AI分析报告\n\n` +
                   `**产品**: ${inventoryPoint.productName}\n` +
                   `**ASIN**: ${inventoryPoint.asin}\n` +
                   `**库存点**: ${inventoryPoint.marketplace}\n` +
                   `**业务员**: ${inventoryPoint.salesPerson}\n` +
                   `**分析时间**: ${new Date().toLocaleString('zh-CN')}\n\n` +
                   `---\n\n${result.analysis_content}`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI分析报告_${inventoryPoint.asin}_${inventoryPoint.marketplace}_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('分析报告已下载');
  };

  // 提交评分
  const handleRatingSubmit = (selectedRating: number) => {
    setRating(selectedRating);
    setIsRatingSubmitted(true);
    onRating?.(selectedRating);
    toast.success(`感谢您的${selectedRating}星评价！`);
  };

  return (
    <div className="space-y-6">
      {/* 分析概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              处理时间
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(result.processing_time / 1000).toFixed(1)}s</div>
            <p className="text-xs text-muted-foreground">智能体分析耗时</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              风险等级
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <RiskIcon className="h-5 w-5" />
              <Badge variant={riskDisplay.color as any}>{riskDisplay.text}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              行动建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{actionItems.length}</div>
            <p className="text-xs text-muted-foreground">条具体建议</p>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <Tabs defaultValue="analysis" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="analysis">深度分析</TabsTrigger>
            <TabsTrigger value="actions">行动计划</TabsTrigger>
            <TabsTrigger value="recommendations">智能建议</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              复制
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              下载
            </Button>
          </div>
        </div>

        {/* 深度分析 */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                运营分析报告
              </CardTitle>
              <CardDescription>
                基于AI智能体的深度分析，识别当前运营状况和主要矛盾
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {analysisSection || '暂无分析内容'}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 行动计划 */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                行动执行计划
              </CardTitle>
              <CardDescription>
                基于业务规则验证的具体可执行建议
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {actionItems.length > 0 ? (
                  actionItems.map((action, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 text-sm">{action}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">暂无行动建议</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 智能建议 */}
        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid gap-4">
            {/* 库存操作 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  库存管理建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.recommendations.inventory_action}</p>
              </CardContent>
            </Card>

            {/* 销售策略 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  销售策略建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.recommendations.sales_strategy}</p>
              </CardContent>
            </Card>

            {/* 广告优化 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  广告优化建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.recommendations.ad_optimization}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      {/* 评分区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">分析质量评价</CardTitle>
          <CardDescription>
            您对这次AI分析的满意程度如何？您的反馈有助于我们改进智能体性能。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isRatingSubmitted ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">评分：</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRatingSubmit(star)}
                  className="transition-colors hover:text-yellow-500"
                >
                  <Star 
                    className={`h-6 w-6 ${star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
                  />
                </button>
              ))}
            </div>
          ) : (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                感谢您的{rating}星评价！您的反馈已记录，将帮助我们持续优化AI分析质量。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}