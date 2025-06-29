import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: {
    asin: string;
    locale: string;
  };
  searchParams: {
    warehouse?: string;
  };
}

// 模拟数据获取函数（实际应该从API获取）
async function getAnalysisData(asin: string, warehouse?: string) {
  // 这里应该调用API获取具体的分析数据
  return {
    product: {
      asin,
      name: '示例产品名称',
      warehouse_location: warehouse || '英国',
    },
    current: {
      total_inventory: 1500,
      fba_available: 1200,
      fba_in_transit: 200,
      local_warehouse: 100,
      daily_revenue: 850.5,
      avg_sales: 45,
      inventory_status: '周转合格',
      inventory_turnover_days: 15.5,
    },
    trends: {
      inventory_change: 5.2, // 正数为增长，负数为下降
      revenue_change: -2.1,
      sales_change: 8.7,
    },
    history: [
      { date: '2024-01-01', inventory: 1450, revenue: 820, sales: 42 },
      { date: '2024-01-02', inventory: 1480, revenue: 845, sales: 44 },
      { date: '2024-01-03', inventory: 1500, revenue: 850, sales: 45 },
    ]
  };
}

function TrendIndicator({ value }: { value: number }) {
  if (value > 0) {
    return (
      <div className="flex items-center text-green-600">
        <TrendingUp className="h-4 w-4 mr-1" />
        <span>+{value.toFixed(1)}%</span>
      </div>
    );
  } else if (value < 0) {
    return (
      <div className="flex items-center text-red-600">
        <TrendingDown className="h-4 w-4 mr-1" />
        <span>{value.toFixed(1)}%</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center text-gray-500">
        <Minus className="h-4 w-4 mr-1" />
        <span>0%</span>
      </div>
    );
  }
}

export default async function AnalysisPage({ params, searchParams }: Props) {
  const data = await getAnalysisData(params.asin, searchParams.warehouse);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回列表
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">产品数据分析</h1>
            <p className="text-sm text-muted-foreground">
              ASIN: {data.product.asin} | 库存点: {data.product.warehouse_location}
            </p>
          </div>
        </div>
      </div>

      {/* 产品基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>产品信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">ASIN</label>
              <p className="font-mono text-lg">{data.product.asin}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">产品名称</label>
              <p className="text-lg">{data.product.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">库存点</label>
              <p className="text-lg">{data.product.warehouse_location}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 关键指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">总库存</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {data.current.total_inventory.toLocaleString()}
            </div>
            <TrendIndicator value={data.trends.inventory_change} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">日均销售额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              ¥{data.current.daily_revenue.toLocaleString()}
            </div>
            <TrendIndicator value={data.trends.revenue_change} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">平均销量</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {data.current.avg_sales}
            </div>
            <TrendIndicator value={data.trends.sales_change} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">库存状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <Badge 
                variant={
                  data.current.inventory_status === '库存不足' ? 'destructive' :
                  data.current.inventory_status === '周转合格' ? 'default' : 'secondary'
                }
              >
                {data.current.inventory_status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              周转天数: {data.current.inventory_turnover_days} 天
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 库存详情 */}
      <Card>
        <CardHeader>
          <CardTitle>库存详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {data.current.fba_available.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">FBA可用</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 mb-2">
                {data.current.fba_in_transit.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">FBA在途</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-2">
                {data.current.local_warehouse.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">本地仓</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 历史数据趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>历史数据趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>图表组件开发中...</p>
            <p className="text-sm mt-2">将显示库存、销售额、销量的历史趋势图</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}