'use client';

import { useMemo } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { useState } from 'react';

interface DistributionData {
  marketplace: string;
  pointCount: number;
  inventory: number;
  dailySales: number;
  adSpend: number;
  averageMetrics: {
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    ctr: number;
    cvr: number;
    cpc: number;
    roas: number;
    acoas: number;
  };
}

interface AdDistributionChartProps {
  data: DistributionData[];
  height?: number;
  className?: string;
}

export function AdDistributionChart({
  data,
  height = 400,
  className = '',
}: AdDistributionChartProps) {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [metricType, setMetricType] = useState<'pointCount' | 'inventory' | 'dailySales' | 'adSpend'>('pointCount');

  // 颜色配置
  const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
    '#8884D8', '#82CA9D', '#FFC658', '#FF7300',
    '#00D4AA', '#FF6B6B', '#4ECDC4', '#45B7D1'
  ];

  // 处理图表数据
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item, index) => ({
      ...item,
      color: COLORS[index % COLORS.length],
      value: item[metricType],
      percentage: 0, // 将在下面计算
    }));
  }, [data, metricType]);

  // 计算百分比
  const chartDataWithPercentage = useMemo(() => {
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) return chartData;

    return chartData.map(item => ({
      ...item,
      percentage: ((item.value / total) * 100),
    }));
  }, [chartData]);

  // 指标配置
  const metricConfigs = {
    pointCount: { label: '库存点数量', format: 'number', unit: '个' },
    inventory: { label: '总库存', format: 'number', unit: '件' },
    dailySales: { label: '日均销售额', format: 'currency', unit: '' },
    adSpend: { label: '广告花费', format: 'currency', unit: '' },
  };

  // 格式化数值
  const formatValue = (value: number, format: string): string => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString()}`;
      case 'number':
        if (value >= 1000000) {
          return `${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}K`;
        }
        return value.toLocaleString();
      default:
        return value.toString();
    }
  };

  // 自定义饼图Tooltip
  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const config = metricConfigs[metricType];

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{data.marketplace}</p>
        <div className="space-y-1">
          <p className="text-sm">
            {config.label}: <span className="font-medium">{formatValue(data.value, config.format)}{config.unit}</span>
          </p>
          <p className="text-sm">
            占比: <span className="font-medium">{data.percentage.toFixed(1)}%</span>
          </p>
          <p className="text-sm text-gray-600">
            广告点击率: {data.averageMetrics.ctr.toFixed(2)}%
          </p>
          <p className="text-sm text-gray-600">
            ROAS: {data.averageMetrics.roas.toFixed(2)}
          </p>
        </div>
      </div>
    );
  };

  // 自定义柱状图Tooltip
  const BarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const config = metricConfigs[metricType];

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-sm">
            {config.label}: <span className="font-medium">{formatValue(data.value, config.format)}{config.unit}</span>
          </p>
          <p className="text-sm text-gray-600">
            库存点: {data.pointCount}个
          </p>
          <p className="text-sm text-gray-600">
            广告花费: ${data.adSpend.toLocaleString()}
          </p>
        </div>
      </div>
    );
  };

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">暂无分布数据</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">市场分布分析</CardTitle>
          
          <div className="flex items-center space-x-2">
            {/* 图表类型切换 */}
            <div className="flex border rounded-md">
              <Button
                variant={chartType === 'pie' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('pie')}
                className="rounded-r-none"
              >
                <PieChartIcon className="h-4 w-4 mr-1" />
                饼图
              </Button>
              <Button
                variant={chartType === 'bar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('bar')}
                className="rounded-l-none"
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                柱图
              </Button>
            </div>
            
            {/* 指标选择 */}
            <Select value={metricType} onValueChange={(value: any) => setMetricType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(metricConfigs).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* 统计摘要 */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-gray-600">总市场数:</span>
            <Badge variant="outline">{data.length}个</Badge>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-gray-600">总库存点:</span>
            <Badge variant="outline">
              {data.reduce((sum, item) => sum + item.pointCount, 0)}个
            </Badge>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-gray-600">总广告花费:</span>
            <Badge variant="outline">
              ${data.reduce((sum, item) => sum + item.adSpend, 0).toLocaleString()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 主图表区域 */}
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={height}>
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={chartDataWithPercentage}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ marketplace, percentage }) => 
                      percentage > 5 ? `${marketplace} ${percentage.toFixed(1)}%` : ''
                    }
                    outerRadius={Math.min(height * 0.35, 120)}
                    dataKey="value"
                  >
                    {chartDataWithPercentage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              ) : (
                <BarChart data={chartDataWithPercentage} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="marketplace" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatValue(value, metricConfigs[metricType].format)}
                  />
                  <Tooltip content={<BarTooltip />} />
                  <Bar 
                    dataKey="value" 
                    fill="#8884d8"
                    radius={[4, 4, 0, 0]}
                  >
                    {chartDataWithPercentage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          
          {/* 详细信息列表 */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 mb-3">市场详情</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {chartDataWithPercentage
                .sort((a, b) => b.value - a.value)
                .map((item, index) => (
                  <div key={item.marketplace} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <p className="font-medium text-sm">{item.marketplace}</p>
                        <p className="text-xs text-gray-500">
                          {item.pointCount}个库存点
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        {formatValue(item.value, metricConfigs[metricType].format)}
                        {metricConfigs[metricType].unit}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
        
        {/* 性能指标对比 */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-medium text-gray-900 mb-4">广告效果对比</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {chartDataWithPercentage
              .sort((a, b) => b.averageMetrics.roas - a.averageMetrics.roas)
              .slice(0, 3)
              .map((item, index) => (
                <div key={item.marketplace} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{item.marketplace}</span>
                    <Badge variant={index === 0 ? 'default' : 'outline'} className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">ROAS:</span>
                      <span className="font-medium">{item.averageMetrics.roas.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">CTR:</span>
                      <span className="font-medium">{item.averageMetrics.ctr.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ACOAS:</span>
                      <span className="font-medium">{item.averageMetrics.acoas.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}