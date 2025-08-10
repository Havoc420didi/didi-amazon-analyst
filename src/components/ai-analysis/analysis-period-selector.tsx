/**
 * AI分析周期选择器组件（精简版）
 * 仅支持单日分析配置：选择分析截止日期并展示配置摘要
 */

'use client';

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calendar, Target, Settings } from 'lucide-react';
import { AnalysisPeriod } from '@/types/ai-analysis';

interface AnalysisPeriodSelectorProps {
  onPeriodChange: (period: AnalysisPeriod) => void;
  defaultPeriod?: AnalysisPeriod;
  className?: string;
}

// 单日分析固定配置
const DEFAULT_METHOD = 'latest' as const;
const FIXED_DAYS = 1 as const;

export function AnalysisPeriodSelector({ 
  onPeriodChange, 
  defaultPeriod,
  className 
}: AnalysisPeriodSelectorProps) {
  // 固定为单日分析
  const selectedType = 'single_day' as const;
  const selectedDays = FIXED_DAYS;
  const selectedMethod = DEFAULT_METHOD;
  const [endDate, setEndDate] = useState(
    defaultPeriod?.end_date || new Date().toISOString().split('T')[0]
  );

  // 处理周期变化（精简为固定单日配置）
  const notifyChange = (date: string) => {
    const period: AnalysisPeriod = {
      type: 'single_day',
      days: FIXED_DAYS,
      end_date: date,
      aggregation_method: DEFAULT_METHOD
    };
    onPeriodChange(period);
  };

  // 处理结束日期变化
  const handleEndDateChange = (date: string) => {
    setEndDate(date);
    notifyChange(date);
  };

  return (
    <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            分析周期配置
          </CardTitle>
          <CardDescription>
            选择分析的时间范围（当前仅支持单日分析）
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* 分析类型（固定为单日分析） */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">分析类型</Label>
            <div className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4">
              <Target className="mb-3 h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">单日分析</div>
                <div className="text-xs text-muted-foreground mt-1">基于最新数据的即时分析</div>
              </div>
            </div>
          </div>

          {/* 结束日期选择 */}
          <div className="space-y-3">
            <Label htmlFor="end-date" className="text-sm font-medium">
              分析截止日期
            </Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full"
            />
          </div>

          {/* 分析配置摘要 */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">分析配置摘要</span>
            </div>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">类型: </span>
                <span className="font-medium">
                  单日分析
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">数据范围: </span>
                <span className="font-medium">
                  {`${endDate} 当日`}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}