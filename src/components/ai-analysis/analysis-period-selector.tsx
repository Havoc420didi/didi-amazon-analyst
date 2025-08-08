/**
 * AI分析周期选择器组件
 * 支持选择单日分析或多日聚合分析
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { 
  Calendar,
  TrendingUp,
  BarChart3,
  Target,
  Clock,
  Info,
  Settings
} from 'lucide-react';
import { AnalysisPeriod } from '@/types/ai-analysis';

interface AnalysisPeriodSelectorProps {
  onPeriodChange: (period: AnalysisPeriod) => void;
  defaultPeriod?: AnalysisPeriod;
  className?: string;
}

const PRESET_PERIODS = [
  { 
    days: 1, 
    label: '今日分析', 
    description: '基于最新单日数据', 
    icon: Target,
    badge: '实时'
  },
  { 
    days: 3, 
    label: '3日分析', 
    description: '短期趋势观察', 
    icon: TrendingUp,
    badge: '趋势'
  },
  { 
    days: 7, 
    label: '7日分析', 
    description: '一周运营表现', 
    icon: BarChart3,
    badge: '周报'
  },
  { 
    days: 14, 
    label: '14日分析', 
    description: '双周深度分析', 
    icon: Calendar,
    badge: '深度'
  },
  { 
    days: 30, 
    label: '30日分析', 
    description: '月度综合评估', 
    icon: Clock,
    badge: '月报'
  }
];

const AGGREGATION_METHODS = [
  {
    value: 'average' as const,
    label: '平均值',
    description: '计算期间内指标的平均值，适合日常运营分析',
    icon: TrendingUp,
    recommended: ['销售数据', '广告效果']
  },
  {
    value: 'latest' as const,
    label: '最新值',
    description: '使用最近一天的数据，保持数据时效性',
    icon: Target,
    recommended: ['库存状态', '即时决策']
  },
  {
    value: 'sum' as const,
    label: '累积值',
    description: '计算期间内的累积总量，适合评估总体表现',
    icon: BarChart3,
    recommended: ['总销量', '总支出']
  },
  {
    value: 'trend' as const,
    label: '趋势加权',
    description: '近期数据权重更高，捕捉最新变化趋势',
    icon: TrendingUp,
    recommended: ['趋势分析', '变化监控']
  }
];

export function AnalysisPeriodSelector({ 
  onPeriodChange, 
  defaultPeriod,
  className 
}: AnalysisPeriodSelectorProps) {
  const [selectedType, setSelectedType] = useState<'single_day' | 'multi_day'>(
    defaultPeriod?.type || 'single_day'
  );
  const [selectedDays, setSelectedDays] = useState(defaultPeriod?.days || 1);
  const [selectedMethod, setSelectedMethod] = useState<'average' | 'sum' | 'latest' | 'trend'>(
    defaultPeriod?.aggregation_method || 'average'
  );
  const [endDate, setEndDate] = useState(
    defaultPeriod?.end_date || new Date().toISOString().split('T')[0]
  );

  // 处理周期变化
  const handlePeriodChange = (type: 'single_day' | 'multi_day', days: number, method?: 'average' | 'sum' | 'latest' | 'trend') => {
    const period: AnalysisPeriod = {
      type,
      days,
      end_date: endDate,
      aggregation_method: method || selectedMethod
    };
    
    setSelectedType(type);
    setSelectedDays(days);
    if (method) setSelectedMethod(method);
    
    onPeriodChange(period);
  };

  // 处理聚合方法变化
  const handleMethodChange = (method: 'average' | 'sum' | 'latest' | 'trend') => {
    setSelectedMethod(method);
    handlePeriodChange(selectedType, selectedDays, method);
  };

  // 处理结束日期变化
  const handleEndDateChange = (date: string) => {
    setEndDate(date);
    const period: AnalysisPeriod = {
      type: selectedType,
      days: selectedDays,
      end_date: date,
      aggregation_method: selectedMethod
    };
    onPeriodChange(period);
  };

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            分析周期配置
          </CardTitle>
          <CardDescription>
            选择分析的时间范围和数据聚合方式，不同配置适用于不同的分析场景
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* 周期类型选择 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">分析类型</Label>
            <RadioGroup
              value={selectedType}
              onValueChange={(value: 'single_day' | 'multi_day') => {
                setSelectedType(value);
                const newDays = value === 'single_day' ? 1 : selectedDays;
                handlePeriodChange(value, newDays);
              }}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="single_day" id="single_day" className="peer sr-only" />
                <Label
                  htmlFor="single_day"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Target className="mb-3 h-6 w-6" />
                  <div className="text-center">
                    <div className="font-medium">单日分析</div>
                    <div className="text-xs text-muted-foreground mt-1">基于最新数据的即时分析</div>
                  </div>
                </Label>
              </div>
              
              <div>
                <RadioGroupItem value="multi_day" id="multi_day" className="peer sr-only" />
                <Label
                  htmlFor="multi_day"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <BarChart3 className="mb-3 h-6 w-6" />
                  <div className="text-center">
                    <div className="font-medium">多日聚合</div>
                    <div className="text-xs text-muted-foreground mt-1">基于历史数据的深度分析</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 天数选择 */}
          {selectedType === 'multi_day' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">分析周期</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESET_PERIODS.filter(p => p.days > 1).map((period) => {
                  const Icon = period.icon;
                  const isSelected = selectedDays === period.days;
                  
                  return (
                    <Tooltip key={period.days}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePeriodChange(selectedType, period.days)}
                          className="flex flex-col items-center gap-1 h-auto py-3"
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-xs">{period.label}</span>
                          <Badge variant="secondary" className="text-xs px-1">
                            {period.badge}
                          </Badge>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{period.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              
              {/* 自定义天数 */}
              <div className="flex items-center gap-2">
                <Label htmlFor="custom-days" className="text-sm whitespace-nowrap">
                  自定义:
                </Label>
                <Input
                  id="custom-days"
                  type="number"
                  min="2"
                  max="30"
                  value={selectedDays}
                  onChange={(e) => {
                    const days = parseInt(e.target.value) || 2;
                    setSelectedDays(days);
                    handlePeriodChange(selectedType, days);
                  }}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">天</span>
              </div>
            </div>
          )}

          {/* 聚合方法选择 */}
          {selectedType === 'multi_day' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">数据聚合方式</Label>
              <Select value={selectedMethod} onValueChange={handleMethodChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATION_METHODS.map((method) => {
                    const Icon = method.icon;
                    return (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{method.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {method.description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              {/* 推荐使用场景 */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium mb-1">推荐用于:</div>
                    <div className="text-muted-foreground">
                      {AGGREGATION_METHODS.find(m => m.value === selectedMethod)?.recommended.join('、')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  {selectedType === 'single_day' ? '单日分析' : `${selectedDays}日聚合分析`}
                </span>
              </div>
              {selectedType === 'multi_day' && (
                <div>
                  <span className="text-muted-foreground">聚合方式: </span>
                  <span className="font-medium">
                    {AGGREGATION_METHODS.find(m => m.value === selectedMethod)?.label}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">数据范围: </span>
                <span className="font-medium">
                  {selectedType === 'single_day' 
                    ? `${endDate} 当日`
                    : `${new Date(new Date(endDate).getTime() - (selectedDays - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} 至 ${endDate}`
                  }
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}