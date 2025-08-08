'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChevronUp, 
  ChevronDown, 
  Search, 
  Filter, 
  Download,
  AlertTriangle,
  CheckCircle,
  Calendar,
  CalendarDays,
  Clock
} from 'lucide-react';

interface InventoryPoint {
  id: number;
  asin: string;
  productName: string;
  sku?: string;
  marketplace: string;
  salesPerson?: string;
  inventory: {
    fbaAvailable: number;
    fbaInbound: number;
    localAvailable: number;
    total: number;
  };
  sales: {
    sales7Days: number;
    averageSales: number;
    dailySalesAmount: number;
    turnoverDays: number;
  };
  advertising: {
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number; // 广告订单量
    ctr: number;
    cvr: number;
    cpc: number;
    roas: number;
    acoas: number;
  };
  status: {
    isEffective: boolean;
    isTurnoverExceeded: boolean;
    isOutOfStock: boolean;
    isLowInventory: boolean;
    isZeroSales: boolean;
  };
  mergeInfo?: {
    type: string;
    storeCount: number;
    mergedStores?: string[];
  };
  dataDate: string;
}

interface InventoryPointsTableProps {
  data: InventoryPoint[];
  onFiltersChange?: (filters: Record<string, any>) => void;
  currentFilters?: Record<string, any>;
  loading?: boolean;
  className?: string;
}

type SortField = keyof InventoryPoint | 'dailySalesAmount' | 'totalInventory' | 'adSpend' | 'acoas' | 'turnoverDays' | 'cvr' | 'ctr' | 'fbaAvailable' | 'fbaInbound' | 'localAvailable' | 'averageSales' | 'adImpressions' | 'adClicks' | 'adOrders';
type SortDirection = 'asc' | 'desc';

// 日期筛选类型
type DateFilterType = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom' | 'all';

