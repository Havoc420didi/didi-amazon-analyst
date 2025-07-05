import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/config';
import { rpaConfigurations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * RPA配置管理API
 * 为RPA系统提供动态配置更新
 */
export async function GET() {
  try {
    // 获取最新的RPA配置
    const config = await db
      .select()
      .from(rpaConfigurations)
      .where(eq(rpaConfigurations.isActive, true))
      .limit(1);
    
    const defaultConfig = {
      hard_criteria: {
        min_impressions: 500,
        min_likes: 100,
        min_like_rate: 2.0,
        min_running_days: 7,
        min_comments: 20
      },
      schedule_config: {
        daily_scan_time: "08:00",
        competitor_monitor_time: "12:00",
        daily_report_time: "17:00"
      },
      alert_thresholds: {
        high_potential_impressions: 10000,
        high_potential_like_rate: 3.0,
        data_quality_threshold: 0.95
      }
    };
    
    return NextResponse.json({
      success: true,
      config: config[0]?.configuration || defaultConfig,
      version: config[0]?.version || "1.0.0"
    });
    
  } catch (error) {
    console.error('获取RPA配置失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // 停用当前配置
    await db
      .update(rpaConfigurations)
      .set({ isActive: false })
      .where(eq(rpaConfigurations.isActive, true));
    
    // 创建新配置
    await db.insert(rpaConfigurations).values({
      version: data.version || "1.0.0",
      configuration: JSON.stringify(data.config),
      isActive: true,
      createdAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'RPA配置更新成功'
    });
    
  } catch (error) {
    console.error('RPA配置更新失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}