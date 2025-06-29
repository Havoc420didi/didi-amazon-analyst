import { useState, useEffect, useCallback } from 'react';

// 分析历史刷新钩子
export function useAnalysisHistoryRefresh() {
  const [refreshKey, setRefreshKey] = useState(0);

  // 触发刷新
  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // 监听本地存储变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'streaming_analysis_ratings') {
        triggerRefresh();
      }
    };

    // 监听storage事件
    window.addEventListener('storage', handleStorageChange);

    // 自定义事件监听（用于同一页面内的变化）
    const handleCustomRefresh = () => {
      triggerRefresh();
    };

    window.addEventListener('refreshAnalysisHistory', handleCustomRefresh);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('refreshAnalysisHistory', handleCustomRefresh);
    };
  }, [triggerRefresh]);

  return { refreshKey, triggerRefresh };
}

// 触发历史分析刷新的工具函数
export function triggerAnalysisHistoryRefresh() {
  // 触发自定义事件
  window.dispatchEvent(new CustomEvent('refreshAnalysisHistory'));
}