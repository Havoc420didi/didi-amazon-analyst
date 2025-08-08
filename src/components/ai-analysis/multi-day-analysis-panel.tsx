'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, BarChart3, Target, Calendar, Clock, TrendingUp } from 'lucide-react';
import { AnalysisTrigger } from './analysis-trigger';
import { AnalysisPeriodSelector } from './analysis-period-selector';
import { AnalysisPeriod } from '@/types/ai-analysis';
import { InventoryPoint } from '@/types/inventory';

interface MultiDayAnalysisPanelProps {
  inventoryPoint: InventoryPoint;
}

export function MultiDayAnalysisPanel({ inventoryPoint }: MultiDayAnalysisPanelProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<AnalysisPeriod>({
    type: 'single_day',
    days: 1,
    end_date: new Date().toISOString().split('T')[0],
    aggregation_method: 'latest'
  });

  const [showPeriodSelector, setShowPeriodSelector] = useState(false);

  // 快速选择处理函数
  const handleQuickSelect = (days: number, type: 'single_day' | 'multi_day' = 'multi_day') => {
    const period: AnalysisPeriod = {
      type,
      days,
      end_date: new Date().toISOString().split('T')[0],
      aggregation_method: type === 'single_day' ? 'latest' : 'average'
    };
    setSelectedPeriod(period);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          多日AI智能分析
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          基于历史数据的深度AI分析，支持多种时间维度和聚合方式
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：分析周期配置 */}
          <div>
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              分析配置
            </h4>
            <div className="space-y-4">
              {/* 快速选择按钮 */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">快速选择</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button
                    variant={selectedPeriod.type === 'single_day' ? "default" : "outline"}
                    size="sm"
                    className="flex flex-col items-center gap-1 h-auto py-3"
                    onClick={() => handleQuickSelect(1, 'single_day')}
                  >
                    <Target className="h-4 w-4" />
                    <span className="text-xs">单日</span>
                    <Badge variant="secondary" className="text-xs px-1">实时</Badge>
                  </Button>
                  <Button
                    variant={selectedPeriod.type === 'multi_day' && selectedPeriod.days === 3 ? "default" : "outline"}
                    size="sm"
                    className="flex flex-col items-center gap-1 h-auto py-3"
                    onClick={() => handleQuickSelect(3)}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">3日</span>
                    <Badge variant="secondary" className="text-xs px-1">趋势</Badge>
                  </Button>
                  <Button
                    variant={selectedPeriod.type === 'multi_day' && selectedPeriod.days === 7 ? "default" : "outline"}
                    size="sm"
                    className="flex flex-col items-center gap-1 h-auto py-3"
                    onClick={() => handleQuickSelect(7)}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-xs">7日</span>
                    <Badge variant="secondary" className="text-xs px-1">周报</Badge>
                  </Button>
                  <Button
                    variant={selectedPeriod.type === 'multi_day' && selectedPeriod.days === 30 ? "default" : "outline"}
                    size="sm"
                    className="flex flex-col items-center gap-1 h-auto py-3"
                    onClick={() => handleQuickSelect(30)}
                  >
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs">30日</span>
                    <Badge variant="secondary" className="text-xs px-1">月报</Badge>
                  </Button>
                </div>
              </div>

              {/* 高级配置按钮 */}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPeriodSelector(!showPeriodSelector)}
                  className="w-full"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {showPeriodSelector ? '隐藏高级配置' : '显示高级配置'}
                </Button>
              </div>

              {/* 高级配置面板 */}
              {showPeriodSelector && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <AnalysisPeriodSelector
                    onPeriodChange={setSelectedPeriod}
                    defaultPeriod={selectedPeriod}
                  />
                </div>
              )}

              {/* 聚合方法说明 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">聚合方法说明</h5>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• <strong>平均值</strong>: 计算期间内指标的平均值，适合日常运营分析</p>
                  <p>• <strong>最新值</strong>: 使用最近一天的数据，保持数据时效性</p>
                  <p>• <strong>累积值</strong>: 计算期间内的累积总量，适合评估总体表现</p>
                  <p>• <strong>趋势加权</strong>: 近期数据权重更高，捕捉最新变化趋势</p>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：AI分析触发 */}
          <div>
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              AI分析触发
            </h4>
            <div className="space-y-4">
              {/* 当前配置显示 */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">当前配置</h5>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>• 分析类型: {selectedPeriod.type === 'single_day' ? '单日分析' : `${selectedPeriod.days}日聚合分析`}</p>
                  {selectedPeriod.type === 'multi_day' && (
                    <p>• 聚合方式: {
                      selectedPeriod.aggregation_method === 'average' ? '平均值' :
                      selectedPeriod.aggregation_method === 'latest' ? '最新值' :
                      selectedPeriod.aggregation_method === 'sum' ? '累积值' : '趋势加权'
                    }</p>
                  )}
                  <p>• 截止日期: {selectedPeriod.end_date}</p>
                </div>
              </div>

              {/* 分析触发组件 */}
              <AnalysisTrigger 
                inventoryPoint={inventoryPoint}
                size="lg"
                variant="default"
                className="w-full"
              />
              
              {/* 分析说明 */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h5 className="font-medium text-purple-900 mb-2">多日分析优势</h5>
                <div className="text-sm text-purple-800 space-y-1">
                  <p>• <strong>数据稳定性</strong>: 基于多日数据，减少单日波动影响</p>
                  <p>• <strong>趋势识别</strong>: 更好地识别产品表现趋势</p>
                  <p>• <strong>深度洞察</strong>: 提供更全面的运营建议</p>
                  <p>• <strong>智能聚合</strong>: 自动选择最适合的聚合方式</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 