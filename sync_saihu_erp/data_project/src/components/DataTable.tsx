'use client';

import { useState } from 'react';
import { ProductData, InventoryPoint } from '@/types/product';
import { calculateTurnoverDays } from '@/services/utils/inventoryHelpers';
import * as XLSX from 'xlsx';

interface DataTableProps {
  data: InventoryPoint[] | ProductData[];
  title: string;
}

// 修改 SortField 类型定义，确保包含所有可能的字段
type SortField = keyof (InventoryPoint & ProductData) | 'dailyAverageSales' | 'adImpressions' | 'adClicks' | 'adSpend' | 'adSales';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// 修改 Column 接口，使用更精确的类型
interface Column {
  key: SortField;
  header: string;
  render?: (item: InventoryPoint | ProductData) => React.ReactNode;
}

export function DataTable({ data, title }: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'dailySalesAmount', direction: 'desc' });
  const [activeFilters, setActiveFilters] = useState<{[key: string]: string}>({});
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 状态筛选
  const itemsPerPage = 100; // 每页展示100条数据
  
  // 字段筛选功能
  const handleFilterClick = (field: string, value: string) => {
    setActiveFilters(prev => {
      // 如果已经有相同的筛选，则移除它
      if (prev[field] === value) {
        const newFilters = {...prev};
        delete newFilters[field];
        return newFilters;
      }
      // 否则添加或更新筛选
      return {...prev, [field]: value};
    });
    // 筛选后返回第一页
    setCurrentPage(1);
  };
  
  // 状态筛选器切换功能已移除
  
  // 状态筛选功能
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // 清除所有筛选
  const clearFilters = () => {
    setActiveFilters({});
    setStatusFilter('all');
  };
  
  // 下载数据为Excel格式
  const downloadCSV = () => {
    // 使用经过筛选和排序的数据
    const dataToExport = sortData(filteredData);
    
    // 添加库存状态列
    const allHeaders = [...columns.map(col => col.header), '库存状态', '广告点击率', '广告转化率', 'ACOAS'];
    
    // 定义颜色 - 使用完整对象并确保正确的颜色格式
    const COLOR_RED = { 
      font: { color: { rgb: "FF0000" } },
      fill: { fgColor: { rgb: "FFEEEE" } }
    };
    const COLOR_BLUE = { 
      font: { color: { rgb: "0000FF" } },
      fill: { fgColor: { rgb: "EEEEFF" } }
    };
    const COLOR_DEFAULT = { 
      font: { color: { rgb: "000000" } } 
    };
    
    // 定义样式对象类型
    interface CellStyle {
      row: number;
      col: number;
      style: any; // 使用any类型来支持不同的样式结构
    }
    
    // 准备工作表数据和单元格样式
    const worksheetData: any[][] = [];
    const styles: CellStyle[] = [];
    
    // 添加表头行
    worksheetData.push(allHeaders);
    
    // 为表头行添加样式
    for (let i = 0; i < allHeaders.length; i++) {
      styles.push({
        row: 0,
        col: i,
        style: {
          font: { bold: true, color: { rgb: "000000" } }, 
          fill: { fgColor: { rgb: "EFEFEF" } },
          alignment: { horizontal: "center" }
        }
      });
    }
    
    // 处理数据行
    dataToExport.forEach((item: InventoryPoint | ProductData, rowIndex: number) => {
      const inventoryItem = item as InventoryPoint;
      const turnoverDays = inventoryItem.turnoverDays || 0;
      
      // 确定行的状态和样式
      let statusText = '周转合格'; // 默认状态
      let rowStyle = COLOR_DEFAULT;
      
      if (turnoverDays > 100 || turnoverDays === 999) {
        statusText = '周转超标';
        rowStyle = COLOR_BLUE;
      } else if (turnoverDays < 45) {
        statusText = '库存不足';
        rowStyle = COLOR_RED;
      }
      
      // 准备当前行的数据
      const rowData: any[] = [];
      
      // 处理每一列
      columns.forEach((col, colIndex) => {
        let cellValue: any;
        
        // 根据列类型处理数据
        switch (col.key) {
          case 'turnoverDays':
            if (!turnoverDays && turnoverDays !== 0) {
              cellValue = { v: '计算中', t: 's' };
            } else if (turnoverDays === 999) {
              cellValue = { v: '无销量', t: 's' };
            } else {
              // 使用数字类型
              cellValue = { v: turnoverDays, t: 'n' };
            }
            break;
            
          case 'dailyAverageSales':
            // 平均销量 - 数字类型
            const dailyAverage = inventoryItem.averageSales || 0;
            cellValue = { v: dailyAverage, t: 'n' };
            break;
            
          case 'dailySalesAmount':
            // 日均销售额 - 数字类型
            const dailySalesAmount = inventoryItem.dailySalesAmount || 0;
            cellValue = { v: dailySalesAmount, t: 'n' };
            break;
            
          case 'fbaAvailable':
          case 'fbaInbound':
          case 'localAvailable':
          case 'totalInventory':
          case 'adImpressions':
          case 'adClicks':
          case 'adSpend':
          case 'adSales':
          case 'adOrderCount':
            // 库存及广告相关数字列 - 数字类型
            const numValue = item[col.key as keyof typeof item] as number || 0;
            cellValue = { v: numValue, t: 'n' };
            break;
            
          default:
            // 其他列使用字符串类型
            const value = item[col.key as keyof typeof item];
            cellValue = { v: value?.toString() || '', t: 's' };
            break;
        }
        
        // 添加到行数据中
        rowData.push(cellValue);
        
        // 添加单元格样式
        styles.push({
          row: rowIndex + 1, // +1 因为第一行是表头
          col: colIndex,
          style: rowStyle
        });
      });
      
      // 添加状态列
      rowData.push({ v: statusText, t: 's' });
      
      // 为状态列添加样式
      styles.push({
        row: rowIndex + 1,
        col: columns.length, // This is for '库存状态'
        style: rowStyle
      });

      // Calculate Ad CTR, Ad CVR, ACOAS
      const adImpressionsValue = inventoryItem.adImpressions || 0;
      const adClicksValue = inventoryItem.adClicks || 0;
      const adSalesValue = inventoryItem.adSales || 0;
      const adOrderCountValue = inventoryItem.adOrderCount || 0;
      const adSpendValue = inventoryItem.adSpend || 0;
      const dailySalesAmountValue = inventoryItem.dailySalesAmount || 0;

      const adCtr = adImpressionsValue > 0 ? (adClicksValue / adImpressionsValue) : 0;
      const adCvr = adClicksValue > 0 ? (adOrderCountValue / adClicksValue) : 0;
      const weeklySalesAmount = dailySalesAmountValue * 7;
      const acoas = weeklySalesAmount > 0 ? (adSpendValue / weeklySalesAmount) : 0;

      rowData.push({ v: adCtr, t: 'n', z: '0.00%' }); // Ad CTR
      rowData.push({ v: adCvr, t: 'n', z: '0.00%' }); // Ad CVR
      rowData.push({ v: acoas, t: 'n', z: '0.00%' }); // ACOAS

      // Apply rowStyle to new cells for Ad CTR, Ad CVR, ACOAS
      styles.push({ row: rowIndex + 1, col: columns.length + 1, style: rowStyle });
      styles.push({ row: rowIndex + 1, col: columns.length + 2, style: rowStyle });
      styles.push({ row: rowIndex + 1, col: columns.length + 3, style: rowStyle });
      
      // 将行数据添加到工作表数据中
      worksheetData.push(rowData);
    });
    
    // 创建Excel工作表
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData.map(row => 
      row.map(cell => typeof cell === 'object' && cell !== null ? cell.v : cell)
    ));
    
    // 设置单元格类型
    for (let r = 0; r < worksheetData.length; r++) {
      for (let c = 0; c < worksheetData[r].length; c++) {
        const cell = worksheetData[r][c];
        if (typeof cell === 'object' && cell !== null && cell.t) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (!worksheet[cellRef]) worksheet[cellRef] = {};
          worksheet[cellRef].t = cell.t;
        }
      }
    }
    
    // 应用单元格样式
    if (!worksheet['!cols']) worksheet['!cols'] = [];
    if (!worksheet['!rows']) worksheet['!rows'] = [];
    
    // 设置列宽 - 使用自定义列宽
    const colWidths = [
      { wch: 10 }, // ASIN
      { wch: 30 }, // 品名
      { wch: 8 }, // 业务员
      { wch: 8 }, // 库存点
      { wch: 10 }, // FBA可用
      { wch: 10 }, // FBA在途
      { wch: 10 }, // 本地仓
      { wch: 10 }, // 平均销量
      { wch: 10 }, // 日均销售额
      { wch: 10 }, // 总库存
      { wch: 12 }, // 库存周转天数
      { wch: 12 }  // 库存状态
    ];
    
    // 应用列宽设置
    worksheet['!cols'] = colWidths;
    
    // 创建Excel工作簿
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '库存数据');
    
    // 生成Excel文件并下载
    const date = new Date().toISOString().split('T')[0];
    const excelFileName = `${title || '库存数据'}_${date}.xlsx`;
    
    // 使用XLSX写入并下载
    XLSX.writeFile(workbook, excelFileName);
  };

  // 定义哪些列支持点击筛选
  const filterableColumns = ['asin', 'productName', 'salesPerson', 'marketplace'];
  
  // 获取所有唯一的库存点（marketplace）
  const getAllMarketplaces = () => {
    const marketplaces = new Set<string>();
    data.forEach(item => {
      if (item.marketplace) {
        marketplaces.add(item.marketplace);
      }
    });
    return Array.from(marketplaces).sort();
  };

  // 获取状态统计
  const getStatusStats = () => {
    const stats = {
      all: data.length,
      effective: 0,
      turnoverExceeded: 0,
      lowInventory: 0,
      outOfStock: 0,
      zeroSales: 0
    };
    
    data.forEach(item => {
      const inventoryItem = item as InventoryPoint;
      const turnoverDays = inventoryItem.turnoverDays || 0;
      const dailySalesAmount = inventoryItem.dailySalesAmount || 0;
      const fbaAvailable = inventoryItem.fbaAvailable || 0;
      
      // 有效库存点：日均销售额≥16.7
      if (dailySalesAmount >= 16.7) {
        stats.effective++;
      }
      
      // 周转超标：周转天数>100或999（无销量）
      if (turnoverDays > 100 || turnoverDays === 999) {
        stats.turnoverExceeded++;
      }
      
      // 库存不足：周转天数<45
      if (turnoverDays < 45 && turnoverDays > 0) {
        stats.lowInventory++;
      }
      
      // 断货：FBA可用库存<=0
      if (fbaAvailable <= 0) {
        stats.outOfStock++;
      }
      
      // 零销量：周转天数为999
      if (turnoverDays === 999) {
        stats.zeroSales++;
      }
    });
    
    return stats;
  };

  const statusStats = getStatusStats();
  const marketplaces = getAllMarketplaces();
  
  const columns: Column[] = [
    {
      key: 'asin',
      header: 'ASIN'
    },
    {
      key: 'productName',
      header: '品名'
    },
    {
      key: 'salesPerson',
      header: '业务员'
    },
    {
      key: 'marketplace',
      header: '库存点'
    },
    {
      key: 'fbaAvailable',
      header: 'FBA可用',
      render: (item) => (item.fbaAvailable || 0).toLocaleString()
    },
    {
      key: 'fbaInbound',
      header: 'FBA在途',
      render: (item) => (item.fbaInbound || 0).toLocaleString()
    },
    { 
      key: 'localAvailable', 
      header: '本地仓',
      render: (item) => (item.localAvailable || 0).toLocaleString()
    },
    { 
      key: 'dailyAverageSales', 
      header: '平均销量',
      render: (item) => {
        // 显示平均销量
        const dailyAverage = item.averageSales || 0;
        return dailyAverage.toFixed(2);
      }
    },
    { 
      key: 'dailySalesAmount', 
      header: '日均销售额',
      render: (item) => {
        // 显示日均销售额，如果存在
        const dailySalesAmount = (item as InventoryPoint).dailySalesAmount;
        return dailySalesAmount ? `$${dailySalesAmount.toFixed(2)}` : '-';
      }
    },
    { 
      key: 'totalInventory', 
      header: '总库存',
      render: (item) => {
        return (item.totalInventory || 0).toLocaleString();
      }
    },
    { 
      key: 'adImpressions', 
      header: '广告曝光量',
      render: (item) => {
        return (item.adImpressions || 0).toLocaleString();
      }
    },
    { 
      key: 'adClicks', 
      header: '广告点击量',
      render: (item) => {
        return (item.adClicks || 0).toLocaleString();
      }
    },
    { 
      key: 'adSpend', 
      header: '广告花费',
      render: (item) => {
        return (item.adSpend || 0).toLocaleString();
      }
    },
    { 
      key: 'adOrderCount',
      header: '广告订单量',
      render: (item) => {
        return (item.adOrderCount || 0).toLocaleString();
      }
    },
    { 
      key: 'turnoverDays', 
      header: '库存周转天数',
      render: (item) => {
        const turnoverDays = item.turnoverDays;
        
        // 判断是否有周转天数值
        if (!turnoverDays && turnoverDays !== 0) {
          return '计算中';
        }
        
        // 特殊值处理：999表示无销量
        if (turnoverDays === 999) {
          return <span className="text-blue-600">无销量</span>;
        }
        
        // 周转天数超标，蓝色显示
        if (turnoverDays > 100) {
          return <span className="text-blue-600">{turnoverDays.toFixed(1)}</span>;
        }
        
        // 周转天数小于45天，红色显示
        if (turnoverDays < 45) {
          return <span className="text-red-600">{turnoverDays.toFixed(1)}</span>;
        }
        
        // 其他周转天数不加颜色
        return turnoverDays.toFixed(1);
      } 
    },
  ];

  // 修改排序函数的类型处理
  const sortData = (items: (InventoryPoint | ProductData)[]): (InventoryPoint | ProductData)[] => {
    return [...items].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortConfig.field === 'dailyAverageSales') {
        aValue = (a.averageSales || 0) / 7;
        bValue = (b.averageSales || 0) / 7;
      } else {
        // 使用类型断言确保类型安全
        const aFieldValue = a[sortConfig.field as keyof (typeof a)];
        const bFieldValue = b[sortConfig.field as keyof (typeof b)];
        
        aValue = typeof aFieldValue === 'number' || typeof aFieldValue === 'string' ? aFieldValue : 0;
        bValue = typeof bFieldValue === 'number' || typeof bFieldValue === 'string' ? bFieldValue : 0;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (!Number.isFinite(aValue) && !Number.isFinite(bValue)) return 0;
        if (!Number.isFinite(aValue)) return sortConfig.direction === 'asc' ? 1 : -1;
        if (!Number.isFinite(bValue)) return sortConfig.direction === 'asc' ? -1 : 1;
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();
      return sortConfig.direction === 'asc'
        ? aString.localeCompare(bString)
        : bString.localeCompare(aString);
    });
  };

  // 获取行的颜色样式，基于周转天数设置整行颜色
  const getRowColorClass = (item: InventoryPoint | ProductData) => {
    // 处理库存状态，需要检查这些字段存在于 InventoryPoint 中
    const inventoryItem = item as InventoryPoint;
    const turnoverDays = inventoryItem.turnoverDays || 0;
    
    // 周转天数超标产品用蓝色 - 周转天数大于100天
    if (turnoverDays > 100 || turnoverDays === 999) {
      return 'text-blue-600';
    }
    
    // 周转天数小于45天产品用红色
    if (turnoverDays < 45) {
      return 'text-red-600';
    }
    
    // 其他产品不加颜色
    return '';
  };
  
  // 修改表格渲染部分的类型处理
  const renderCell = (item: InventoryPoint | ProductData, column: Column) => {
    // 如果是周转天数列，使用它的自定义渲染函数
    if (column.key === 'turnoverDays' && column.render) {
      return column.render(item);
    }
    
    // 其他列的自定义渲染函数，但保持与行颜色一致
    if (column.render) {
      const colorClass = getRowColorClass(item);
      if (colorClass) {
        return <span className={colorClass}>{column.render(item)}</span>;
      }
      return column.render(item);
    }
    
    const value = item[column.key as keyof typeof item] || '-';
    const colorClass = getRowColorClass(item);
    
    // 如果是可筛选列，添加点击筛选功能
    if (filterableColumns.includes(column.key) && typeof value === 'string' && value !== '-') {
      const isActive = activeFilters[column.key] === value;
      // 创建一个类名，包含基本样式和活动状态
      let className = `hover:bg-blue-50 py-1 px-2 rounded transition-colors ${isActive ? 'bg-blue-100' : ''}`;
      
      // 对于ASIN和品名列，限制宽度并添加截断样式
      if (column.key === 'asin') {
        return (
          <div className="w-[80px] overflow-hidden">
            <button
              onClick={() => handleFilterClick(column.key, value)}
              className={`${className} truncate w-full text-left ${colorClass}`}
              title={value}
            >
              {value}
            </button>
          </div>
        );
      } else if (column.key === 'productName') {
        return (
          <div className="w-[234px] overflow-hidden">
            <button
              onClick={() => handleFilterClick(column.key, value)}
              className={`${className} truncate w-full text-left ${colorClass}`}
              title={value}
            >
              {value}
            </button>
          </div>
        );
      }
      
      // 其他可筛选列使用正常按钮
      return (
        <button
          onClick={() => handleFilterClick(column.key, value)}
          className={`${className} ${colorClass}`}
          title={value}
        >
          {value}
        </button>
      );
    }
    
    // 非筛选列或非字符串值的处理
    if (column.key === 'asin' && typeof value === 'string') {
      return <div className={`w-[120px] truncate ${colorClass}`} title={value}>{value}</div>;
    } else if (column.key === 'productName' && typeof value === 'string') {
      return <div className={`w-[234px] truncate ${colorClass}`} title={value}>{value}</div>;
    }
    
    // 确保所有非过滤列的内容也应用同样的颜色样式
    if (colorClass) {
      return typeof value === 'number' ? 
        <span className={colorClass}>{value.toLocaleString()}</span> : 
        <span className={colorClass}>{value}</span>;
    }
    
    return typeof value === 'number' ? value.toLocaleString() : value;
  };

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // 筛选通过关键字搜索、活动筛选器和状态筛选的数据
  const filteredData = data.filter(item => {
    // 首先检查活动筛选器
    for (const [field, value] of Object.entries(activeFilters)) {
      if (String(item[field as keyof typeof item]) !== value) {
        return false;
      }
    }
    
    // 状态筛选
    if (statusFilter !== 'all') {
      const inventoryItem = item as InventoryPoint;
      const turnoverDays = inventoryItem.turnoverDays || 0;
      const dailySalesAmount = inventoryItem.dailySalesAmount || 0;
      const fbaAvailable = inventoryItem.fbaAvailable || 0;
      
      switch (statusFilter) {
        case 'effective':
          if (dailySalesAmount < 16.7) return false;
          break;
        case 'turnoverExceeded':
          if (!(turnoverDays > 100 || turnoverDays === 999)) return false;
          break;
        case 'lowInventory':
          if (!(turnoverDays < 45 && turnoverDays > 0)) return false;
          break;
        case 'outOfStock':
          if (fbaAvailable > 0) return false;
          break;
        case 'zeroSales':
          if (turnoverDays !== 999) return false;
          break;
      }
    }
    
    // 如果搜索关键字为空，跳过搜索筛选
    if (!searchTerm) return true;
    
    // 搜索关键字匹配
    const term = searchTerm.toLowerCase();
    const asinMatch = item.asin?.toLowerCase().includes(term) || false;
    const productNameMatch = item.productName?.toLowerCase().includes(term) || false;
    const salesPersonMatch = item.salesPerson?.toLowerCase().includes(term) || false;
    const skuMatch = item.sku?.toLowerCase().includes(term) || false;
    const marketplaceMatch = item.marketplace?.toLowerCase().includes(term) || false;
    
    return asinMatch || productNameMatch || salesPersonMatch || skuMatch || marketplaceMatch;
  });

  const sortedData = sortData(filteredData);
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center sm:space-y-0">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-medium text-gray-900">{title}</h2>
              <button 
                onClick={downloadCSV}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <span>下载Excel</span>
              </button>
            </div>
            <div className="w-full sm:w-auto max-w-md">
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="搜索 (ASIN、业务员、品名)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 py-2 border border-gray-300 rounded-md w-full"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 p-1 rounded-full text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              {searchTerm && (
                <div className="mt-1 text-xs text-gray-500">
                  搜索结果: {filteredData.length} / {data.length}
                </div>
              )}
            </div>
          </div>
          
          {/* 状态筛选按钮 */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm text-gray-600 font-medium">状态筛选:</span>
            <button
              onClick={() => handleStatusFilter('all')}
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'all' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              全部 ({statusStats.all})
            </button>
            <button
              onClick={() => handleStatusFilter('effective')}
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'effective' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              有效库存点 ({statusStats.effective})
            </button>
            <button
              onClick={() => handleStatusFilter('turnoverExceeded')}
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'turnoverExceeded' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              周转超标 ({statusStats.turnoverExceeded})
            </button>
            <button
              onClick={() => handleStatusFilter('lowInventory')}
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'lowInventory' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              库存不足 ({statusStats.lowInventory})
            </button>
            <button
              onClick={() => handleStatusFilter('outOfStock')}
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'outOfStock' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              断货 ({statusStats.outOfStock})
            </button>
            <button
              onClick={() => handleStatusFilter('zeroSales')}
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'zeroSales' 
                  ? 'bg-gray-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              零销量 ({statusStats.zeroSales})
            </button>
          </div>

          {/* 库存点筛选按钮 */}
          {marketplaces.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-sm text-gray-600 font-medium">库存点筛选:</span>
              {marketplaces.map(marketplace => {
                const count = data.filter(item => item.marketplace === marketplace).length;
                const isActive = activeFilters.marketplace === marketplace;
                return (
                  <button
                    key={marketplace}
                    onClick={() => handleFilterClick('marketplace', marketplace)}
                    className={`text-sm px-3 py-1 rounded-md transition-colors ${
                      isActive 
                        ? 'bg-indigo-500 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {marketplace} ({count})
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-2">
            {/* 清除所有筛选器按钮 */}
            {(Object.keys(activeFilters).length > 0 || statusFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md px-3 py-1 transition-colors ml-auto"
              >
                清除所有筛选
              </button>
            )}
          </div>
          
          {/* 显示活动筛选器 */}
          {(Object.keys(activeFilters).length > 0 || statusFilter !== 'all') && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">当前筛选:</span>
              
              {/* 状态筛选标签 */}
              {statusFilter !== 'all' && (
                <div className="flex items-center bg-blue-100 text-blue-800 text-sm rounded-full px-3 py-1">
                  <span>状态: {
                    statusFilter === 'effective' ? '有效库存点' :
                    statusFilter === 'turnoverExceeded' ? '周转超标' :
                    statusFilter === 'lowInventory' ? '库存不足' :
                    statusFilter === 'outOfStock' ? '断货' :
                    statusFilter === 'zeroSales' ? '零销量' : statusFilter
                  }</span>
                  <button 
                    onClick={() => handleStatusFilter('all')}
                    className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* 其他筛选标签 */}
              {Object.entries(activeFilters).map(([field, value]) => (
                <div key={`${field}-${value}`} className="flex items-center bg-indigo-100 text-indigo-800 text-sm rounded-full px-3 py-1">
                  <span>{columns.find(col => col.key === field)?.header}: {value}</span>
                  <button 
                    onClick={() => handleFilterClick(field, value)}
                    className="ml-1 text-indigo-600 hover:text-indigo-800 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              
              <button 
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline focus:outline-none"
              >
                清除筛选
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${column.key === 'asin' ? 'w-[120px]' : ''} ${column.key === 'productName' ? 'w-[234px]' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{column.header}</span>
                    <span className="ml-1">{getSortIcon(column.key)}</span>
                  </div>
                  {filterableColumns.includes(column.key) && (
                    <div className="text-xs font-normal text-gray-400 mt-1">
                      点击单元格可筛选
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentData.map((item, index) => (
              <tr key={`${item.asin}-${item.marketplace || ''}-${index}`}>
                {columns.map((column) => (
                  <td
                    key={`${column.key}-${item.asin}-${index}`}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {renderCell(item, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-700">
            共 {filteredData.length} 条记录
          </span>
        </div>
        <div className="flex justify-center mt-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-3 py-1">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 