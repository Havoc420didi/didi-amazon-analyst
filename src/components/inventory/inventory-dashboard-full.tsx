'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import InventoryFilterPanel from './inventory-filter-panel';
import InventoryTable from './inventory-table';
import InventoryStatsCards from './inventory-stats-cards';
import type { InventoryRecord, InventoryFilterParams, InventoryStats } from '@/types/inventory';
import type { PaginatedResponse, ApiResponse } from '@/types/inventory';

export default function InventoryDashboard() {
  const router = useRouter();
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  });
  const [filters, setFilters] = useState<InventoryFilterParams>({
    page: 1,
    limit: 20,
    sort_by: 'date',
    sort_order: 'desc'
  });

  // 获取库存数据
  const fetchInventoryData = async (newFilters?: InventoryFilterParams) => {
    try {
      const currentFilters = newFilters || filters;
      setLoading(newFilters ? true : false);
      setRefreshing(!newFilters);

      // 构建查询参数
      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });

      // 添加最新记录标识
      params.append('latest_only', 'true');

      const response = await fetch(`/api/inventory?${params}`);
      const result: ApiResponse<PaginatedResponse<InventoryRecord>> = await response.json();

      if (result.success && result.data) {
        setRecords(result.data.data);
        setPagination(result.data.pagination);
      } else {
        console.error('Failed to fetch inventory data:', result.message);
      }
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 获取统计数据
  const fetchStatsData = async () => {
    try {
      const response = await fetch('/api/inventory/stats');
      const result: ApiResponse<InventoryStats> = await response.json();

      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching stats data:', error);
    }
  };

  // 处理筛选变化
  const handleFilterChange = (newFilters: InventoryFilterParams) => {
    const updatedFilters = { ...newFilters, page: 1 }; // 重置到第一页
    setFilters(updatedFilters);
    fetchInventoryData(updatedFilters);
  };

  // 处理分页变化
  const handlePageChange = (page: number) => {
    const updatedFilters = { ...filters, page };
    setFilters(updatedFilters);
    fetchInventoryData(updatedFilters);
  };

  // 处理排序变化
  const handleSortChange = (sort_by: string, sort_order: 'asc' | 'desc') => {
    const updatedFilters = { ...filters, sort_by, sort_order, page: 1 };
    setFilters(updatedFilters);
    fetchInventoryData(updatedFilters);
  };

  // 刷新数据
  const handleRefresh = () => {
    fetchInventoryData();
    fetchStatsData();
  };

  // 导航到上传页面
  const navigateToUpload = () => {
    router.push('/inventory/upload');
  };

  // 导出数据
  const handleExport = async () => {
    // TODO: 实现数据导出功能
    console.log('Export functionality will be implemented later');
  };

  // 初始化数据
  useEffect(() => {
    fetchInventoryData();
    fetchStatsData();
  }, []);

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <InventoryStatsCards stats={stats} loading={loading} />

      {/* 操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            共 {pagination.total} 条记录
          </Badge>
          {stats && (
            <Badge variant="secondary" className="text-sm">
              库存点: {Object.keys(stats.warehouse_distribution).length}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>

          <Button
            size="sm"
            onClick={navigateToUpload}
          >
            <Upload className="h-4 w-4 mr-2" />
            上传数据
          </Button>
        </div>
      </div>

      {/* 筛选面板 */}
      <InventoryFilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        loading={loading}
      />

      {/* 数据表格 */}
      <InventoryTable
        records={records}
        pagination={pagination}
        loading={loading}
        onPageChange={handlePageChange}
        onSortChange={handleSortChange}
        sortBy={filters.sort_by}
        sortOrder={filters.sort_order}
      />
    </div>
  );
}