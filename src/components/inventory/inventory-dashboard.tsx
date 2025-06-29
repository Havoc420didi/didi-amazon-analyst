'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, RefreshCw, BarChart3, Package, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import InventoryDataTable from './inventory-data-table';

interface InventoryStats {
  total_products: number;
  total_inventory: number;
  total_daily_revenue: number;
  total_ad_spend: number;
  inventory_status_distribution: {
    [key: string]: number;
  };
  warehouse_distribution: {
    [key: string]: number;
  };
}

export default function InventoryDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const navigateToUpload = () => {
    router.push('/inventory/upload');
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inventory/stats');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      } else {
        console.error('Failed to fetch stats:', result.message);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总库存</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : stats?.total_inventory.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? '-' : `${stats?.total_products || 0} 个产品`}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">日均销售额</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : `¥${stats?.total_daily_revenue.toLocaleString() || '0'}`}
            </div>
            <p className="text-xs text-muted-foreground">所有库存点合计</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">广告花费</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : `¥${stats?.total_ad_spend.toLocaleString() || '0'}`}
            </div>
            <p className="text-xs text-muted-foreground">日均广告投入</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">库存告警</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : stats?.inventory_status_distribution?.['库存不足'] || '0'}
            </div>
            <p className="text-xs text-muted-foreground">库存不足产品数</p>
          </CardContent>
        </Card>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            共 {loading ? '-' : stats?.total_products || 0} 条记录
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            disabled
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

      {/* 条件渲染：有数据显示数据表格，无数据显示空状态 */}
      {!loading && stats && stats.total_products > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>库存数据概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 库存状态分布 */}
                <div>
                  <h4 className="text-sm font-medium mb-3">库存状态分布</h4>
                  <div className="space-y-2">
                    {Object.entries(stats.inventory_status_distribution || {}).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-sm">{status}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 库存点分布 */}
                <div>
                  <h4 className="text-sm font-medium mb-3">库存点分布</h4>
                  <div className="space-y-2">
                    {Object.entries(stats.warehouse_distribution || {}).map(([warehouse, count]) => (
                      <div key={warehouse} className="flex justify-between items-center">
                        <span className="text-sm">{warehouse}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 库存点数据列表 */}
          <InventoryDataTable />
        </>
      ) : !loading && (!stats || stats.total_products === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <BarChart3 className="h-16 w-16 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">暂无产品数据</h3>
                <p className="text-sm text-muted-foreground">
                  请先上传Excel文件导入产品数据，然后即可查看详细的数据分析
                </p>
              </div>
              <Button onClick={navigateToUpload}>
                <Upload className="h-4 w-4 mr-2" />
                开始上传数据
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 功能介绍 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>数据分析功能</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <div>• 📊 实时库存状态监控</div>
              <div>• 🎯 多维度数据筛选（业务员、ASIN、库存点）</div>
              <div>• 📈 销量和广告数据趋势分析</div>
              <div>• ⚠️ 库存告警和状态标识</div>
              <div>• 📅 历史数据追踪和对比</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>支持的数据格式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <div>• 📄 Excel格式：.xlsx、.xls</div>
              <div>• 📋 CSV格式：.csv</div>
              <div>• 📦 库存数据：FBA可用、在途、本地仓</div>
              <div>• 💰 销售数据：平均销量、日均销售额</div>
              <div>• 📢 广告数据：曝光、点击、花费、ACOS</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}