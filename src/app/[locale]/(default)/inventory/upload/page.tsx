import { Suspense } from 'react';
import { Metadata } from 'next';
import InventoryUpload from '@/components/inventory/inventory-upload';

export const metadata: Metadata = {
  title: '数据上传 - Amazon Analyst',
  description: '上传Excel文件导入库存点数据',
};

export default function InventoryUploadPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">数据上传</h1>
          <p className="text-muted-foreground mt-2">
            上传Excel文件导入库存点数据，支持批量更新和历史数据管理
          </p>
        </div>
      </div>

      {/* 主要内容 */}
      <Suspense fallback={<InventoryUploadSkeleton />}>
        <InventoryUpload />
      </Suspense>
    </div>
  );
}

/**
 * 加载骨架屏
 */
function InventoryUploadSkeleton() {
  return (
    <div className="space-y-6">
      {/* 上传区域骨架 */}
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
      
      {/* 说明卡片骨架 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-40 bg-muted rounded-lg animate-pulse" />
        <div className="h-40 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  );
}