export function InventoryPointsTable({
  data,
  onFiltersChange,
  currentFilters = {},
  loading = false,
  className = '',
}: InventoryPointsTableProps) {
  const [searchTerm, setSearchTerm] = useState(currentFilters.asin || '');
  const [marketplaceFilter, setMarketplaceFilter] = useState(currentFilters.marketplace || '');
  const [salesPersonFilter, setSalesPersonFilter] = useState(currentFilters.salesPerson || '');
  const [statusFilter, setStatusFilter] = useState('');
  
  // 新增日期筛选状态
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customDays, setCustomDays] = useState(7);
  
  const [sortField, setSortField] = useState<SortField>('dailySalesAmount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 获取唯一的筛选选项
  const filterOptions = useMemo(() => {
    const marketplaces = [...new Set(data.map(item => item.marketplace))].filter(Boolean);
    const salesPersons = [...new Set(data.map(item => item.salesPerson).filter((person): person is string => Boolean(person)))];
    
    return { marketplaces, salesPersons };
  }, [data]);

  // 日期筛选逻辑
  const getDateFilteredData = (data: InventoryPoint[]) => {
    if (dateFilterType === 'all') return data;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate: Date;
    let endDate: Date = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    switch (dateFilterType) {
      case 'today':
        startDate = new Date(today);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last30days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          return data;
        }
        break;
      default:
        return data;
    }

    return data.filter(item => {
      const itemDate = new Date(item.dataDate);
      return itemDate >= startDate && itemDate <= endDate;
    });
  };

  // 筛选和排序数据
  const processedData = useMemo(() => {
    let filtered = [...data];

    // 日期筛选
    filtered = getDateFilteredData(filtered);

    // 搜索筛选
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.asin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // 市场筛选
    if (marketplaceFilter) {
      filtered = filtered.filter(item => item.marketplace === marketplaceFilter);
    }

    // 业务员筛选
    if (salesPersonFilter) {
      filtered = filtered.filter(item => item.salesPerson === salesPersonFilter);
    }

    // 状态筛选 - 使用新的业务规则
    if (statusFilter) {
      filtered = filtered.filter(item => {
        const turnoverDays = item.sales.turnoverDays;
        const fbaAvailable = item.inventory.fbaAvailable;
        const averageSales = item.sales.averageSales;
        const fbaAvailableDays = averageSales > 0 ? fbaAvailable / averageSales : 999;
        
        switch (statusFilter) {
          case 'out_of_stock':
            return fbaAvailableDays < 3; // 缺货：FBA可用天数 < 3天
          case 'turnover_exceeded':
            return turnoverDays > 100; // 周转超标：> 100天
          case 'low_inventory':
            return turnoverDays < 45 && fbaAvailableDays >= 3; // 低库存：< 45天且不缺货
          case 'normal_turnover':
            return turnoverDays >= 45 && turnoverDays <= 100 && fbaAvailableDays >= 3; // 周转合格：45-100天且不缺货
          default:
            return true;
        }
      });
    }

    // 排序
    filtered.sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortField) {
        case 'dailySalesAmount':
          aValue = a.sales.dailySalesAmount;
          bValue = b.sales.dailySalesAmount;
          break;
        case 'totalInventory':
          aValue = a.inventory.total;
          bValue = b.inventory.total;
          break;
        case 'adSpend':
          aValue = a.advertising.spend;
          bValue = b.advertising.spend;
          break;
        case 'acoas':
          aValue = a.advertising.acoas;
          bValue = b.advertising.acoas;
          break;
        case 'turnoverDays':
          aValue = a.sales.turnoverDays;
          bValue = b.sales.turnoverDays;
          break;
        case 'cvr':
          aValue = a.advertising.cvr;
          bValue = b.advertising.cvr;
          break;
        case 'ctr':
          aValue = a.advertising.ctr;
          bValue = b.advertising.ctr;
          break;
        case 'fbaAvailable':
          aValue = a.inventory.fbaAvailable;
          bValue = b.inventory.fbaAvailable;
          break;
        case 'fbaInbound':
          aValue = a.inventory.fbaInbound;
          bValue = b.inventory.fbaInbound;
          break;
        case 'localAvailable':
          aValue = a.inventory.localAvailable;
          bValue = b.inventory.localAvailable;
          break;
        case 'averageSales':
          aValue = a.sales.averageSales;
          bValue = b.sales.averageSales;
          break;
        case 'adImpressions':
          aValue = a.advertising.impressions;
          bValue = b.advertising.impressions;
          break;
        case 'adClicks':
          aValue = a.advertising.clicks;
          bValue = b.advertising.clicks;
          break;
        case 'adOrders':
          aValue = a.advertising.orders;
          bValue = b.advertising.orders;
          break;
        case 'asin':
          return sortDirection === 'desc' 
            ? b.asin.localeCompare(a.asin)
            : a.asin.localeCompare(b.asin);
        default:
          aValue = 0;
          bValue = 0;
      }

      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });

    return filtered;
  }, [data, searchTerm, marketplaceFilter, salesPersonFilter, statusFilter, dateFilterType, customStartDate, customEndDate, sortField, sortDirection]);

  // 分页数据
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  // 处理排序
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // 获取排序图标
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? 
      <ChevronDown className="h-4 w-4" /> : 
      <ChevronUp className="h-4 w-4" />;
  };

  // 获取周转天数的颜色样式
  const getTurnoverDaysStyle = (item: InventoryPoint) => {
    const turnoverDays = item.sales.turnoverDays;
    const fbaAvailable = item.inventory.fbaAvailable;
    const averageSales = item.sales.averageSales;
    const fbaAvailableDays = averageSales > 0 ? fbaAvailable / averageSales : 999;
    
    // 按优先级判断状态颜色
    if (fbaAvailableDays < 3) {
      return "text-purple-800 font-bold"; // 缺货 - 紫色
    }
    if (turnoverDays > 100) {
      return "text-blue-800 font-bold"; // 周转超标 - 蓝色
    }
    if (turnoverDays < 45) {
      return "text-red-800 font-bold"; // 低库存 - 红色
    }
    if (turnoverDays >= 45 && turnoverDays <= 100) {
      return "text-black font-medium"; // 周转合格 - 黑色
    }
    return "text-gray-600"; // 默认
  };

  // 获取状态标识 - 根据业务规则重新计算状态
  const getStatusBadge = (item: InventoryPoint) => {
    const turnoverDays = item.sales.turnoverDays;
    const fbaAvailable = item.inventory.fbaAvailable;
    const averageSales = item.sales.averageSales;
    
    // 计算FBA可用天数：FBA可用库存 / 平均销量
    const fbaAvailableDays = averageSales > 0 ? fbaAvailable / averageSales : 999;
    
    // 按优先级判断状态
    // 1. 缺货：FBA可用天数 < 3天 (紫色)
    if (fbaAvailableDays < 3) {
      return <Badge className="text-xs bg-purple-100 text-purple-800 border-purple-300">缺货</Badge>;
    }
    
    // 2. 周转超标：库存周转天数 > 100天 (蓝色)
    if (turnoverDays > 100) {
      return <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-300">周转超标</Badge>;
    }
    
    // 3. 低库存：库存周转天数 < 45天 (红色)
    if (turnoverDays < 45) {
      return <Badge className="text-xs bg-red-100 text-red-800 border-red-300">低库存</Badge>;
    }
    
    // 4. 周转合格：库存周转天数在45-100天之间 (黑色)
    if (turnoverDays >= 45 && turnoverDays <= 100) {
      return <Badge variant="outline" className="text-xs text-black border-gray-400">周转合格</Badge>;
    }
    
    // 默认状态
    return <Badge variant="outline" className="text-xs">正常</Badge>;
  };

  // 获取性能指示器
  const getPerformanceIndicator = (value: number, type: 'roas' | 'acoas' | 'ctr' | 'cvr') => {
    let isGood = false;
    
    switch (type) {
      case 'roas':
        isGood = value >= 3;
        break;
      case 'acoas':
        isGood = value <= 25;
        break;
      case 'ctr':
        isGood = value >= 1;
        break;
      case 'cvr':
        isGood = value >= 10; // 转化率大于等于10%认为是良好
        break;
    }
    
    return isGood ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> :
      <AlertTriangle className="h-4 w-4 text-red-500" />;
  };

  // 应用筛选条件
  const applyFilters = () => {
    if (onFiltersChange) {
      onFiltersChange({
        asin: searchTerm || undefined,
        marketplace: marketplaceFilter || undefined,
        salesPerson: salesPersonFilter || undefined,
        status: statusFilter || undefined,
        dateFilterType: dateFilterType || undefined,
        customStartDate: customStartDate || undefined,
        customEndDate: customEndDate || undefined,
        customDays: customDays || undefined,
      });
    }
  };

  // 快速日期筛选按钮
  const quickDateFilters = [
    { type: 'today' as DateFilterType, label: '今日', icon: Calendar },
    { type: 'yesterday' as DateFilterType, label: '昨日', icon: CalendarDays },
    { type: 'last7days' as DateFilterType, label: '近7天', icon: Clock },
    { type: 'last30days' as DateFilterType, label: '近30天', icon: Clock },
    { type: 'all' as DateFilterType, label: '全部', icon: Calendar },
  ];

  // 自定义N天筛选
  const handleCustomDaysFilter = () => {
    if (customDays > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - customDays);
      
      setCustomStartDate(startDate.toISOString().split('T')[0]);
      setCustomEndDate(today.toISOString().split('T')[0]);
      setDateFilterType('custom');
      setCurrentPage(1);
    }
  };

  // 获取当前日期筛选的显示文本
  const getDateFilterDisplayText = () => {
    switch (dateFilterType) {
      case 'today':
        return '今日';
      case 'yesterday':
        return '昨日';
      case 'last7days':
        return '近7天';
      case 'last30days':
        return '近30天';
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${customStartDate} 至 ${customEndDate}`;
        }
        return '自定义日期';
      case 'all':
        return '全部日期';
      default:
        return '选择日期';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>库存点广告数据</CardTitle>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button variant="outline" size="sm" onClick={applyFilters}>
              <Filter className="h-4 w-4 mr-2" />
              应用筛选
            </Button>
          </div>
        </div>
        
        {/* 日期筛选栏 */}
        <div className="flex flex-wrap gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">日期筛选:</span>
          </div>
          
          {/* 快速日期筛选按钮 */}
          <div className="flex items-center space-x-2">
            {quickDateFilters.map(({ type, label, icon: Icon }) => (
              <Button
                key={type}
                variant={dateFilterType === type ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDateFilterType(type);
                  setCurrentPage(1);
                }}
                className="h-8 px-3"
              >
                <Icon className="h-3 w-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>
          
          {/* 自定义日期选择 */}
          {dateFilterType === 'custom' && (
            <div className="flex items-center space-x-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-40"
                placeholder="开始日期"
              />
              <span className="text-gray-500">至</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-40"
                placeholder="结束日期"
              />
            </div>
          )}
          
          {/* 自定义N天筛选 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">自定义天数:</span>
            <Input
              type="number"
              value={customDays}
              onChange={(e) => setCustomDays(parseInt(e.target.value) || 7)}
              className="w-20"
              min="1"
              max="365"
              placeholder="7"
            />
            <span className="text-sm text-gray-600">天前</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCustomDaysFilter}
              className="h-8 px-3"
            >
              <Clock className="h-3 w-3 mr-1" />
              应用
            </Button>
          </div>
          
          {/* 显示当前筛选状态 */}
          <div className="flex items-center space-x-2 ml-auto">
            <Badge variant="outline" className="text-xs">
              {getDateFilterDisplayText()}
            </Badge>
            <span className="text-xs text-gray-500">
              共 {processedData.length} 条记录
            </span>
          </div>
        </div>
        
        {/* 筛选栏 */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="搜索ASIN、产品名称或SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={marketplaceFilter} onValueChange={(value) => {
            setMarketplaceFilter(value);
            // 可选：实时应用筛选
            // applyFiltersRealtime();
          }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="选择市场" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部市场</SelectItem>
              {filterOptions.marketplaces.map(marketplace => (
                <SelectItem key={marketplace} value={marketplace}>
                  {marketplace}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={salesPersonFilter} onValueChange={(value) => {
            setSalesPersonFilter(value);
            // 可选：实时应用筛选
            // applyFiltersRealtime();
          }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="选择业务员" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部业务员</SelectItem>
              {filterOptions.salesPersons.map(person => (
                <SelectItem key={person} value={person}>
                  {person}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={(value) => {
            setStatusFilter(value);
            // 可选：实时应用筛选
            // applyFiltersRealtime();
          }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="状态筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              <SelectItem value="out_of_stock">🟣 缺货 (FBA可用&lt;3天)</SelectItem>
              <SelectItem value="turnover_exceeded">🔵 周转超标 (&gt;100天)</SelectItem>
              <SelectItem value="low_inventory">🔴 低库存 (&lt;45天)</SelectItem>
              <SelectItem value="normal_turnover">⚫ 周转合格 (45-100天)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">加载数据中...</span>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    {/* 1. ASIN */}
                    <TableHead className="w-[120px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('asin')}
                        className="h-8 p-0 font-medium"
                      >
                        ASIN
                        {getSortIcon('asin')}
                      </Button>
                    </TableHead>
                    {/* 2. 品名 */}
                    <TableHead className="min-w-[200px]">品名</TableHead>
                    {/* 3. 业务员 */}
                    <TableHead className="w-[100px]">业务员</TableHead>
                    {/* 4. 库存点 */}
                    <TableHead className="w-[100px]">库存点</TableHead>
                    {/* 5. 数据日期 */}
                    <TableHead className="w-[100px]">数据日期</TableHead>
                    {/* 6. FBA可用 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('fbaAvailable')}
                        className="h-8 p-0 font-medium"
                      >
                        FBA可用
                        {getSortIcon('fbaAvailable')}
                      </Button>
                    </TableHead>
                    {/* 7. FBA在途 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('fbaInbound')}
                        className="h-8 p-0 font-medium"
                      >
                        FBA在途
                        {getSortIcon('fbaInbound')}
                      </Button>
                    </TableHead>
                    {/* 8. 本地仓 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('localAvailable')}
                        className="h-8 p-0 font-medium"
                      >
                        本地仓
                        {getSortIcon('localAvailable')}
                      </Button>
                    </TableHead>
                    {/* 9. 平均销量 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('averageSales')}
                        className="h-8 p-0 font-medium"
                      >
                        平均销量
                        {getSortIcon('averageSales')}
                      </Button>
                    </TableHead>
                    {/* 10. 日均销售额 */}
                    <TableHead className="w-[120px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('dailySalesAmount')}
                        className="h-8 p-0 font-medium"
                      >
                        日均销售额
                        {getSortIcon('dailySalesAmount')}
                      </Button>
                    </TableHead>
                    {/* 11. 总库存 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('totalInventory')}
                        className="h-8 p-0 font-medium"
                      >
                        总库存
                        {getSortIcon('totalInventory')}
                      </Button>
                    </TableHead>
                    {/* 12. 广告曝光量 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('adImpressions')}
                        className="h-8 p-0 font-medium"
                      >
                        广告曝光量
                        {getSortIcon('adImpressions')}
                      </Button>
                    </TableHead>
                    {/* 13. 广告点击量 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('adClicks')}
                        className="h-8 p-0 font-medium"
                      >
                        广告点击量
                        {getSortIcon('adClicks')}
                      </Button>
                    </TableHead>
                    {/* 14. 广告花费 */}
                    <TableHead className="w-[120px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('adSpend')}
                        className="h-8 p-0 font-medium"
                      >
                        广告花费
                        {getSortIcon('adSpend')}
                      </Button>
                    </TableHead>
                    {/* 15. 广告订单量 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('adOrders')}
                        className="h-8 p-0 font-medium"
                      >
                        广告订单量
                        {getSortIcon('adOrders')}
                      </Button>
                    </TableHead>
                    {/* 16. 库存周转天数 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('turnoverDays')}
                        className="h-8 p-0 font-medium"
                      >
                        库存周转天数
                        {getSortIcon('turnoverDays')}
                      </Button>
                    </TableHead>
                    {/* 17. 库存状态 */}
                    <TableHead className="w-[100px]">库存状态</TableHead>
                    {/* 18. 广告点击率 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('ctr')}
                        className="h-8 p-0 font-medium"
                      >
                        广告点击率
                        {getSortIcon('ctr')}
                      </Button>
                    </TableHead>
                    {/* 19. 广告转化率 */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('cvr')}
                        className="h-8 p-0 font-medium"
                      >
                        广告转化率
                        {getSortIcon('cvr')}
                      </Button>
                    </TableHead>
                    {/* 20. ACOAS */}
                    <TableHead className="w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('acoas')}
                        className="h-8 p-0 font-medium"
                      >
                        ACOAS
                        {getSortIcon('acoas')}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {paginatedData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      {/* 1. ASIN */}
                      <TableCell className="font-mono text-sm">
                        {item.asin}
                      </TableCell>
                      
                      {/* 2. 品名 */}
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-sm line-clamp-2" title={item.productName}>
                            {item.productName}
                          </p>
                          {item.sku && (
                            <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                          )}
                        </div>
                      </TableCell>
                      
                      {/* 3. 业务员 */}
                      <TableCell className="text-sm">
                        {item.salesPerson || '-'}
                      </TableCell>
                      
                      {/* 4. 库存点 */}
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.marketplace}
                        </Badge>
                        {item.mergeInfo && (
                          <p className="text-xs text-gray-500 mt-1">
                            合并 {item.mergeInfo.storeCount} 店铺
                          </p>
                        )}
                      </TableCell>
                      
                      {/* 5. 数据日期 */}
                      <TableCell className="text-sm">
                        {new Date(item.dataDate).toLocaleDateString('zh-CN')}
                      </TableCell>
                      
                      {/* 6. FBA可用 */}
                      <TableCell className="text-sm font-medium">
                        {item.inventory.fbaAvailable.toLocaleString()}
                      </TableCell>
                      
                      {/* 7. FBA在途 */}
                      <TableCell className="text-sm font-medium">
                        {item.inventory.fbaInbound.toLocaleString()}
                      </TableCell>
                      
                      {/* 8. 本地仓 */}
                      <TableCell className="text-sm font-medium">
                        {item.inventory.localAvailable.toLocaleString()}
                      </TableCell>
                      
                      {/* 9. 平均销量 */}
                      <TableCell className="text-sm font-medium">
                        {item.sales.averageSales.toLocaleString()}
                      </TableCell>
                      
                      {/* 10. 日均销售额 */}
                      <TableCell className="text-sm font-medium">
                        ${item.sales.dailySalesAmount.toLocaleString()}
                      </TableCell>
                      
                      {/* 11. 总库存 */}
                      <TableCell className="text-sm font-medium">
                        {item.inventory.total.toLocaleString()}
                      </TableCell>
                      
                      {/* 12. 广告曝光量 */}
                      <TableCell className="text-sm font-medium">
                        {item.advertising.impressions.toLocaleString()}
                      </TableCell>
                      
                      {/* 13. 广告点击量 */}
                      <TableCell className="text-sm font-medium">
                        {item.advertising.clicks.toLocaleString()}
                      </TableCell>
                      
                      {/* 14. 广告花费 */}
                      <TableCell className="text-sm font-medium">
                        ${item.advertising.spend.toLocaleString()}
                      </TableCell>
                      
                      {/* 15. 广告订单量 */}
                      <TableCell className="text-sm font-medium">
                        {item.advertising.orders.toLocaleString()}
                      </TableCell>
                      
                      {/* 16. 库存周转天数 */}
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span className={`text-sm ${getTurnoverDaysStyle(item)}`}>
                            {item.sales.turnoverDays.toFixed(0)}天
                          </span>
                        </div>
                      </TableCell>
                      
                      {/* 17. 库存状态 */}
                      <TableCell>
                        {getStatusBadge(item)}
                      </TableCell>
                      
                      {/* 18. 广告点击率 */}
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium">
                            {item.advertising.ctr.toFixed(2)}%
                          </span>
                          {getPerformanceIndicator(item.advertising.ctr, 'ctr')}
                        </div>
                      </TableCell>
                      
                      {/* 19. 广告转化率 */}
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium">
                            {item.advertising.cvr.toFixed(2)}%
                          </span>
                          {getPerformanceIndicator(item.advertising.cvr, 'cvr')}
                        </div>
                      </TableCell>
                      
                      {/* 20. ACOAS */}
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium">
                            {item.advertising.acoas.toFixed(2)}%
                          </span>
                          {getPerformanceIndicator(item.advertising.acoas, 'acoas')}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* 分页控制 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>显示</span>
                  <Select value={pageSize.toString()} onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>条，共 {processedData.length} 条</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}