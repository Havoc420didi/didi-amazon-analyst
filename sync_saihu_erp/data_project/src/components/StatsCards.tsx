import React from 'react';
import { AnalysisStats } from '@/types/product';

interface StatCardProps {
  title: string;
  value: number;
  description?: string;
  trend?: {
    type: 'increase' | 'decrease';
    value: number;
  };
  valueColor?: string;
  className?: string;
}

function StatCard({ 
  title, 
  value, 
  description, 
  trend,
  valueColor = 'text-gray-900',
  className = ''
}: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className={`mt-2 text-3xl font-semibold ${valueColor}`}>{value}</p>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {trend && (
        <div className={`mt-2 flex items-center text-sm ${
          trend.type === 'increase' ? 'text-green-600' : 'text-red-600'
        }`}>
          <span>{trend.type === 'increase' ? '↑' : '↓'}</span>
          <span className="ml-1">{trend.value}%</span>
        </div>
      )}
    </div>
  );
}

interface StatsCardsProps {
  stats: AnalysisStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. 库存点总数 */}
      <StatCard 
        title="库存点总数" 
        value={stats.totalInventoryPoints} 
        description="所有库存点"
      />

      {/* 2. 库存周转较慢产品数量 */}
      <StatCard 
        title="周转超标产品" 
        value={stats.turnoverExceededCount} 
        description="周转天数>100天或无销量"
        valueColor="text-blue-600"
      />

      {/* 3. 库存不足产品数量 */}
      <StatCard 
        title="库存不足产品" 
        value={stats.lowInventoryCount} 
        description="周转天数<45天"
        valueColor="text-red-600"
      />

      {/* 4. 有效库存点数量 */}
      <StatCard 
        title="有效库存点" 
        value={stats.effectiveInventoryPointCount} 
        description="日均销售额≥16.7"
        valueColor="text-green-600"
      />
    </div>
  );
}

export default StatsCards;
