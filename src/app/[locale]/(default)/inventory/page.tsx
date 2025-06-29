import { Suspense } from 'react';
import { Metadata } from 'next';
import InventoryDashboard from '@/components/inventory/inventory-dashboard';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: '产品数据分析 - Amazon Analyst',
  description: '亚马逊产品数据管理和分析平台',
};

export default function InventoryPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">产品数据分析</h1>
          <p className="text-muted-foreground mt-2">
            管理和分析亚马逊产品数据，支持多维度筛选和历史追踪
          </p>
        </div>
      </div>

      {/* 主要内容 */}
      <Suspense fallback={<InventoryDashboardSkeleton />}>
        <InventoryDashboard />
      </Suspense>
    </div>
  );
}

/**
 * 加载骨架屏
 */
function InventoryDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      {/* 筛选面板骨架 */}
      <Skeleton className="h-16" />

      {/* 表格骨架 */}
      <div className="space-y-3">
        <Skeleton className="h-12" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

