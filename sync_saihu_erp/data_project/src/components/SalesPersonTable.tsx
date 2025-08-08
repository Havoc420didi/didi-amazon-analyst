'use client';

import React from 'react';
import { SalesPersonStats } from '@/types/product';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface SalesPersonTableProps {
  data: SalesPersonStats[];
  title?: string;
  onSalesPersonClick?: (salesPerson: string) => void;
  activeSalesPerson?: string | null;
  totalInventoryPoints?: number;
  totalEffectivePoints?: number;
  totalTurnoverExceeded?: number;
  totalLowInventory?: number;
  totalOutOfStock?: number;
  className?: string;
}

export function SalesPersonTable({ 
  data, 
  title = '业务员库存点统计',
  onSalesPersonClick,
  activeSalesPerson,
  totalInventoryPoints = 0,
  totalEffectivePoints = 0,
  totalTurnoverExceeded = 0,
  totalLowInventory = 0,
  totalOutOfStock = 0,
  className = '',
}: SalesPersonTableProps) {
  // 如果没有数据，显示空状态
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>暂无业务员数据</p>
            <p className="text-sm mt-2">请上传数据文件以查看统计信息</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 计算各指标的最大值，用于进度条
  const maxInventoryPoints = Math.max(...data.map(p => p.inventoryPointCount), 1);
  const maxEffectivePoints = Math.max(...data.map(p => p.effectivePointCount), 1);
  const maxTurnoverExceeded = Math.max(...data.map(p => p.turnoverExceeded), 1);
  const maxLowInventory = Math.max(...data.map(p => p.lowInventory), 1);
  const maxOutOfStock = Math.max(...data.map(p => p.outOfStock), 1);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">业务员</TableHead>
                <TableHead className="text-right">库存点总数</TableHead>
                <TableHead className="text-right">有效库存点</TableHead>
                <TableHead className="text-right">周转超标</TableHead>
                <TableHead className="text-right">库存不足</TableHead>
                <TableHead className="text-right">断货产品</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((person, index) => {
                return (
                  <TableRow 
                    key={`${person.salesPerson}-${index}`}
                    className={`cursor-pointer hover:bg-muted/50 ${
                      activeSalesPerson === person.salesPerson ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => onSalesPersonClick?.(person.salesPerson)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {person.salesPerson || '未分配'}
                        {activeSalesPerson === person.salesPerson && (
                          <Badge variant="outline" className="text-xs">
                            已选择
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span>{person.inventoryPointCount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-medium">
                        {person.effectivePointCount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-blue-600 font-medium">
                        {person.turnoverExceeded.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-amber-600 font-medium">
                        {person.lowInventory.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600 font-medium">
                        {person.outOfStock.toLocaleString()}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {/* 总计行 */}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell>总计</TableCell>
                <TableCell className="text-right">{totalInventoryPoints.toLocaleString()}</TableCell>
                <TableCell className="text-right text-green-600">{totalEffectivePoints.toLocaleString()}</TableCell>
                <TableCell className="text-right text-blue-600">{totalTurnoverExceeded.toLocaleString()}</TableCell>
                <TableCell className="text-right text-amber-600">{totalLowInventory.toLocaleString()}</TableCell>
                <TableCell className="text-right text-red-600">{totalOutOfStock.toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}