'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  Clock, 
  Star, 
  Eye, 
  Trash2, 
  RefreshCw,
  Calendar,
  User,
  Zap,
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAnalysisHistoryRefresh } from '@/hooks/use-analysis-history';

interface AnalysisHistoryItem {
  id: string;
  type: 'traditional' | 'streaming';
  asin: string;
  warehouse_location: string;
  task_number?: string;
  analysis_content: string;
  rating?: number;
  feedback?: string;
  executor: string;
  ai_model?: string;
  processing_time?: number;
  tokens_used?: number;
  created_at: string;
  completed_at?: string;
}

interface AnalysisHistoryProps {
  asin: string;
  warehouseLocation: string;
}

export function AnalysisHistory({ asin, warehouseLocation }: AnalysisHistoryProps) {
  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AnalysisHistoryItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { refreshKey } = useAnalysisHistoryRefresh();

  // 加载历史记录
  const loadHistory = async () => {
    setLoading(true);
    try {
      // 加载流式分析历史（从本地存储）
      const streamingRatings = JSON.parse(localStorage.getItem('streaming_analysis_ratings') || '[]');
      const streamingItems: AnalysisHistoryItem[] = streamingRatings
        .filter((item: any) => item.asin === asin && item.warehouse_location === warehouseLocation)
        .map((item: any, index: number) => ({
          id: `streaming_${index}`,
          type: 'streaming' as const,
          asin: item.asin,
          warehouse_location: item.warehouse_location,
          analysis_content: item.analysis_content,
          rating: item.rating,
          feedback: item.feedback,
          executor: 'streaming-analysis',
          ai_model: 'deepseek-chat',
          created_at: item.timestamp,
          completed_at: item.timestamp
        }));

      // 按时间排序
      const allItems = streamingItems
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setHistoryItems(allItems);
    } catch (error) {
      console.error('Load history error:', error);
      toast.error('加载历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载历史记录，以及当refreshKey变化时重新加载
  useEffect(() => {
    loadHistory();
  }, [asin, warehouseLocation, refreshKey]);

  // 删除历史记录
  const deleteHistoryItem = async (item: AnalysisHistoryItem) => {
    try {
      // 删除流式分析记录（从本地存储）
      const streamingRatings = JSON.parse(localStorage.getItem('streaming_analysis_ratings') || '[]');
      const filteredRatings = streamingRatings.filter((rating: any) => 
        !(rating.asin === item.asin && 
          rating.warehouse_location === item.warehouse_location && 
          rating.timestamp === item.created_at)
      );
      localStorage.setItem('streaming_analysis_ratings', JSON.stringify(filteredRatings));
      
      // 重新加载历史记录
      loadHistory();
      toast.success('历史记录已删除');
    } catch (error) {
      console.error('Delete history error:', error);
      toast.error('删除失败');
    }
  };

  // 查看详情
  const viewDetails = (item: AnalysisHistoryItem) => {
    setSelectedItem(item);
    setShowDetails(true);
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 获取评分显示
  const getRatingDisplay = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-3 w-3',
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            📚 分析历史
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">加载中...</span>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
              <History className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium mb-2">暂无分析历史</h3>
            <p className="text-sm">
              当您进行分析后，历史记录将显示在这里
            </p>
          </div>
        ) : (
          <ScrollArea className="h-96 w-full">
            <div className="space-y-3">
              {historyItems.map((item, index) => (
                <div key={item.id} className="space-y-3">
                  <div className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                          <Zap className="h-3 w-3 mr-1" />
                          实时分析
                        </Badge>
                        {item.task_number && (
                          <span className="text-xs text-gray-500 font-mono">
                            {item.task_number}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getRatingDisplay(item.rating)}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewDetails(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteHistoryItem(item)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatTime(item.created_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.executor}
                        </div>
                        {item.processing_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {(item.processing_time / 1000).toFixed(1)}s
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-800" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {item.analysis_content.substring(0, 150)}...
                    </div>
                  </div>
                  
                  {index < historyItems.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* 详情模态框 */}
        {showDetails && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">分析详情</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(false)}
                >
                  ✕
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">分析类型：</span>
                    {selectedItem.type === 'streaming' ? '实时分析' : '传统分析'}
                  </div>
                  <div>
                    <span className="font-medium">创建时间：</span>
                    {formatTime(selectedItem.created_at)}
                  </div>
                  <div>
                    <span className="font-medium">执行者：</span>
                    {selectedItem.executor}
                  </div>
                  <div>
                    <span className="font-medium">AI模型：</span>
                    {selectedItem.ai_model || 'deepseek-chat'}
                  </div>
                  {selectedItem.processing_time && (
                    <div>
                      <span className="font-medium">处理时间：</span>
                      {(selectedItem.processing_time / 1000).toFixed(1)}秒
                    </div>
                  )}
                  {selectedItem.rating && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">评分：</span>
                      {getRatingDisplay(selectedItem.rating)}
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">分析内容：</h4>
                  <div className="bg-gray-50 p-4 rounded-lg text-sm whitespace-pre-wrap max-h-96 overflow-auto">
                    {selectedItem.analysis_content}
                  </div>
                </div>
                
                {selectedItem.feedback && (
                  <div>
                    <h4 className="font-medium mb-2">用户反馈：</h4>
                    <div className="bg-blue-50 p-4 rounded-lg text-sm">
                      {selectedItem.feedback}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}