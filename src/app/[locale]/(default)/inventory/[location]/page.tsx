import { Suspense } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import InventoryLocationDetail from '@/components/inventory/inventory-location-detail';

interface PageProps {
  params: Promise<{ location: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { location } = await params;
  return {
    title: `${location}库存详情 - Amazon Analyst`,
    description: `${location}库存点的详细数据和历史趋势分析`,
  };
}

export default async function InventoryLocationPage({ params, searchParams }: PageProps) {
  const { location } = await params;
  const search = await searchParams;
  
  // 验证库存点参数
  const validLocations = ['英国', '欧盟'];
  if (!validLocations.includes(location)) {
    notFound();
  }

  // 获取查询参数
  const asin = typeof search.asin === 'string' ? search.asin : undefined;
  const date_from = typeof search.date_from === 'string' ? search.date_from : undefined;
  const date_to = typeof search.date_to === 'string' ? search.date_to : undefined;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {location}库存详情
          </h1>
          <p className="text-muted-foreground mt-2">
            查看{location}库存点的历史数据和趋势分析
          </p>
        </div>
      </div>

      {/* 主要内容 */}
      <Suspense fallback={<InventoryLocationDetailSkeleton />}>
        <InventoryLocationDetail
          location={location as '英国' | '欧盟'}
          initialAsin={asin}
          initialDateFrom={date_from}
          initialDateTo={date_to}
        />
      </Suspense>
    </div>
  );
}

/**
 * 加载骨架屏
 */
function InventoryLocationDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* 筛选面板骨架 */}
      <div className="h-16 bg-muted rounded-lg animate-pulse" />

      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>

      {/* 图表骨架 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-muted rounded-lg animate-pulse" />
        <div className="h-80 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* 表格骨架 */}
      <div className="space-y-3">
        <div className="h-12 bg-muted rounded-lg animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}