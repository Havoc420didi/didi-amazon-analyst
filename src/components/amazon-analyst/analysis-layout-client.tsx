'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import InventoryTable from '@/components/amazon-analyst/inventory-table';
import { AnalysisTrigger } from '@/components/ai-analysis/analysis-trigger';
import { InventoryPoint } from '@/types/inventory-view';

interface Props {
  items: InventoryPoint[];
  isLoggedIn?: boolean;
}

export default function AnalysisLayoutClient({ items, isLoggedIn = false }: Props) {
  const [selected, setSelected] = useState<InventoryPoint | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 左侧表格 */}
      <div className="lg:col-span-8">
        <Card className="bg-gradient-to-b from-background to-accent/40 border-border/60">
          <CardHeader>
            <CardTitle>库存点列表（CSV）</CardTitle>
          </CardHeader>
          <CardContent>
            {!isLoggedIn && (
              <div className="text-xs text-muted-foreground mb-2">未登录状态下 ASIN 与品名已脱敏显示（***）。登录后可查看完整信息。</div>
            )}
            <InventoryTable items={items} onSelect={setSelected} />
          </CardContent>
        </Card>
      </div>

      {/* 右侧 AI 分析面板 */}
      <div className="lg:col-span-4">
        <Card className="sticky top-6 bg-gradient-to-b from-background to-accent/40 border-border/60">
          <CardHeader>
            <CardTitle>AI分析</CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="text-sm text-muted-foreground">请选择左侧列表中的一个库存点。</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="font-medium">{selected.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    ASIN: {selected.asin} · {selected.marketplace}
                  </div>
                </div>
                <AnalysisTrigger inventoryPoint={selected} size="lg" variant="default" className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


