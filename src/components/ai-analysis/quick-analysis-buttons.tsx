'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, BarChart3, Calendar } from 'lucide-react';

interface QuickAnalysisButtonsProps {
  onSelect: (days: number, type: 'single_day' | 'multi_day') => void;
  selectedDays?: number;
  selectedType?: 'single_day' | 'multi_day';
}

export function QuickAnalysisButtons({ 
  onSelect, 
  selectedDays = 1, 
  selectedType = 'single_day' 
}: QuickAnalysisButtonsProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-3 block">快速选择</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button
          variant={selectedType === 'single_day' ? "default" : "outline"}
          size="sm"
          className="flex flex-col items-center gap-1 h-auto py-3"
          onClick={() => onSelect(1, 'single_day')}
        >
          <Target className="h-4 w-4" />
          <span className="text-xs">单日</span>
          <Badge variant="secondary" className="text-xs px-1">实时</Badge>
        </Button>
        <Button
          variant={selectedType === 'multi_day' && selectedDays === 3 ? "default" : "outline"}
          size="sm"
          className="flex flex-col items-center gap-1 h-auto py-3"
          onClick={() => onSelect(3, 'multi_day')}
        >
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs">3日</span>
          <Badge variant="secondary" className="text-xs px-1">趋势</Badge>
        </Button>
        <Button
          variant={selectedType === 'multi_day' && selectedDays === 7 ? "default" : "outline"}
          size="sm"
          className="flex flex-col items-center gap-1 h-auto py-3"
          onClick={() => onSelect(7, 'multi_day')}
        >
          <BarChart3 className="h-4 w-4" />
          <span className="text-xs">7日</span>
          <Badge variant="secondary" className="text-xs px-1">周报</Badge>
        </Button>
        <Button
          variant={selectedType === 'multi_day' && selectedDays === 30 ? "default" : "outline"}
          size="sm"
          className="flex flex-col items-center gap-1 h-auto py-3"
          onClick={() => onSelect(30, 'multi_day')}
        >
          <Calendar className="h-4 w-4" />
          <span className="text-xs">30日</span>
          <Badge variant="secondary" className="text-xs px-1">月报</Badge>
        </Button>
      </div>
    </div>
  );
} 