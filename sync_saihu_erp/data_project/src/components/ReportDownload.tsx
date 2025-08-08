'use client';

import { useState } from 'react';
import { ReportType, InventoryPoint, SalesPersonStats } from '@/types/product';

interface ReportDownloadProps {
  title: string;
  inventoryPoints: InventoryPoint[];
  salesPersonStats: SalesPersonStats[];
  type: ReportType | 'salesPerson';
  isDisabled?: boolean;
}

export function ReportDownload({
  title,
  inventoryPoints,
  salesPersonStats,
  type,
  isDisabled = false
}: ReportDownloadProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    if (isDisabled || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventoryPoints,
          salesPersonStats,
          type
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '下载失败');
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `report-${type}-${new Date().toISOString().split('T')[0]}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = /filename="(.+)"/.exec(contentDisposition);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // 将响应转换为 Blob
      const blob = await response.blob();
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载报表错误:', error);
      alert(error instanceof Error ? error.message : '下载报表失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDisabled || isLoading}
      className={`
        py-2 px-4 rounded-md font-medium text-sm
        ${isDisabled || isLoading 
          ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
          : 'bg-blue-600 text-white hover:bg-blue-700 transition-colors'}
      `}
    >
      {isLoading ? '下载中...' : title}
    </button>
  );
}
