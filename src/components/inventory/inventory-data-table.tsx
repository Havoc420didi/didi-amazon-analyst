'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BarChart3, Search, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface InventoryRecord {
  id: number;
  asin: string;
  product_name: string;
  sales_person: string;
  warehouse_location: string;
  date: string;
  fba_available: number;
  fba_in_transit: number;
  local_warehouse: number;
  total_inventory: number;
  avg_sales: number;
  daily_revenue: number;
  inventory_turnover_days: number | null;
  inventory_status: string | null;
  ad_impressions: number;
  ad_clicks: number;
  ad_spend: number;
  ad_orders: number;
  ad_ctr: number | null;
  ad_conversion_rate: number | null;
  acos: number | null;
}

interface ApiResponse {
  success: boolean;
  data: InventoryRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export default function InventoryDataTable() {
  const router = useRouter();
  const [data, setData] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  });

  // 筛选条件
  const [filters, setFilters] = useState({
    sales_person: '',
    asin: '',
    warehouse_location: '',
    inventory_status: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        latest_only: 'true', // 只获取最新记录
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });

      const response = await fetch(`/api/inventory?${params}`);
      const result: ApiResponse = await response.json();
      
      if (result.success) {
        setData(result.data);
        setPagination(result.pagination);
      } else {
        console.error('Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination.page, filters]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // 重置到第一页
  };

  const handleAnalyze = (record: InventoryRecord) => {
    // 跳转到详细分析页面
    router.push(`/inventory/analysis/${record.asin}?warehouse=${record.warehouse_location}`);
  };

  const getInventoryStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const variants = {
      '库存不足': 'destructive',
      '周转合格': 'default',
      '周转超标': 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>库存点数据列表</CardTitle>
        
        {/* 筛选条件 */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="搜索ASIN"
              value={filters.asin}
              onChange={(e) => handleFilterChange('asin', e.target.value)}
              className="w-full"
            />
          </div>
          
          <Select
            value={filters.sales_person}
            onValueChange={(value) => handleFilterChange('sales_person', value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="选择业务员" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部业务员</SelectItem>
              <SelectItem value="张三">张三</SelectItem>
              <SelectItem value="李四">李四</SelectItem>
              <SelectItem value="王五">王五</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.warehouse_location}
            onValueChange={(value) => handleFilterChange('warehouse_location', value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="选择库存点" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部库存点</SelectItem>
              <SelectItem value="英国">英国</SelectItem>
              <SelectItem value="欧盟">欧盟</SelectItem>
              <SelectItem value="加拿大">加拿大</SelectItem>
              <SelectItem value="澳大利亚">澳大利亚</SelectItem>
              <SelectItem value="美国">美国</SelectItem>
              <SelectItem value="日本">日本</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.inventory_status}
            onValueChange={(value) => handleFilterChange('inventory_status', value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="库存状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              <SelectItem value="库存不足">库存不足</SelectItem>
              <SelectItem value="周转合格">周转合格</SelectItem>
              <SelectItem value="周转超标">周转超标</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">加载中...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">暂无数据</div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ASIN</TableHead>
                  <TableHead>品名</TableHead>
                  <TableHead>业务员</TableHead>
                  <TableHead>库存点</TableHead>
                  <TableHead className="text-right">FBA可用</TableHead>
                  <TableHead className="text-right">总库存</TableHead>
                  <TableHead className="text-right">日均销售额</TableHead>
                  <TableHead>库存状态</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-sm">
                      {record.asin}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {record.product_name}
                    </TableCell>
                    <TableCell>{record.sales_person}</TableCell>
                    <TableCell>{record.warehouse_location}</TableCell>
                    <TableCell className="text-right">
                      {record.fba_available.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.total_inventory.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ¥{record.daily_revenue.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {getInventoryStatusBadge(record.inventory_status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.date}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAnalyze(record)}
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        数据分析
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 分页 */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                共 {pagination.total} 条记录，第 {pagination.page} / {pagination.total_pages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.total_pages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}