'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { InventoryRecord } from '@/types/inventory';

interface InventoryTableProps {
  records: InventoryRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  loading: boolean;
  onPageChange: (page: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export default function InventoryTable({
  records,
  pagination,
  loading,
  onPageChange,
  onSortChange,
  sortBy = 'date',
  sortOrder = 'desc'
}: InventoryTableProps) {
  const router = useRouter();

  // 库存状态样式配置
  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const config = {
      '库存不足': { variant: 'destructive' as const, icon: TrendingDown },
      '周转合格': { variant: 'default' as const, icon: Minus },
      '周转超标': { variant: 'secondary' as const, icon: TrendingUp }
    };

    const statusConfig = config[status as keyof typeof config];
    if (!statusConfig) return null;

    const Icon = statusConfig.icon;
    return (
      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  // 处理排序
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // 同一列：切换排序方向
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      onSortChange(column, newOrder);
    } else {
      // 不同列：默认降序
      onSortChange(column, 'desc');
    }
  };

  // 获取排序图标
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  // 格式化数值
  const formatNumber = (value: number | null, decimals: number = 0) => {
    if (value === null) return '-';
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  };

  // 格式化百分比
  const formatPercentage = (value: number | null) => {
    if (value === null) return '-';
    return `${(value * 100).toFixed(2)}%`;
  };

  // 查看详情
  const viewDetails = (record: InventoryRecord) => {
    router.push(`/inventory/${record.warehouse_location}?asin=${record.asin}`);
  };

  if (loading) {
    return <InventoryTableSkeleton />;
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-muted-foreground text-center">
            <div className="text-lg font-medium mb-2">暂无数据</div>
            <div className="text-sm">请调整筛选条件或上传新的数据</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>库存数据</span>
          <Badge variant="outline">
            {pagination.total} 条记录
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('asin')}
                    className="h-8 p-2"
                  >
                    ASIN
                    {getSortIcon('asin')}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[200px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('product_name')}
                    className="h-8 p-2"
                  >
                    品名
                    {getSortIcon('product_name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('sales_person')}
                    className="h-8 p-2"
                  >
                    业务员
                    {getSortIcon('sales_person')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('warehouse_location')}
                    className="h-8 p-2"
                  >
                    库存点
                    {getSortIcon('warehouse_location')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('total_inventory')}
                    className="h-8 p-2"
                  >
                    总库存
                    {getSortIcon('total_inventory')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('avg_sales')}
                    className="h-8 p-2"
                  >
                    平均销量
                    {getSortIcon('avg_sales')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('daily_revenue')}
                    className="h-8 p-2"
                  >
                    日均销售额
                    {getSortIcon('daily_revenue')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('inventory_turnover_days')}
                    className="h-8 p-2"
                  >
                    周转天数
                    {getSortIcon('inventory_turnover_days')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('inventory_status')}
                    className="h-8 p-2"
                  >
                    库存状态
                    {getSortIcon('inventory_status')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('ad_spend')}
                    className="h-8 p-2"
                  >
                    广告花费
                    {getSortIcon('ad_spend')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('acos')}
                    className="h-8 p-2"
                  >
                    ACOS
                    {getSortIcon('acos')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('date')}
                    className="h-8 p-2"
                  >
                    日期
                    {getSortIcon('date')}
                  </Button>
                </TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-sm">
                    {record.asin}
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <div className="truncate" title={record.product_name}>
                      {record.product_name}
                    </div>
                  </TableCell>
                  <TableCell>{record.sales_person}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {record.warehouse_location}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(record.total_inventory)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(record.avg_sales, 1)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ¥{formatNumber(record.daily_revenue, 2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(record.inventory_turnover_days, 1)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(record.inventory_status)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ¥{formatNumber(record.ad_spend, 2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatPercentage(record.acos)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {record.date}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewDetails(record)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">查看详情</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 分页控制 */}
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            显示第 {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，
            共 {pagination.total} 条记录
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={pagination.page === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
              <span className="sr-only">首页</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">上一页</span>
            </Button>
            
            <div className="flex items-center gap-1">
              <span className="text-sm">第</span>
              <span className="text-sm font-medium">
                {pagination.page}
              </span>
              <span className="text-sm">页，共</span>
              <span className="text-sm font-medium">
                {pagination.total_pages}
              </span>
              <span className="text-sm">页</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.total_pages}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">下一页</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.total_pages)}
              disabled={pagination.page === pagination.total_pages}
            >
              <ChevronsRight className="h-4 w-4" />
              <span className="sr-only">末页</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 表格加载骨架屏
 */
function InventoryTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}