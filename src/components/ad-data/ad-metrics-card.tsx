'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ReactNode } from 'react';

interface AdMetricsCardProps {
  title: string;
  value: number;
  format: 'number' | 'currency' | 'percentage';
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  description?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function AdMetricsCard({
  title,
  value,
  format,
  icon,
  trend,
  trendValue,
  description,
  className = '',
  size = 'md',
  loading = false,
}: AdMetricsCardProps) {
  
  // 格式化数值显示
  const formatValue = (val: number, fmt: string): string => {
    if (loading || isNaN(val)) return '-';
    
    switch (fmt) {
      case 'currency':
        return `$${val.toLocaleString('en-US', { 
          minimumFractionDigits: 0,
          maximumFractionDigits: 2 
        })}`;
      case 'percentage':
        return `${val.toFixed(2)}%`;
      case 'number':
        if (val >= 1000000) {
          return `${(val / 1000000).toFixed(1)}M`;
        } else if (val >= 1000) {
          return `${(val / 1000).toFixed(1)}K`;
        }
        return val.toLocaleString();
      default:
        return val.toString();
    }
  };

  // 根据趋势获取颜色和图标
  const getTrendInfo = () => {
    if (!trend || !trendValue) return null;
    
    switch (trend) {
      case 'up':
        return {
          icon: <TrendingUp className="h-3 w-3" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        };
      case 'down':
        return {
          icon: <TrendingDown className="h-3 w-3" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
      case 'stable':
        return {
          icon: <Minus className="h-3 w-3" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
      default:
        return null;
    }
  };

  const trendInfo = getTrendInfo();

  // 根据size设置样式
  const sizeClasses = {
    sm: {
      card: 'p-3',
      title: 'text-xs',
      value: 'text-lg',
      icon: 'h-4 w-4',
    },
    md: {
      card: 'p-4',
      title: 'text-sm',
      value: 'text-2xl',
      icon: 'h-5 w-5',
    },
    lg: {
      card: 'p-6',
      title: 'text-base',
      value: 'text-3xl',
      icon: 'h-6 w-6',
    },
  };

  const styles = sizeClasses[size];

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${className}`}>
      <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 ${styles.card}`}>
        <CardTitle className={`${styles.title} font-medium text-gray-600`}>
          {title}
        </CardTitle>
        {icon && (
          <div className={`${styles.icon} text-gray-400`}>
            {icon}
          </div>
        )}
      </CardHeader>
      
      <CardContent className={styles.card}>
        <div className="space-y-2">
          {/* 主要数值 */}
          <div className={`${styles.value} font-bold text-gray-900`}>
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
            ) : (
              formatValue(value, format)
            )}
          </div>
          
          {/* 趋势和描述 */}
          <div className="flex items-center justify-between">
            {description && (
              <p className="text-xs text-gray-500 truncate flex-1">
                {description}
              </p>
            )}
            
            {trendInfo && trendValue && (
              <Badge 
                variant="outline" 
                className={`
                  ml-2 text-xs border ${trendInfo.borderColor} ${trendInfo.bgColor} ${trendInfo.color}
                `}
              >
                <span className="flex items-center space-x-1">
                  {trendInfo.icon}
                  <span>{trendValue.toFixed(1)}%</span>
                </span>
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 指标卡片组合组件
interface AdMetricsGridProps {
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    cvr: number;
    roas: number;
    acoas: number;
  };
  loading?: boolean;
  className?: string;
}

export function AdMetricsGrid({ metrics, loading = false, className = '' }: AdMetricsGridProps) {
  const metricsConfig = [
    {
      key: 'impressions',
      title: '曝光量',
      format: 'number' as const,
      description: '广告展示次数',
    },
    {
      key: 'clicks', 
      title: '点击量',
      format: 'number' as const,
      description: '广告点击次数',
    },
    {
      key: 'spend',
      title: '广告花费',
      format: 'currency' as const,
      description: '投入广告费用',
    },
    {
      key: 'ctr',
      title: '点击率',
      format: 'percentage' as const,
      description: '点击率表现',
    },
    {
      key: 'cvr',
      title: '转化率',
      format: 'percentage' as const,
      description: '转化效果',
    },
    {
      key: 'roas',
      title: '投资回报率',
      format: 'number' as const,
      description: 'ROAS表现',
    },
    {
      key: 'acoas',
      title: 'ACOAS',
      format: 'percentage' as const,
      description: '广告成本占比',
    },
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 ${className}`}>
      {metricsConfig.map((config) => (
        <AdMetricsCard
          key={config.key}
          title={config.title}
          value={(metrics as any)[config.key] || 0}
          format={config.format}
          description={config.description}
          loading={loading}
          size="sm"
        />
      ))}
    </div>
  );
}

// 简化版指标卡片
interface SimpleMetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'default' | 'green' | 'red' | 'yellow' | 'blue';
  loading?: boolean;
}

export function SimpleMetricsCard({ 
  title, 
  value, 
  subtitle, 
  color = 'default',
  loading = false 
}: SimpleMetricsCardProps) {
  const colorClasses = {
    default: 'bg-white border-gray-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    blue: 'bg-blue-50 border-blue-200',
  };

  const textColorClasses = {
    default: 'text-gray-900',
    green: 'text-green-900',
    red: 'text-red-900',
    yellow: 'text-yellow-900',
    blue: 'text-blue-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className={`text-2xl font-bold ${textColorClasses[color]}`}>
          {loading ? (
            <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
          ) : (
            value
          )}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}