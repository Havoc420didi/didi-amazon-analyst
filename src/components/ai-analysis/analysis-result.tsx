'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, Clock, Zap, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AnalysisResultProps {
  content: string;
  processingTime?: number;
  tokensUsed?: number;
  createdAt: string;
}

export function AnalysisResult({ 
  content, 
  processingTime, 
  tokensUsed, 
  createdAt 
}: AnalysisResultProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  // 复制内容到剪贴板
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('分析内容已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  // 解析分析内容的各个部分
  const parseAnalysisContent = (text: string) => {
    const sections = [];
    
    // 匹配各个部分
    const currentStatusMatch = text.match(/## 📊 现状分析\s*([\s\S]*?)(?=##|$)/);
    const riskMatch = text.match(/## ⚠️ 风险识别\s*([\s\S]*?)(?=##|$)/);
    const recommendationsMatch = text.match(/## 🎯 核心建议\s*([\s\S]*?)(?=##|$)/);
    const expectedMatch = text.match(/## 📈 预期效果\s*([\s\S]*?)(?=##|$)/);
    const riskLevelMatch = text.match(/## 🚨 风险等级\s*([\s\S]*?)(?=##|$)/);

    if (currentStatusMatch) {
      sections.push({
        title: '📊 现状分析',
        content: currentStatusMatch[1].trim(),
        type: 'analysis'
      });
    }

    if (riskMatch) {
      sections.push({
        title: '⚠️ 风险识别', 
        content: riskMatch[1].trim(),
        type: 'warning'
      });
    }

    if (recommendationsMatch) {
      sections.push({
        title: '🎯 核心建议',
        content: recommendationsMatch[1].trim(),
        type: 'recommendations'
      });
    }

    if (expectedMatch) {
      sections.push({
        title: '📈 预期效果',
        content: expectedMatch[1].trim(),
        type: 'success'
      });
    }

    if (riskLevelMatch) {
      const riskContent = riskLevelMatch[1].trim().toLowerCase();
      let riskLevel = 'medium';
      let riskColor = 'bg-yellow-100 text-yellow-800';
      
      if (riskContent.includes('低风险') || riskContent.includes('low')) {
        riskLevel = '低风险';
        riskColor = 'bg-green-100 text-green-800';
      } else if (riskContent.includes('高风险') || riskContent.includes('high')) {
        riskLevel = '高风险';
        riskColor = 'bg-red-100 text-red-800';
      } else {
        riskLevel = '中风险';
      }

      sections.push({
        title: '🚨 风险等级',
        content: riskLevel,
        type: 'risk',
        riskColor
      });
    }

    return sections;
  };

  // 格式化处理时间
  const formatProcessingTime = (ms?: number) => {
    if (!ms) return '未知';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const sections = parseAnalysisContent(content);

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">AI分析结果</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  展开
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              disabled={copied}
            >
              <Copy className="h-4 w-4 mr-1" />
              {copied ? '已复制' : '复制'}
            </Button>
          </div>
        </div>
        
        {/* 元信息 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(createdAt)}
          </div>
          {processingTime && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatProcessingTime(processingTime)}
            </div>
          )}
          {tokensUsed && (
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {tokensUsed.toLocaleString()} tokens
            </div>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-6">
            {sections.map((section, index) => (
              <div key={index}>
                {index > 0 && <Separator className="my-4" />}
                
                <div className="space-y-3">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    {section.title}
                    {section.type === 'risk' && section.riskColor && (
                      <Badge className={cn('text-xs font-normal', section.riskColor)}>
                        {section.content}
                      </Badge>
                    )}
                  </h3>
                  
                  {section.type !== 'risk' && (
                    <div className={cn(
                      'rounded-lg p-4 text-sm leading-relaxed',
                      section.type === 'analysis' && 'bg-blue-50 border border-blue-200',
                      section.type === 'warning' && 'bg-yellow-50 border border-yellow-200',
                      section.type === 'recommendations' && 'bg-green-50 border border-green-200',
                      section.type === 'success' && 'bg-purple-50 border border-purple-200'
                    )}>
                      {/* 处理建议部分的子标题 */}
                      {section.type === 'recommendations' ? (
                        <div className="space-y-4">
                          {section.content.split(/###\s/).filter(Boolean).map((subsection, subIndex) => {
                            const lines = subsection.trim().split('\n');
                            const title = lines[0];
                            const content = lines.slice(1).join('\n').trim();
                            
                            return (
                              <div key={subIndex} className="space-y-2">
                                <h4 className="font-medium text-green-800">
                                  {title.replace(/[^\w\s\u4e00-\u9fff]/g, '').trim()}
                                </h4>
                                <div className="text-green-700 whitespace-pre-line pl-2 border-l-2 border-green-300">
                                  {content}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="whitespace-pre-line">
                          {section.content}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* 如果没有解析到结构化内容，显示原始内容 */}
            {sections.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-sm leading-relaxed whitespace-pre-line">
                  {content}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}