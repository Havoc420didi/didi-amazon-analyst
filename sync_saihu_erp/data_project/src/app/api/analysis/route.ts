import { NextResponse } from 'next/server';
import { parseExcelFile } from '@/services/excelService';
import { ProductData } from '@/types/product';
import { 
  calculateInventoryPoints, 
  mergeInventoryPoints, 
  calculateSalesPersonStats, 
  calculateStats 
} from '@/services/analysisService';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: '请上传Excel文件' },
        { status: 400 }
      );
    }

    // 验证文件格式
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: '请上传有效的Excel文件' },
        { status: 400 }
      );
    }

    // 解析Excel文件
    const products = await parseExcelFile(file);
    
    // 1. 合并数据
    const mergedProducts = mergeInventoryPoints(products);
    
    // 2. 计算库存点数据
    const inventoryPoints = calculateInventoryPoints(mergedProducts);
    
    // 3. 计算业务员统计数据
    // 计算每个业务员的统计数据，并确保周转超标和库存不足的产品数量正确
    const salesPersonStats = calculateSalesPersonStats(mergedProducts);
    
    // 确保每个业务员的统计数据被正确计算
    console.log('业务员统计数据:', salesPersonStats.map(s => ({
      salesPerson: s.salesPerson,
      inventoryCount: s.inventoryPointCount,
      lowInventory: s.lowInventory,
      turnoverExceeded: s.turnoverExceeded
    })));
    
    // 4. 计算统计数据
    const stats = calculateStats(inventoryPoints);

    // 返回分析结果
    console.log('总计周转超标产品数:', stats.turnoverExceededCount);
    console.log('总计库存不足产品数:', stats.lowInventoryCount);
    return NextResponse.json({
      stats,                // 统计数据
      salesPersonStats,     // 业务员统计数据
      inventoryPoints,      // 库存点数据列表
      mergedProducts        // 合并后的产品数据
    });

  } catch (error) {
    console.error('请求处理错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '数据处理失败' },
      { status: 500 }
    );
  }
}