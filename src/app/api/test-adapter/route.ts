import { NextRequest, NextResponse } from 'next/server';
import { SaiHuAdapter } from '@/lib/adapters/saihu-adapter';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 开始测试 SaiHuAdapter...');
    
    const saiHuAdapter = new SaiHuAdapter();
    
    // 测试 getAdSummary 方法
    console.log('测试 getAdSummary...');
    const summaryResult = await saiHuAdapter.getAdSummary({});
    console.log('summaryResult:', summaryResult);
    
    // 测试 getAdTrends 方法
    console.log('测试 getAdTrends...');
    try {
      const trendsResult = await saiHuAdapter.getAdTrends({});
      console.log('trendsResult:', trendsResult);
    } catch (trendsError) {
      console.error('getAdTrends 错误:', trendsError);
    }
    
    // 测试 getAdDistribution 方法
    console.log('测试 getAdDistribution...');
    try {
      const distributionResult = await saiHuAdapter.getAdDistribution();
      console.log('distributionResult:', distributionResult);
    } catch (distError) {
      console.error('getAdDistribution 错误:', distError);
    }
    
    // 测试 getInventoryPoints 方法
    console.log('测试 getInventoryPoints...');
    try {
      const pointsResult = await saiHuAdapter.getInventoryPoints({});
      console.log('pointsResult:', pointsResult);
    } catch (pointsError) {
      console.error('getInventoryPoints 错误:', pointsError);
    }
    
    return NextResponse.json({
      success: true,
      message: '测试完成，查看服务器日志获取详细信息'
    });
    
  } catch (error) {
    console.error('SaiHuAdapter 测试错误:', error);
    return NextResponse.json({
      success: false,
      message: 'SaiHuAdapter 测试失败',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';