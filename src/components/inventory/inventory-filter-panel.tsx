'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Search, Filter, RotateCcw } from 'lucide-react';
import type { InventoryFilterParams } from '@/types/inventory';

interface InventoryFilterPanelProps {
  filters: InventoryFilterParams;
  onFilterChange: (filters: InventoryFilterParams) => void;
  loading?: boolean;
}

interface FilterOptions {
  sales_persons: string[];
  asins: string[];
  warehouse_locations: string[];
  inventory_statuses: string[];
}

export default function InventoryFilterPanel({ 
  filters, 
  onFilterChange, 
  loading = false 
}: InventoryFilterPanelProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [options, setOptions] = useState<FilterOptions>({
    sales_persons: [],
    asins: [],
    warehouse_locations: ['英国', '欧盟'],
    inventory_statuses: ['库存不足', '周转合格', '周转超标']
  });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [asinSearchTerm, setAsinSearchTerm] = useState('');

  // 获取筛选选项
  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/inventory/options');
      const result = await response.json();
      
      if (result.success && result.data) {
        setOptions({
          sales_persons: result.data.sales_persons || [],
          asins: result.data.asins || [],
          warehouse_locations: result.data.warehouse_locations || ['英国', '欧盟'],
          inventory_statuses: result.data.inventory_statuses || ['库存不足', '周转合格', '周转超标']
        });
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    } finally {
      setOptionsLoading(false);
    }
  };

  // 更新本地筛选状态
  const updateLocalFilter = (key: keyof InventoryFilterParams, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 应用筛选
  const applyFilters = () => {
    onFilterChange(localFilters);
  };

  // 重置筛选
  const resetFilters = () => {
    const resetFilters: InventoryFilterParams = {
      page: 1,
      limit: 20,
      sort_by: 'date',
      sort_order: 'desc'
    };
    setLocalFilters(resetFilters);
    setAsinSearchTerm('');
    onFilterChange(resetFilters);
  };

  // 移除单个筛选条件
  const removeFilter = (key: keyof InventoryFilterParams) => {
    const newFilters = { ...localFilters };
    delete newFilters[key];
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  // 获取活跃筛选标签
  const getActiveFilterTags = () => {
    const tags: Array<{ key: keyof InventoryFilterParams; label: string; value: string }> = [];
    
    if (localFilters.sales_person) {
      tags.push({ key: 'sales_person', label: '业务员', value: localFilters.sales_person });
    }
    if (localFilters.asin) {
      tags.push({ key: 'asin', label: 'ASIN', value: localFilters.asin });
    }
    if (localFilters.warehouse_location) {
      tags.push({ key: 'warehouse_location', label: '库存点', value: localFilters.warehouse_location });
    }
    if (localFilters.inventory_status) {
      tags.push({ key: 'inventory_status', label: '库存状态', value: localFilters.inventory_status });
    }
    if (localFilters.date_from) {
      tags.push({ key: 'date_from', label: '开始日期', value: localFilters.date_from });
    }
    if (localFilters.date_to) {
      tags.push({ key: 'date_to', label: '结束日期', value: localFilters.date_to });
    }

    return tags;
  };

  // 筛选ASIN选项
  const filteredAsins = options.asins.filter(asin => 
    asin.toLowerCase().includes(asinSearchTerm.toLowerCase())
  );

  // 初始化选项
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // 同步外部筛选状态
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const activeFilters = getActiveFilterTags();

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* 筛选条件输入区域 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 业务员筛选 */}
            <div className="space-y-2">
              <Label htmlFor="sales-person">业务员</Label>
              <Select
                value={localFilters.sales_person || ''}
                onValueChange={(value) => updateLocalFilter('sales_person', value || undefined)}
                disabled={optionsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择业务员" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  {options.sales_persons.map(person => (
                    <SelectItem key={person} value={person}>
                      {person}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ASIN筛选 */}
            <div className="space-y-2">
              <Label htmlFor="asin">ASIN</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="asin"
                  placeholder="搜索ASIN"
                  value={localFilters.asin || ''}
                  onChange={(e) => updateLocalFilter('asin', e.target.value || undefined)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 库存点筛选 */}
            <div className="space-y-2">
              <Label htmlFor="warehouse-location">库存点</Label>
              <Select
                value={localFilters.warehouse_location || ''}
                onValueChange={(value) => updateLocalFilter('warehouse_location', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择库存点" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  {options.warehouse_locations.map(location => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 库存状态筛选 */}
            <div className="space-y-2">
              <Label htmlFor="inventory-status">库存状态</Label>
              <Select
                value={localFilters.inventory_status || ''}
                onValueChange={(value) => updateLocalFilter('inventory_status', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  {options.inventory_statuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
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
                value={localFilters.date_from || ''}
                onChange={(e) => updateLocalFilter('date_from', e.target.value || undefined)}
              />
            </div>

            {/* 结束日期 */}
            <div className="space-y-2">
              <Label htmlFor="date-to">结束日期</Label>
              <Input
                id="date-to"
                type="date"
                value={localFilters.date_to || ''}
                onChange={(e) => updateLocalFilter('date_to', e.target.value || undefined)}
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={applyFilters}
                disabled={loading}
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                应用筛选
              </Button>
              
              <Button
                variant="outline"
                onClick={resetFilters}
                disabled={loading}
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                重置
              </Button>
            </div>

            {/* 活跃筛选数量 */}
            {activeFilters.length > 0 && (
              <Badge variant="secondary">
                {activeFilters.length} 个筛选条件
              </Badge>
            )}
          </div>

          {/* 活跃筛选标签 */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(tag => (
                <Badge
                  key={tag.key}
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  <span className="text-xs text-muted-foreground">{tag.label}:</span>
                  <span>{tag.value}</span>
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => removeFilter(tag.key)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}