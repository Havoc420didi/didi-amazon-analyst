import { NextRequest, NextResponse } from 'next/server';
import { AIAnalysisModel } from '@/models/ai-analysis';
import { z } from 'zod';

// 评价任务的schema
const rateTaskSchema = z.object({
  rating: z.number().min(1).max(5),
  feedback: z.string().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const taskId = parseInt(resolvedParams.id);
    
    if (isNaN(taskId)) {
      return NextResponse.json({
        success: false,
        error: '无效的任务ID'
      }, { status: 400 });
    }

    const task = await AIAnalysisModel.getTask(taskId);
    
    if (!task) {
      return NextResponse.json({
        success: false,
        error: '任务不存在'
      }, { status: 404 });
    }

    // 解析产品数据
    let productData = null;
    try {
      productData = JSON.parse(task.product_data);
    } catch (error) {
      console.error('Failed to parse product data:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...task,
        product_data: productData // 返回解析后的对象
      }
    });

  } catch (error) {
    console.error('Get analysis task error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}

// 更新任务评价
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const taskId = parseInt(resolvedParams.id);
    
    if (isNaN(taskId)) {
      return NextResponse.json({
        success: false,
        error: '无效的任务ID'
      }, { status: 400 });
    }

    const body = await request.json();
    
    // 验证请求参数
    const validationResult = rateTaskSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '请求参数无效',
        details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      }, { status: 400 });
    }

    const { rating, feedback } = validationResult.data;

    // 检查任务是否存在
    const existingTask = await AIAnalysisModel.getTask(taskId);
    if (!existingTask) {
      return NextResponse.json({
        success: false,
        error: '任务不存在'
      }, { status: 404 });
    }

    // 只能评价已完成的任务
    if (existingTask.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: '只能评价已完成的任务'
      }, { status: 400 });
    }

    // 更新评价
    const updatedTask = await AIAnalysisModel.rateTask(taskId, { rating, feedback });

    return NextResponse.json({
      success: true,
      message: '评价提交成功',
      data: updatedTask
    });

  } catch (error) {
    console.error('Rate analysis task error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}

// 删除任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const taskId = parseInt(resolvedParams.id);
    
    if (isNaN(taskId)) {
      return NextResponse.json({
        success: false,
        error: '无效的任务ID'
      }, { status: 400 });
    }

    const success = await AIAnalysisModel.deleteTask(taskId);
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: '任务不存在或删除失败'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: '任务删除成功'
    });

  } catch (error) {
    console.error('Delete analysis task error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}