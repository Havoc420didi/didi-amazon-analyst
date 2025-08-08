import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Brain, BarChart3, Target, Calendar, Clock, TrendingUp as TrendingUpIcon } from 'lucide-react';
import Link from 'next/link';
import { AnalysisPanel, AnalysisHistory } from '@/components/ai-analysis';
import { ProductAnalysisData } from '@/types/ai-analysis';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { AnalysisPeriodSelector } from '@/components/ai-analysis/analysis-period-selector';
import { AnalysisTrigger } from '@/components/ai-analysis/analysis-trigger';
import { QuickAnalysisButtons } from '@/components/ai-analysis/quick-analysis-buttons';

interface Props {
  params: Promise<{
    asin: string;
    locale: string;
  }>;
  searchParams: Promise<{
    warehouse?: string;
  }>;
}

// 从API获取产品分析数据
async function getAnalysisData(asin: string, warehouse?: string) {
  try {
    console.log(`[getAnalysisData] 开始获取ASIN: ${asin}, 库存点: ${warehouse || '未指定'}`);
    
    // 获取最新的产品记录
    const latestUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/inventory?asin=${asin}&warehouse_location=${warehouse || ''}&latest_only=true&limit=1`;
    console.log(`[getAnalysisData] 请求最新数据: ${latestUrl}`);
    
    const latestResponse = await fetch(latestUrl);
    const latestResult = await latestResponse.json();
    
    console.log(`[getAnalysisData] 最新数据响应:`, {
      success: latestResult.success,
      dataLength: latestResult.data?.length || 0,
      error: latestResult.error || latestResult.message
    });
    
    // 获取历史数据（最近30天）
    const historyUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/inventory?asin=${asin}&warehouse_location=${warehouse || ''}&limit=30&sort_by=date&sort_order=desc`;
    console.log(`[getAnalysisData] 请求历史数据: ${historyUrl}`);
    
    const historyResponse = await fetch(historyUrl);
    const historyResult = await historyResponse.json();
    
    console.log(`[getAnalysisData] 历史数据响应:`, {
      success: historyResult.success,
      dataLength: historyResult.data?.length || 0,
      error: historyResult.error || historyResult.message
    });
    
    if (!latestResult.success || !latestResult.data || latestResult.data.length === 0) {
      console.error(`[getAnalysisData] 未找到产品数据:`, {
        asin,
        warehouse,
        latestResult
      });
      throw new Error(`未找到产品数据 - ASIN: ${asin}, 库存点: ${warehouse || '未指定'}`);
    }
    
    const current = latestResult.data[0];
    const history = historyResult.success ? historyResult.data : [];
    
    console.log(`[getAnalysisData] 数据获取成功:`, {
      currentData: {
        asin: current.asin,
        product_name: current.product_name,
        warehouse_location: current.warehouse_location,
        total_inventory: current.total_inventory,
        daily_revenue: current.daily_revenue
      },
      historyCount: history.length
    });
    
    // 计算趋势（如果有历史数据）
    let trends = {
      inventory_change: 0,
      revenue_change: 0,
      sales_change: 0,
    };
    
    if (history.length > 1) {
      const previous = history[1]; // 前一天的数据
      trends = {
        inventory_change: previous ? ((current.total_inventory - previous.total_inventory) / previous.total_inventory * 100) : 0,
        revenue_change: previous ? ((current.daily_revenue - previous.daily_revenue) / previous.daily_revenue * 100) : 0,
        sales_change: previous ? ((current.avg_sales - previous.avg_sales) / previous.avg_sales * 100) : 0,
      };
      
      console.log(`[getAnalysisData] 趋势计算:`, trends);
    }
    
    return {
      product: {
        asin: current.asin,
        name: current.product_name,
        warehouse_location: current.warehouse_location,
      },
      current: {
        total_inventory: current.total_inventory,
        fba_available: current.fba_available,
        fba_in_transit: current.fba_in_transit,
        local_warehouse: current.local_warehouse,
        daily_revenue: current.daily_revenue,
        avg_sales: current.avg_sales,
        inventory_status: current.inventory_status,
        inventory_turnover_days: current.inventory_turnover_days,
      },
      trends,
      history: history.map((record: any) => ({
        date: record.date,
        inventory: record.total_inventory,
        fba_available: record.fba_available,
        fba_in_transit: record.fba_in_transit,
        local_warehouse: record.local_warehouse,
        revenue: record.daily_revenue,
        sales: record.avg_sales,
        inventory_status: record.inventory_status,
      }))
    };
  } catch (error) {
    console.error('[getAnalysisData] 获取分析数据失败:', {
      asin,
      warehouse,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // 返回默认数据作为fallback
    return {
      product: {
        asin,
        name: '产品数据加载失败',
        warehouse_location: warehouse || '未知',
      },
      current: {
        total_inventory: 0,
        fba_available: 0,
        fba_in_transit: 0,
        local_warehouse: 0,
        daily_revenue: 0,
        avg_sales: 0,
        inventory_status: '未知',
        inventory_turnover_days: 0,
      },
      trends: {
        inventory_change: 0,
        revenue_change: 0,
        sales_change: 0,
      },
      history: []
    };
  }
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
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations('ai_analysis');
  const data = await getAnalysisData(resolvedParams.asin, resolvedSearchParams.warehouse);

  // 转换数据格式为AI分析所需的格式
  const productAnalysisData: ProductAnalysisData = {
    asin: data.product.asin,
    product_name: data.product.name,
    warehouse_location: data.product.warehouse_location,
    sales_person: '系统数据', // 默认值，可以从实际数据中获取
    total_inventory: data.current.total_inventory,
    fba_available: data.current.fba_available,
    fba_in_transit: data.current.fba_in_transit,
    local_warehouse: data.current.local_warehouse,
    avg_sales: data.current.avg_sales,
    daily_revenue: data.current.daily_revenue,
    inventory_turnover_days: data.current.inventory_turnover_days,
    inventory_status: data.current.inventory_status,
    ad_impressions: 0, // 默认值，如果有广告数据可以替换
    ad_clicks: 0,
    ad_spend: 0,
    ad_orders: 0,
    trends: data.trends,
    history: data.history
  };

  // 创建库存点数据用于AI分析
  const inventoryPoint = {
    asin: data.product.asin,
    productName: data.product.name,
    marketplace: data.product.warehouse_location,
    salesPerson: '系统数据',
    totalInventory: data.current.total_inventory,
    fbaAvailable: data.current.fba_available,
    fbaInbound: data.current.fba_in_transit,
    localAvailable: data.current.local_warehouse,
    averageSales: data.current.avg_sales,
    dailySalesAmount: data.current.daily_revenue,
    turnoverDays: data.current.inventory_turnover_days,
    adImpressions: 0,
    adClicks: 0,
    adSpend: 0,
    adOrderCount: 0,
    isOutOfStock: data.current.inventory_status === '库存不足',
    isLowInventory: data.current.inventory_status === '库存不足',
    isTurnoverExceeded: data.current.inventory_status === '周转超标',
    isZeroSales: data.current.avg_sales === 0,
    isEffectivePoint: data.current.daily_revenue > 0,
    isEffectiveInventoryPoint: data.current.daily_revenue >= 16.7
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('back_to_list')}
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{t('page_title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('product_info.fields.asin')}: {data.product.asin} | {t('product_info.fields.warehouse_location')}: {data.product.warehouse_location}
            </p>
          </div>
        </div>
      </div>

      {/* 第一部分：产品信息和库存信息 */}
      <Card>
        <CardHeader>
          <CardTitle>📦 {t('product_info.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 产品基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('product_info.fields.asin')}</label>
              <p className="font-mono text-lg font-bold">{data.product.asin}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('product_info.fields.product_name')}</label>
              <p className="text-lg">{data.product.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('product_info.fields.warehouse_location')}</label>
              <p className="text-lg">{data.product.warehouse_location}</p>
            </div>
          </div>

          {/* 数据加载失败提示 */}
          {data.product.name === '产品数据加载失败' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <div className="text-red-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    无法加载产品数据，请检查ASIN是否正确或稍后重试。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 库存详情 */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3">{t('product_info.inventory_data')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg border">
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  {data.current.total_inventory.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">{t('product_info.fields.total_inventory')}</p>
                <TrendIndicator value={data.trends.inventory_change} />
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg border">
                <div className="text-2xl font-bold text-indigo-600 mb-2">
                  {data.current.fba_available.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">FBA可用</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border">
                <div className="text-2xl font-bold text-yellow-600 mb-2">
                  {data.current.fba_in_transit.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">FBA在途</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border">
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {data.current.local_warehouse.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">本地仓</p>
              </div>
            </div>
          </div>

          {/* 销售和状态信息 */}
          <div>
            <h4 className="text-lg font-semibold mb-3">销售表现</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border">
                <div className="text-2xl font-bold text-green-600 mb-2">
                  ${data.current.daily_revenue.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">日均销售额</p>
                <TrendIndicator value={data.trends.revenue_change} />
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg border">
                <div className="text-2xl font-bold text-purple-600 mb-2">
                  {data.current.avg_sales}
                </div>
                <p className="text-sm text-muted-foreground">平均销量</p>
                <TrendIndicator value={data.trends.sales_change} />
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border">
                <div className="mb-2">
                  <Badge 
                    variant={
                      data.current.inventory_status === '库存不足' ? 'destructive' :
                      data.current.inventory_status === '周转合格' ? 'default' : 'secondary'
                    }
                    className="text-lg px-3 py-1"
                  >
                    {data.current.inventory_status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  周转天数: {data.current.inventory_turnover_days} 天
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 第二部分：AI运营决策分析 */}
      <AnalysisPanel 
        productData={productAnalysisData}
        executor="inventory-analysis"
        key={`analysis-${data.product.asin}-${data.product.warehouse_location}`}
      />

      {/* 新增：多日AI分析区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            多日AI智能分析
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            基于历史数据的深度AI分析，支持多种时间维度和聚合方式
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：分析周期配置 */}
            <div>
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                分析配置
              </h4>
              <div className="space-y-4">
                {/* 快速选择按钮 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-3 block">快速选择</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <Target className="h-4 w-4" />
                      <span className="text-xs">单日</span>
                      <Badge variant="secondary" className="text-xs px-1">实时</Badge>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <TrendingUpIcon className="h-4 w-4" />
                      <span className="text-xs">3日</span>
                      <Badge variant="secondary" className="text-xs px-1">趋势</Badge>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-xs">7日</span>
                      <Badge variant="secondary" className="text-xs px-1">周报</Badge>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">30日</span>
                      <Badge variant="secondary" className="text-xs px-1">月报</Badge>
                    </Button>
                  </div>
                </div>

                {/* 聚合方法说明 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-medium text-blue-900 mb-2">聚合方法说明</h5>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• <strong>平均值</strong>: 计算期间内指标的平均值，适合日常运营分析</p>
                    <p>• <strong>最新值</strong>: 使用最近一天的数据，保持数据时效性</p>
                    <p>• <strong>累积值</strong>: 计算期间内的累积总量，适合评估总体表现</p>
                    <p>• <strong>趋势加权</strong>: 近期数据权重更高，捕捉最新变化趋势</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：AI分析触发 */}
            <div>
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                AI分析触发
              </h4>
              <div className="space-y-4">
                {/* 分析触发组件 */}
                <AnalysisTrigger 
                  inventoryPoint={inventoryPoint}
                  size="lg"
                  variant="default"
                  className="w-full"
                />
                
                {/* 分析说明 */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h5 className="font-medium text-purple-900 mb-2">多日分析优势</h5>
                  <div className="text-sm text-purple-800 space-y-1">
                    <p>• <strong>数据稳定性</strong>: 基于多日数据，减少单日波动影响</p>
                    <p>• <strong>趋势识别</strong>: 更好地识别产品表现趋势</p>
                    <p>• <strong>深度洞察</strong>: 提供更全面的运营建议</p>
                    <p>• <strong>智能聚合</strong>: 自动选择最适合的聚合方式</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 第三部分：分析历史 */}
      <AnalysisHistory 
        asin={data.product.asin}
        warehouseLocation={data.product.warehouse_location}
        key={`history-${data.product.asin}-${data.product.warehouse_location}`}
      />

      {/* 第四部分：历史数据趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>📈 历史数据趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">日期</th>
                  <th className="text-right p-3 font-semibold">总库存</th>
                  <th className="text-right p-3 font-semibold">FBA可用</th>
                  <th className="text-right p-3 font-semibold">FBA在途</th>
                  <th className="text-right p-3 font-semibold">本地仓</th>
                  <th className="text-right p-3 font-semibold">日均销售额</th>
                  <th className="text-right p-3 font-semibold">平均销量</th>
                  <th className="text-center p-3 font-semibold">库存状态</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((record: any, index: number) => (
                  <tr key={record.date} className={`border-b ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-3 text-sm font-mono">{record.date}</td>
                    <td className="p-3 text-sm text-right">{record.inventory.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right">{record.fba_available.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right">{record.fba_in_transit.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right">{record.local_warehouse.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right">${record.revenue.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right">{record.sales}</td>
                    <td className="p-3 text-center">
                      <Badge 
                        variant={
                          record.inventory_status === '库存不足' ? 'destructive' :
                          record.inventory_status === '周转合格' ? 'default' : 
                          record.inventory_status === '周转超标' ? 'secondary' : 'outline'
                        } 
                        className="text-xs"
                      >
                        {record.inventory_status || '未知'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {data.history.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>暂无历史数据</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}