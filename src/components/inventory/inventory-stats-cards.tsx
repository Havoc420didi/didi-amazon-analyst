'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import type { InventoryStats } from '@/types/inventory';

interface InventoryStatsCardsProps {
  stats: InventoryStats | null;
  loading: boolean;
}

export default function InventoryStatsCards({ stats, loading }: InventoryStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const cards = [
    {
      title: '总库存',
      value: stats.total_inventory.toLocaleString(),
      description: `${stats.total_products} 个产品`,
      icon: Package,
      color: 'text-blue-600'
    },
    {
      title: '日均销售额',
      value: `¥${stats.total_daily_revenue.toLocaleString()}`,
      description: '所有库存点合计',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      title: '广告花费',
      value: `¥${stats.total_ad_spend.toLocaleString()}`,
      description: '日均广告投入',
      icon: TrendingUp,
      color: 'text-purple-600'
    },
    {
      title: '库存告警',
      value: stats.inventory_status_distribution['库存不足'] || 0,
      description: '库存不足产品数',
      icon: AlertTriangle,
      color: 'text-red-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * 库存状态分布组件
 */
export function InventoryStatusDistribution({ stats }: { stats: InventoryStats }) {
  const statusConfig = {
    '库存不足': { color: 'bg-red-500', label: '库存不足' },
    '周转合格': { color: 'bg-green-500', label: '周转合格' },
    '周转超标': { color: 'bg-orange-500', label: '周转超标' }
  };

  const total = Object.values(stats.inventory_status_distribution).reduce((sum, count) => sum + count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">库存状态分布</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(stats.inventory_status_distribution).map(([status, count]) => {
          const config = statusConfig[status as keyof typeof statusConfig];
          const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0';
          
          return (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${config.color}`} />
                <span className="text-sm">{config.label}</span>
              </div>
              <div className="text-sm font-medium">
                {count} ({percentage}%)
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * 库存点分布组件
 */
export function WarehouseDistribution({ stats }: { stats: InventoryStats }) {
  const total = Object.values(stats.warehouse_distribution).reduce((sum, count) => sum + count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">库存点分布</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(stats.warehouse_distribution).map(([location, count]) => {
          const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0';
          
          return (
            <div key={location} className="flex items-center justify-between">
              <span className="text-sm">{location}</span>
              <div className="text-sm font-medium">
                {count} ({percentage}%)
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}