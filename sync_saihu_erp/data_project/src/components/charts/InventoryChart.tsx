'use client';

import { ProductData } from '@/types/product';
import { useSort } from '@/hooks/useSort';

interface ChartData {
  salesPerson: string;
  totalInventory: number;
  inventoryPoints: number;
}

export function InventoryChart({ data }: { data: ProductData[] }) {
  const { handleSort, getSortIcon, sortData } = useSort<ChartData>({
    defaultField: 'totalInventory',
    defaultDirection: 'desc'
  });

  const chartData: ChartData[] = Object.values(
    data.reduce((acc, item) => {
      const key = item.salesPerson;
      if (!acc[key]) {
        acc[key] = {
          salesPerson: key,
          totalInventory: 0,
          inventoryPoints: new Set(),
        };
      }
      acc[key].totalInventory += item.fbaAvailable + item.fbaInbound;
      acc[key].inventoryPoints.add(`${item.asin}-${item.marketplace}`);
      return acc;
    }, {} as Record<string, any>)
  ).map(item => ({
    salesPerson: item.salesPerson,
    totalInventory: item.totalInventory,
    inventoryPoints: item.inventoryPoints.size,
  }));

  const sortedData = sortData(chartData);

  return (
    <div className="w-full bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">业务员库存分析</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                { field: 'salesPerson' as const, label: '业务员' },
                { field: 'totalInventory' as const, label: '总库存', align: 'right' },
                { field: 'inventoryPoints' as const, label: '库存点数', align: 'right' },
              ].map(({ field, label, align }) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${
                    align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {label} {getSortIcon(field)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((item) => (
              <tr key={item.salesPerson}>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                  {item.salesPerson}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {item.totalInventory.toLocaleString()}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {item.inventoryPoints.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 