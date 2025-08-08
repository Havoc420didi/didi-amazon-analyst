import { NextRequest, NextResponse } from 'next/server';

interface SyncStatus {
  status: 'running' | 'success' | 'failed' | 'warning';
  message: string;
  timestamp: string;
  system: string;
  progress?: number;
  metadata?: {
    source?: string;
    total_records?: number;
    duration_seconds?: number;
    step?: string;
    [key: string]: any;
  };
}

// 内存存储 - 保存最新的同步状态
let syncStatusHistory: SyncStatus[] = [];
let currentSyncStatus: SyncStatus = {
  status: 'stopped',
  message: 'RPA系统初始化',
  timestamp: new Date().toISOString(),
  system: 'saihu-erp-sync',
  progress: 0,
  metadata: {
    source: 'system',
    step: 'idle'
  }
} as any;

// 最大历史记录数
const MAX_HISTORY = 100;

/**
 * RPA系统状态API - 接收Python脚本状态更新
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // 验证必需字段
    if (!data.status || !data.timestamp) {
      return NextResponse.json(
        { error: '缺少必需字段: status 或 timestamp' },
        { status: 400 }
      );
    }

    // 验证状态值（扩展兼容Python状态）
    const validStatuses = ['running', 'success', 'failed', 'warning', 'started', 'processing', 'completed', 'error', 'stopped'];
    const statusMapping: Record<string, SyncStatus['status']> = {
      'started': 'running',
      'processing': 'running', 
      'completed': 'success',
      'error': 'failed'
    };
    
    const normalizedStatus = statusMapping[data.status] || data.status;
    if (!validStatuses.includes(normalizedStatus)) {
      return NextResponse.json(
        { error: `无效的状态值: ${data.status}, 已映射为 ${normalizedStatus}` },
        { status: 200 }
      );
    }

    // 构建状态对象
    const syncStatus: SyncStatus = {
      status: normalizedStatus,
      message: data.message,
      timestamp: data.timestamp,
      system: data.system || 'saihu-erp-sync',
      progress: data.progress,
      metadata: {
        source: data.source || 'python-script',
        records_processed: data.details?.records_processed,
        errors: data.details?.errors,
        ...data.details,
        ...data.metadata
      }
    };

    // 更新当前状态
    currentSyncStatus = { ...syncStatus };
    
    // 添加到历史记录
    syncStatusHistory.unshift({ ...syncStatus });
    
    // 限制历史记录数量
    if (syncStatusHistory.length > MAX_HISTORY) {
      syncStatusHistory = syncStatusHistory.slice(0, MAX_HISTORY);
    }

    console.log(`[${new Date().toISOString()}] RPA状态更新: ${syncStatus.status} - ${syncStatus.message}`);
    
    return NextResponse.json({
      success: true,
      message: 'RPA状态更新成功',
      data: syncStatus,
      history_count: syncStatusHistory.length
    });
    
  } catch (error) {
    console.error('RPA状态更新失败:', error);
    return NextResponse.json(
      { error: '服务器内部错误无法处理状态更新' },
      { status: 500 }
    );
  }
}

/**
 * 获取RPA系统状态
 * 支持可选参数: ?recent=5 获取最近n条记录
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recent = parseInt(searchParams.get('recent') || '0', 10);
    
    let responseData: any = {
      current: currentSyncStatus,
      lastUpdate: currentSyncStatus.timestamp
    };

    // 如果请求最近记录，返回历史
    if (recent > 0) {
      const recentRecords = syncStatusHistory.slice(0, Math.min(recent, MAX_HISTORY));
      responseData.recent = recentRecords;
      responseData.history_count = syncStatusHistory.length;
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('获取RPA状态失败:', error);
    return NextResponse.json({
      error: '无法获取RPA系统状态'
    }, { status: 500 });
  }
}

/**
 * 清理历史记录（管理员接口）
 */
export async function DELETE(_request: NextRequest) {
  try {
    const clearCount = syncStatusHistory.length;
    syncStatusHistory = [];
    
    // 重置当前状态
    currentSyncStatus = {
      status: 'stopped',
      message: 'RPA系统状态已重置',
      timestamp: new Date().toISOString(),
      system: 'saihu-erp-sync',
      progress: 0,
      metadata: {
        source: 'admin',
        step: 'reset'
      }
    } as any;

    return NextResponse.json({
      success: true,
      message: `已清理 ${clearCount} 条历史记录`,
      data: currentSyncStatus
    });
    
  } catch (error) {
    console.error('清理RPA状态失败:', error);
    return NextResponse.json({
      error: '无法清理RPA状态历史'
    }, { status: 500 });
  }
}