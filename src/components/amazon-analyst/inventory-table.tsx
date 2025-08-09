'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { InventoryPoint } from '@/types/inventory-view';
import { Button } from '@/components/ui/button';

interface Props {
  items: InventoryPoint[];
  onSelect: (item: InventoryPoint | null) => void;
}

export default function InventoryTable({ items, onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ASIN</TableHead>
            <TableHead>品名</TableHead>
            <TableHead>库存点</TableHead>
            <TableHead>FBA可用</TableHead>
            <TableHead>FBA在途</TableHead>
            <TableHead>本地仓</TableHead>
            <TableHead>总库存</TableHead>
            <TableHead>平均销量</TableHead>
            <TableHead>日均销售额</TableHead>
            <TableHead>广告曝光</TableHead>
            <TableHead>广告点击</TableHead>
            <TableHead>广告花费</TableHead>
            <TableHead>广告订单</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => {
            const key = `${it.asin}-${it.marketplace}`;
            return (
              <TableRow
                key={key}
                className={cn(selected === key && 'bg-muted/40')}
                onClick={() => {
                  setSelected(key);
                  onSelect(it);
                }}
              >
                <TableCell className="font-mono">{it.asin}</TableCell>
                <TableCell className="max-w-[260px] truncate">{it.productName}</TableCell>
                <TableCell>{it.marketplace}</TableCell>
                <TableCell>{it.fbaAvailable}</TableCell>
                <TableCell>{it.fbaInbound}</TableCell>
                <TableCell>{it.localAvailable}</TableCell>
                <TableCell>{it.totalInventory}</TableCell>
                <TableCell>{it.averageSales}</TableCell>
                <TableCell>¥{it.dailySalesAmount.toFixed(2)}</TableCell>
                <TableCell>{it.adImpressions}</TableCell>
                <TableCell>{it.adClicks}</TableCell>
                <TableCell>¥{it.adSpend.toFixed(2)}</TableCell>
                <TableCell>{it.adOrderCount}</TableCell>
                <TableCell>
                  {it.isOutOfStock
                    ? '断货'
                    : it.isLowInventory
                    ? '库存不足'
                    : it.isTurnoverExceeded
                    ? '周转超标'
                    : '周转合格'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(key);
                      onSelect(it);
                    }}
                  >
                    查看右侧AI分析
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}


