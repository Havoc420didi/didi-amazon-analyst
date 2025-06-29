import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { 
  ExcelRowSchema, 
  transformExcelRowToRecord,
  CreateInventoryRecordSchema 
} from '@/lib/inventory-schema';
import { upsertInventoryRecords } from '@/models/inventory';
import type { ExcelUploadResult } from '@/types/inventory';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadDate = formData.get('date') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, message: '请选择要上传的文件' },
        { status: 400 }
      );
    }

    if (!uploadDate) {
      return NextResponse.json(
        { success: false, message: '请选择数据日期' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'text/plain', // .csv (alternative MIME type)
      'application/csv', // .csv (alternative MIME type)
      '' // 空的MIME类型，允许通过文件扩展名验证
    ];

    // 检查文件扩展名
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      return NextResponse.json(
        { success: false, message: '文件格式不支持，请上传Excel(.xlsx, .xls)或CSV文件' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // 获取第一个工作表
    const worksheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[worksheetName];
    
    // 转换为JSON数据
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return NextResponse.json(
        { success: false, message: '文件内容为空' },
        { status: 400 }
      );
    }

    // 调试：打印字段名
    if (rawData.length > 0) {
      console.log('CSV字段名:', Object.keys(rawData[0]));
      console.log('第一行数据:', rawData[0]);
    }

    // 解析和验证数据
    const result: ExcelUploadResult = {
      success: true,
      message: '',
      total_rows: rawData.length,
      success_count: 0,
      error_count: 0,
      errors: []
    };

    const validRecords = [];

    for (let i = 0; i < rawData.length; i++) {
      const rowIndex = i + 1; // Excel行号从1开始
      const rowData = rawData[i] as any;

      try {
        // 数据清洗和格式化
        const cleanedRow = cleanRowData(rowData);
        
        // 验证Excel行格式
        const validatedExcelRow = ExcelRowSchema.parse(cleanedRow);
        
        // 转换为数据库记录格式
        const record = transformExcelRowToRecord(validatedExcelRow, uploadDate);
        
        // 验证数据库记录格式
        const validatedRecord = CreateInventoryRecordSchema.parse(record);
        
        validRecords.push(validatedRecord);
        result.success_count++;
        
      } catch (error) {
        result.error_count++;
        result.errors?.push({
          row: rowIndex,
          message: error instanceof Error ? error.message : '数据格式错误',
          data: rowData
        });
      }
    }

    // 如果有有效数据，则插入数据库
    if (validRecords.length > 0) {
      try {
        await upsertInventoryRecords(validRecords);
        result.message = `成功处理 ${result.success_count} 条记录`;
      } catch (dbError) {
        return NextResponse.json(
          { 
            success: false, 
            message: '数据库插入失败: ' + (dbError instanceof Error ? dbError.message : '未知错误')
          },
          { status: 500 }
        );
      }
    } else {
      result.success = false;
      result.message = '没有有效的数据可以导入';
    }

    if (result.error_count > 0) {
      result.message += `，${result.error_count} 条记录有错误`;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Excel upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '文件处理失败: ' + (error instanceof Error ? error.message : '未知错误')
      },
      { status: 500 }
    );
  }
}

/**
 * 清洗和格式化Excel行数据
 */
function cleanRowData(rowData: any): any {
  const cleaned: any = {};

  // 字段映射和数据清洗
  const fieldMapping = {
    'ASIN': 'ASIN',
    '品名': '品名',
    '业务员': '业务员', 
    '库存点': '库存点',
    'FBA可用': 'FBA可用',
    'FBA在途': 'FBA在途',
    '本地仓': '本地仓',
    '平均销量': '平均销量',
    '日均销售额': '日均销售额',
    '总库存': '总库存',
    '广告曝光量': '广告曝光量',
    '广告点击量': '广告点击量',
    '广告花费': '广告花费',
    '广告订单量': '广告订单量',
    '库存周转天数': '库存周转天数',
    '库存状态': '库存状态',
    '广告点击率': '广告点击率',
    '广告转化率': '广告转化率',
    'ACOAS': 'ACOAS'
  };

  for (const [excelField, targetField] of Object.entries(fieldMapping)) {
    let value = rowData[excelField];

    // 处理字符串字段
    if (['ASIN', '品名', '业务员', '库存点', '库存状态'].includes(targetField)) {
      cleaned[targetField] = String(value || '').trim();
    }
    // 处理数值字段
    else {
      // 清除数字中的非数字字符（除了小数点）
      if (typeof value === 'string') {
        value = value.replace(/[^\d.-]/g, '');
      }
      
      const numValue = Number(value);
      cleaned[targetField] = isNaN(numValue) ? 0 : numValue;
    }
  }

  return cleaned;
}

// 支持的HTTP方法
export const dynamic = 'force-dynamic';