'use client';

import { useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
  field: keyof T;
  direction: SortDirection;
}

interface SortOptions<T> {
  defaultField: keyof T;
  defaultDirection?: SortDirection;
  customSort?: {
    [K in keyof T]?: (a: T[K], b: T[K], direction: SortDirection) => number;
  };
}

export function useSort<T extends Record<string, any>>({ 
  defaultField, 
  defaultDirection = 'desc',
  customSort = {}
}: SortOptions<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    field: defaultField,
    direction: defaultDirection,
  });

  const handleSort = (field: keyof T) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (field: keyof T) => {
    if (sortConfig.field !== field) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const sortData = (data: T[]): T[] => {
    return [...data].sort((a, b) => {
      const field = sortConfig.field;
      const direction = sortConfig.direction;

      // 使用自定义排序函数（如果存在）
      if (customSort[field]) {
        return customSort[field]!(a[field], b[field], direction);
      }

      const aValue = a[field];
      const bValue = b[field];

      // 处理特殊值（null, undefined）
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return direction === 'asc' ? -1 : 1;
      if (bValue == null) return direction === 'asc' ? 1 : -1;

      // 处理数字
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (isNaN(aValue) && isNaN(bValue)) return 0;
        if (isNaN(aValue)) return direction === 'asc' ? -1 : 1;
        if (isNaN(bValue)) return direction === 'asc' ? 1 : -1;
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // 处理日期
      if (
        aValue && 
        bValue && 
        typeof aValue.getTime === 'function' && 
        typeof bValue.getTime === 'function'
      ) {
        return direction === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      // 处理所有其他类型
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return direction === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  };

  return {
    sortConfig,
    handleSort,
    getSortIcon,
    sortData,
  };
} 