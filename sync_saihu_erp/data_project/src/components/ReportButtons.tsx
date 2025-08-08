'use client';

import { useState } from 'react';
import { ProductData, ReportType } from '@/types/product';

interface ReportButtonsProps {
  products: ProductData[];
  onDownloadStart?: () => void;
  onDownloadEnd?: () => void;
}

interface ReportConfig {
  type: ReportType;
  label: string;
  className: string;
}

const REPORT_CONFIGS: ReportConfig[] = [
  {
    type: 'inventory',
    label: '库存报表',
    className: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    type: 'turnoverExceeded',
    label: '周转超标报表',
    className: 'bg-yellow-500 hover:bg-yellow-600',
  },
  {
    type: 'outOfStock',
    label: '断货报表',
    className: 'bg-red-500 hover:bg-red-600',
  },
  {
    type: 'zeroSales',
    label: '零销量报表',
    className: 'bg-gray-500 hover:bg-gray-600',
  },
  {
    type: 'salesPerson',
    label: '业务员统计',
    className: 'bg-green-500 hover:bg-green-600',
  },
];

export function ReportButtons({ products, onDownloadStart, onDownloadEnd }: ReportButtonsProps) {
  const [isLoading, setIsLoading] = useState<ReportType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadReport = async (type: ReportType) => {
    try {
      setIsLoading(type);
      setError(null);
      onDownloadStart?.();

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products, type }),
      });

      if (!response.ok) {
        throw new Error('下载失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${type}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : '报表下载失败');
      console.error('报表下载失败:', err);
    } finally {
      setIsLoading(null);
      onDownloadEnd?.();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {REPORT_CONFIGS.map((config) => (
          <button
            key={config.type}
            onClick={() => downloadReport(config.type)}
            disabled={isLoading !== null}
            className={`px-4 py-2 text-white rounded transition-colors
              ${config.className}
              ${isLoading === config.type ? 'opacity-75 cursor-wait' : ''}
              ${isLoading !== null && isLoading !== config.type ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isLoading === config.type ? '下载中...' : config.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="text-sm text-red-500 mt-2">
          {error}
        </div>
      )}
    </div>
  );
} 