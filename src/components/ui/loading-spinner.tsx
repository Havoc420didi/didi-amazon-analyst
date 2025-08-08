'use client';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: 'default' | 'primary' | 'secondary' | 'white';
}

export function LoadingSpinner({ 
  size = 'md', 
  className = '',
  color = 'default'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  const colorClasses = {
    default: 'border-gray-200 border-t-gray-600',
    primary: 'border-blue-200 border-t-blue-600',
    secondary: 'border-gray-200 border-t-gray-900',
    white: 'border-white/20 border-t-white',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      aria-label="Loading"
    />
  );
}

// 带文本的加载组件
interface LoadingWithTextProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: 'default' | 'primary' | 'secondary' | 'white';
}

export function LoadingWithText({
  text = '加载中...',
  size = 'md',
  className = '',
  color = 'default'
}: LoadingWithTextProps) {
  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={cn('flex items-center justify-center space-x-3', className)}>
      <LoadingSpinner size={size} color={color} />
      <span className={cn('text-gray-600', textSizeClasses[size])}>
        {text}
      </span>
    </div>
  );
}

// 页面级加载组件
interface PageLoadingProps {
  text?: string;
  className?: string;
}

export function PageLoading({
  text = '页面加载中...',
  className = ''
}: PageLoadingProps) {
  return (
    <div className={cn(
      'flex items-center justify-center min-h-[400px] w-full',
      className
    )}>
      <div className="text-center space-y-4">
        <LoadingSpinner size="xl" color="primary" />
        <p className="text-lg text-gray-600">{text}</p>
      </div>
    </div>
  );
}

// 卡片加载骨架
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={cn('animate-pulse', className)}>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 表格加载骨架
export function TableSkeleton({ 
  rows = 5, 
  cols = 4, 
  className = '' 
}: { 
  rows?: number; 
  cols?: number; 
  className?: string; 
}) {
  return (
    <div className={cn('animate-pulse', className)}>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* 表头 */}
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        
        {/* 表格行 */}
        <div className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="p-4">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {Array.from({ length: cols }).map((_, colIndex) => (
                  <div key={colIndex} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 列表加载骨架
export function ListSkeleton({ 
  items = 3, 
  className = '' 
}: { 
  items?: number; 
  className?: string; 
}) {
  return (
    <div className={cn('animate-pulse space-y-4', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
            <div className="w-16 h-6 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}