import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { 
  ProductData, 
  ReportType, 
  InventoryPoint 
} from '@/types/product';
import { 
  calculateInventoryPoints,
  calculateSalesPersonStats,
  generateReport
} from '@/services/analysisService';

function generateWorkbook(inventoryPoints: InventoryPoint[], salesPersonStats: any[], type: ReportType): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  let data: any[] = [];
  let sheetName = '';

  switch (type) {
    case 'inventory':
      // 合并后的库存点数据表
      data = generateReport(inventoryPoints, 'inventory').map(point => ({
        'ASIN': point.asin,
        '品名': point.productName,
        'SKU': point.sku,
        '产品标签': point.productTag,
        '业务员': point.salesPerson,
        '库存点(站点)': point.marketplace,
        '平均销量': point.averageSales,
        '总库存': point.totalInventory
      }));
      sheetName = '库存点数据表';
      break;

    case 'turnoverExceeded':
      // 周转超标情况表
      data = generateReport(inventoryPoints, 'turnoverExceeded').map(point => ({
        'ASIN': point.asin,
        '品名': point.productName,
        'SKU': point.sku,
        '产品标签': point.productTag,
        '业务员': point.salesPerson,
        '库存点(站点)': point.marketplace,
        '平均销量': point.averageSales,
        '总库存': point.totalInventory,
        '库存周转天数': point.turnoverDays
      }));
      sheetName = '周转超标情况表';
      break;

    case 'outOfStock':
      // 断货情况表
      data = generateReport(inventoryPoints, 'outOfStock').map(point => ({
        'ASIN': point.asin,
        '品名': point.productName,
        'SKU': point.sku,
        '产品标签': point.productTag,
        '业务员': point.salesPerson,
        '库存点(站点)': point.marketplace,
        '平均销量': point.averageSales,
        '总库存': point.totalInventory
      }));
      sheetName = '断货情况表';
      break;

    case 'zeroSales':
      // 0动销情况表
      data = generateReport(inventoryPoints, 'zeroSales').map(point => ({
        'ASIN': point.asin,
        '品名': point.productName,
        'SKU': point.sku,
        '产品标签': point.productTag,
        '业务员': point.salesPerson,
        '库存点(站点)': point.marketplace,
        '平均销量': point.averageSales,
        '总库存': point.totalInventory
      }));
      sheetName = '0动销情况表';
      break;
      
    default:
      // 业务员统计表
      data = salesPersonStats.map(stat => ({
        '业务员': stat.salesPerson,
        '库存点数量': stat.inventoryPointCount
      }));
      sheetName = '业务员统计表';
      break;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  return workbook;
}

export async function POST(request: Request) {
  try {
    const { inventoryPoints, salesPersonStats, type } = await request.json();
    
    if (!inventoryPoints || !type) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const workbook = generateWorkbook(inventoryPoints, salesPersonStats, type);
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // 生成报表名称
    let reportName = '';
    switch(type) {
      case 'inventory': reportName = '库存点数据表'; break;
      case 'turnoverExceeded': reportName = '周转超标情况表'; break;
      case 'outOfStock': reportName = '断货情况表'; break;
      case 'zeroSales': reportName = '0动销情况表'; break;
      default: reportName = '业务员统计表';
    }
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${reportName}-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });

  } catch (error) {
    console.error('报表生成错误:', error);
    return NextResponse.json(
      { error: '报表生成失败' },
      { status: 500 }
    );
  }
} 