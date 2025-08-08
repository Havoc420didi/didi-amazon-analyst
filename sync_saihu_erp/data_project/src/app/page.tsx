'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DataTable } from '@/components/DataTable';
import { SalesPersonTable } from '@/components/SalesPersonTable';
import { StatsCards } from '@/components/StatsCards';
import { ProductData, AnalysisResponse, InventoryPoint, SalesPersonStats } from '@/types/product';

export default function Home() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [inventoryPoints, setInventoryPoints] = useState<InventoryPoint[]>([]);
  const [salesPersonStats, setSalesPersonStats] = useState<SalesPersonStats[]>([]);
  const [mergedProducts, setMergedProducts] = useState<ProductData[]>([]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string | null>(null);
  const [filteredInventoryPoints, setFilteredInventoryPoints] = useState<InventoryPoint[]>([]);

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '上传失败');
      }

      const result = await response.json();
      setData(result);
      setInventoryPoints(result.inventoryPoints || []);
      setFilteredInventoryPoints(result.inventoryPoints || []);
      setSalesPersonStats(result.salesPersonStats || []);
      setMergedProducts(result.mergedProducts || []);
      setSelectedSalesPerson(null);
    } catch (error) {
      console.error('上传错误:', error);
      throw error;
    }
  };
  
  // 处理业务员点击事件
  const handleSalesPersonClick = (salesPerson: string) => {
    if (selectedSalesPerson === salesPerson) {
      // 如果点击已选中的业务员，取消筛选
      setSelectedSalesPerson(null);
      setFilteredInventoryPoints(inventoryPoints);
    } else {
      // 筛选该业务员的库存点数据
      setSelectedSalesPerson(salesPerson);
      const filtered = inventoryPoints.filter(point => point.salesPerson === salesPerson);
      setFilteredInventoryPoints(filtered);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-[2200px] mx-auto px-1 py-4">
        <h1 className="text-2xl font-bold mb-8">特拼科技-运营数据分析系统</h1>
        <FileUpload onUpload={handleFileUpload} />
        
        {data && (
          <>
            {/* 统计卡片 */}
            <StatsCards stats={data.stats} />
            
            {/* 业务员库存点统计表 */}
            <div className="mt-8 mb-8">
              <SalesPersonTable 
                data={salesPersonStats} 
                onSalesPersonClick={handleSalesPersonClick}
                activeSalesPerson={selectedSalesPerson}
                totalInventoryPoints={data.stats.totalInventoryPoints}
                totalEffectivePoints={data.stats.effectiveInventoryPointCount}
                totalTurnoverExceeded={data.stats.turnoverExceededCount}
                totalLowInventory={data.stats.lowInventoryCount}
                totalOutOfStock={data.stats.outOfStockCount}
              />
            </div>
            
            {/* 库存点数据表 */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">
                库存点数据列表
                {selectedSalesPerson && (
                  <span className="ml-2 text-sm font-normal text-blue-600">
                    (已筛选: {selectedSalesPerson})
                    <button 
                      className="ml-2 text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setSelectedSalesPerson(null);
                        setFilteredInventoryPoints(inventoryPoints);
                      }}
                    >
                      清除筛选
                    </button>
                  </span>
                )}
              </h2>
              <DataTable data={filteredInventoryPoints} title="库存点详情" />
            </div>
          </>
        )}
      </div>
    </main>
  );
} 