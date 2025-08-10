/**
 * AI分析结果展示组件
 * 展示AI智能体生成的分析报告和行动建议
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Copy, Download, Star, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { AIAnalysisResult } from '@/types/ai-analysis';
import { InventoryPoint } from '@/types/inventory-view';
import { toast } from 'sonner';
import Markdown from '@/components/markdown';

interface AnalysisResultProps {
  result: AIAnalysisResult;
  inventoryPoint: InventoryPoint;
  onRating?: (rating: number, feedback?: string) => void;
}

export function AnalysisResult({ result, inventoryPoint, onRating }: AnalysisResultProps) {
  const [rating, setRating] = useState<number>(0);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);

  // 解析分析内容，尽量提取“分析”段；若未命中则回退为全文
  const parseAnalysisContent = (content: string) => {
    let analysisSection = '';
    let actionSection = '';

    // 情况1：Markdown 标题
    const mdSections = content.split(/##\s*(分析|行动)/);
    if (mdSections.length > 1) {
      for (let i = 1; i < mdSections.length; i += 2) {
        const t = mdSections[i];
        const c = mdSections[i + 1] || '';
        if (t === '分析') analysisSection = c.trim();
        if (t === '行动') actionSection = c.trim();
      }
    }

    // 情况2：中文“分析：/行动：”标签
    if (!analysisSection) {
      const aIdx = content.indexOf('分析：');
      if (aIdx !== -1) {
        const rest = content.slice(aIdx + 3);
        const eIdx = rest.indexOf('行动：');
        analysisSection = (eIdx !== -1 ? rest.slice(0, eIdx) : rest).trim();
        actionSection = eIdx !== -1 ? rest.slice(eIdx + 3).trim() : '';
      }
    }

    // 情况3：均未命中，使用全文
    if (!analysisSection) analysisSection = content.trim();
    return { analysisSection, actionSection };
  };

  const { analysisSection, actionSection } = parseAnalysisContent(result.analysis_content);

  // 注：页面只展示“深度分析”，不再显示行动计划/智能建议

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


      {/* 仅展示“深度分析”单页 */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            运营分析报告
          </div>
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
        <Card>
          <CardContent>
            <ScrollArea className="h-64 w-full">
              <div className="p-4 rounded-lg bg-accent/40">
                <Markdown content={result.analysis_content || '暂无分析内容'} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>


    </div>
  );
}