import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/config';
import { rpaAnalysisResults } from '@/db/schema';

/**
 * RPA数据同步API接口
 * 接收RPA系统的分析结果并存储到Web系统数据库
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // 验证数据格式
    if (!data.analysis_data || !data.source === 'rpa_system') {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }
    
    const analysisData = data.analysis_data;
    
    // 存储到数据库
    const result = await db.insert(rpaAnalysisResults).values({
      timestamp: analysisData.timestamp,
      totalProducts: analysisData.total_products,
      highPotentialProducts: analysisData.high_potential_products,
      aLevelProducts: JSON.stringify(analysisData.a_level_products),
      marketTrends: JSON.stringify(analysisData.market_trends),
      processingTime: analysisData.processing_time,
      dataQualityScore: analysisData.data_quality_score,
      syncTimestamp: data.sync_timestamp,
      createdAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'RPA数据同步成功',
      recordId: result.insertId
    });
    
  } catch (error) {
    console.error('RPA数据同步失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}