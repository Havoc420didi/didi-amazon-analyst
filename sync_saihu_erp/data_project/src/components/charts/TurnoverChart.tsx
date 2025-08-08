'use client';

import { ProductData } from '@/types/product';
import { calculateTurnoverDays } from '@/services/utils/inventoryHelpers';
import { useSort } from '@/hooks/useSort';

interface Column {
  field: keyof ProductData | 'turnoverDays';
  label: string;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { field: 'asin', label: 'ASIN' },
  { field: 'productName', label: '商品名称' },
  { field: 'marketplace', label: '库存点' },
  { field: 'turnoverDays', label: '周转天数', align: 'right' }
];

interface TurnoverChartProps {
  data: ProductData[];
}

export function TurnoverChart({ data }: TurnoverChartProps) {
  // 计算周转天数并排序
  const sortedData = data
    .map(item => ({
      ...item,
      turnoverDays: calculateTurnoverDays(
        item.fbaAvailable + item.fbaInbound,
        item.sales7Days
      )
    }))
    .sort((a, b) => b.turnoverDays - a.turnoverDays)
    .slice(0, 10); // 只显示前10条

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">周转天数排名</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map(({ field, label, align = 'left' }) => (
                <th
                  key={field}
                  className={`
                    px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider
                    ${align === 'right' ? 'text-right' : 'text-left'}
                  `}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((item, index) => (
              <tr key={`${item.asin}-${index}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.asin}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.productName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.marketplace}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {item.turnoverDays === 999 ? '无销量' : item.turnoverDays.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 