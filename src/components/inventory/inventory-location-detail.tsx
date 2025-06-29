'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, Search, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import InventoryTable from './inventory-table';
import InventoryStatsCards from './inventory-stats-cards';
import type { InventoryRecord, WarehouseLocation, InventoryStats } from '@/types/inventory';
import type { ApiResponse } from '@/types/inventory';

interface InventoryLocationDetailProps {
  location: WarehouseLocation;
  initialAsin?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
}

export default function InventoryLocationDetail({
  location,
  initialAsin,
  initialDateFrom,
  initialDateTo
}: InventoryLocationDetailProps) {
  const router = useRouter();
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [asins, setAsins] = useState<string[]>([]);
  
  // 筛选状态
  const [filters, setFilters] = useState({
    asin: initialAsin || '',
    date_from: initialDateFrom || '',
    date_to: initialDateTo || (() => {
      // 默认显示最近30天
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return thirtyDaysAgo.toISOString().split('T')[0];
    })()
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  });

  // 排序状态
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 获取库存点历史数据
  const fetchLocationHistory = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.asin) params.append('asin', filters.asin);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

      const response = await fetch(`/api/inventory/${location}?${params}`);
      const result: ApiResponse<{ location: string; records: InventoryRecord[]; total: number }> = await response.json();

      if (result.success && result.data) {
        setRecords(result.data.records);
        setPagination(prev => ({
          ...prev,
          total: result.data!.total,
          total_pages: Math.ceil(result.data!.total / prev.limit)
        }));
      } else {
        console.error('Failed to fetch location history:', result.message);
      }
    } catch (error) {
      console.error('Error fetching location history:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

      const response = await fetch(`/api/inventory/stats?${params}`);
      const result: ApiResponse<InventoryStats> = await response.json();

      if (result.success && result.data) {
        // 筛选当前库存点的数据
        const locationStats = {
          ...result.data,
          warehouse_distribution: {
            [location]: result.data.warehouse_distribution[location] || 0
          } as any
        };
        setStats(locationStats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // 获取ASIN选项
  const fetchAsinOptions = async () => {
    try {
      const response = await fetch('/api/inventory/options?type=asin&limit=200');
      const result = await response.json();

      if (result.success && result.data) {
        setAsins(result.data);
      }
    } catch (error) {
      console.error('Error fetching ASIN options:', error);
    }
  };

  // 应用筛选
  const applyFilters = () => {
    fetchLocationHistory();
    fetchStats();
  };

  // 重置筛选
  const resetFilters = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    setFilters({
      asin: '',
      date_from: thirtyDaysAgo.toISOString().split('T')[0],
      date_to: today.toISOString().split('T')[0]
    });
  };

  // 处理分页变化
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    // Note: 这里需要实现分页逻辑，目前API返回所有数据
  };

  // 处理排序变化
  const handleSortChange = (column: string, order: 'asc' | 'desc') => {
    setSortBy(column);
    setSortOrder(order);
    
    // 本地排序
    const sortedRecords = [...records].sort((a, b) => {
      const aVal = a[column as keyof InventoryRecord];
      const bVal = b[column as keyof InventoryRecord];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return order === 'asc' 
        ? Number(aVal) - Number(bVal) 
        : Number(bVal) - Number(aVal);
    });
    
    setRecords(sortedRecords);
  };

  // 导出数据
  const handleExport = () => {
    // TODO: 实现数据导出功能
    console.log('Export functionality will be implemented later');
  };

  // 返回列表页
  const goBack = () => {
    router.push('/inventory');
  };

  // 初始化数据
  useEffect(() => {
    fetchLocationHistory();
    fetchStats();
    fetchAsinOptions();
  }, []);

  // 重新应用筛选当筛选条件改变时
  useEffect(() => {
    if (filters !== { asin: initialAsin || '', date_from: initialDateFrom || '', date_to: initialDateTo || '' }) {
      applyFilters();
    }
  }, [filters]);

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div>
        <Button variant="ghost" onClick={goBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回库存列表
        </Button>
      </div>

      {/* 筛选面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* ASIN筛选 */}
            <div className="space-y-2">
              <Label htmlFor="asin">ASIN</Label>
              <Select
                value={filters.asin}
                onValueChange={(value) => setFilters(prev => ({ ...prev, asin: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择ASIN" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  {asins.map(asin => (
                    <SelectItem key={asin} value={asin}>
                      {asin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 开始日期 */}
            <div className="space-y-2">
              <Label htmlFor="date-from">开始日期</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              />
            </div>

            {/* 结束日期 */}
            <div className="space-y-2">
              <Label htmlFor="date-to">结束日期</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex items-end gap-2">
              <Button onClick={applyFilters} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
              <Button variant="outline" onClick={resetFilters}>
                重置
              </Button>
            </div>
          </div>

          {/* 当前筛选条件显示 */}
          <div className="flex items-center gap-2 mt-4">
            <Badge variant="secondary">
              库存点: {location}
            </Badge>
            {filters.asin && (
              <Badge variant="outline">
                ASIN: {filters.asin}
              </Badge>
            )}
            {filters.date_from && (
              <Badge variant="outline">
                开始: {filters.date_from}
              </Badge>
            )}
            {filters.date_to && (
              <Badge variant="outline">
                结束: {filters.date_to}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <InventoryStatsCards stats={stats} loading={loading} />

      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            共 {pagination.total} 条历史记录
          </Badge>
        </div>
        
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          导出数据
        </Button>
      </div>

      {/* 数据表格 */}
      <InventoryTable
        records={records}
        pagination={pagination}
        loading={loading}
        onPageChange={handlePageChange}
        onSortChange={handleSortChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
    </div>
  );
}