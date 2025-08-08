'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Loader2, 
  Lightbulb, 
  Target, 
  CheckCircle, 
  XCircle,
  Sparkles,
  Eye,
  Clock,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ProductAnalysisData } from '@/types/ai-analysis';
import { StreamingRating } from './streaming-rating';
import { triggerAnalysisHistoryRefresh } from '@/hooks/use-analysis-history';
import { useTranslations } from 'next-intl';

// 流式事件接口
interface StreamingEvent {
  type: 'thinking' | 'analysis' | 'recommendation' | 'completed' | 'error';
  step: string;
  content: string;
  timestamp: number;
  progress?: number;
  isUpdate?: boolean; // 标识是否为内容更新
}

interface StreamingAnalysisDisplayProps {
  productData: ProductAnalysisData;
  executor?: string;
  onComplete?: (fullContent: string) => void;
}

export function StreamingAnalysisDisplay({ 
  productData, 
  executor = 'streaming-analysis',
  onComplete 
}: StreamingAnalysisDisplayProps) {
  const t = useTranslations('ai_analysis.operations_analysis');
  const [isStreaming, setIsStreaming] = useState(false);
  const [events, setEvents] = useState<StreamingEvent[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const [fullContent, setFullContent] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestingRef = useRef(false);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [events]);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // 关闭EventSource连接
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      // 重置请求状态
      isRequestingRef.current = false;
    };
  }, []);

  // 开始流式分析
  const startStreamingAnalysis = async () => {
    // 防止重复请求
    if (isStreaming || isRequestingRef.current) {
      console.log('Request already in progress, ignoring...');
      toast.info('分析已在进行中，请稍等...');
      return;
    }

    // 标记请求开始
    isRequestingRef.current = true;
    setIsStreaming(true);
    setEvents([]);
    setCurrentProgress(0);
    setFullContent('');
    setIsExpanded(true);

    // 如果有之前的请求，先取消
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的AbortController
    abortControllerRef.current = new AbortController();

    try {
      // 创建EventSource连接
      const requestBody = {
        asin: productData.asin,
        warehouse_location: productData.warehouse_location,
        product_data: productData
      };

      // 使用fetch发起POST请求来启动流
      const response = await fetch('/api/ai-analysis/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              setIsStreaming(false);
              return;
            }

            try {
              const event: StreamingEvent = JSON.parse(data);
              
              // 处理事件：更新现有事件或添加新事件
              setEvents(prev => {
                if (event.isUpdate) {
                  // 更新模式：找到相同类型和步骤的事件并追加内容
                  const existingIndex = prev.findIndex(existingEvent => 
                    existingEvent.type === event.type && existingEvent.step === event.step
                  );
                  
                  if (existingIndex !== -1) {
                    // 追加内容到现有事件
                    const newEvents = [...prev];
                    const existingEvent = newEvents[existingIndex];
                    
                    // 检查内容是否已存在，避免重复
                    const existingContent = existingEvent.content || '';
                    const newContent = event.content || '';
                    
                    // 如果新内容不包含在现有内容中，则追加
                    if (!existingContent.includes(newContent)) {
                      newEvents[existingIndex] = {
                        ...existingEvent,
                        content: existingContent + newContent,
                        timestamp: event.timestamp
                      };
                    }
                    return newEvents;
                  } else {
                    // 如果没找到对应事件，创建新事件（但标记为非更新模式）
                    return [...prev, { ...event, isUpdate: false }];
                  }
                } else {
                  // 非更新模式：直接添加新事件
                  return [...prev, event];
                }
              });
              
              // 计算进度
              if (event.progress !== undefined) {
                setCurrentProgress(event.progress);
              } else {
                // 基于事件类型计算进度
                const progressMap = {
                  'thinking': 25,
                  'analysis': 60,
                  'recommendation': 85,
                  'completed': 100,
                  'error': 100
                };
                const calculatedProgress = progressMap[event.type] || 0;
                setCurrentProgress(calculatedProgress);
              }

              // 如果是完成事件，保存完整内容
              if (event.type === 'completed') {
                console.log('Analysis completed, content length:', event.content?.length);
                setFullContent(event.content);
                setIsStreaming(false);
                isRequestingRef.current = false; // 重置请求状态
                onComplete?.(event.content);
                
                // 保存分析记录到历史（不带评价）
                const analysisRecord = {
                  type: 'streaming_analysis',
                  asin: productData.asin,
                  warehouse_location: productData.warehouse_location,
                  analysis_content: event.content,
                  timestamp: new Date().toISOString()
                };
                
                // 先检查是否已存在相同的记录（避免重复）
                const existingRecords = JSON.parse(localStorage.getItem('streaming_analysis_ratings') || '[]');
                const isDuplicate = existingRecords.some((record: any) => 
                  record.asin === analysisRecord.asin &&
                  record.warehouse_location === analysisRecord.warehouse_location &&
                  Math.abs(new Date(record.timestamp).getTime() - new Date(analysisRecord.timestamp).getTime()) < 5000 // 5秒内的记录视为重复
                );
                
                if (!isDuplicate) {
                  existingRecords.push(analysisRecord);
                  localStorage.setItem('streaming_analysis_ratings', JSON.stringify(existingRecords));
                  triggerAnalysisHistoryRefresh();
                }
                
                toast.success('AI分析完成！');
              }

              // 如果是错误事件
              if (event.type === 'error') {
                setIsStreaming(false);
                isRequestingRef.current = false; // 重置请求状态
                toast.error('分析过程中出现错误');
              }

            } catch (error) {
              console.error('Error parsing event:', error);
            }
          }
        }
      }

    } catch (error) {
      console.error('Streaming analysis error:', error);
      setIsStreaming(false);
      isRequestingRef.current = false; // 重置请求状态
      
      // 检查是否是用户取消的请求
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('分析已取消');
        return;
      }
      
      toast.error('连接分析服务失败，请重试');
      
      // 添加错误事件
      setEvents(prev => [...prev, {
        type: 'error',
        step: '连接错误',
        content: `无法连接到分析服务: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now(),
        progress: 0
      }]);
    } finally {
      // 确保请求状态被重置
      isRequestingRef.current = false;
    }
  };

  // 停止流式分析
  const stopStreamingAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    isRequestingRef.current = false; // 重置请求状态
    toast.info('分析已停止');
  };

  // 复制分析结果
  const copyAnalysis = async () => {
    let contentToCopy = fullContent;
    
    // 如果没有完整内容，则复制所有事件的内容
    if (!contentToCopy && events.length > 0) {
      contentToCopy = events
        .filter(e => e.type !== 'error')
        .map(e => `${e.step}: ${e.content}`)
        .join('\n\n');
    }
    
    if (!contentToCopy) {
      toast.error('暂无可复制的内容');
      return;
    }

    try {
      await navigator.clipboard.writeText(contentToCopy);
      toast.success('分析内容已复制到剪贴板');
    } catch (error) {
      toast.error('复制失败');
    }
  };

  // 获取事件图标
  const getEventIcon = (type: StreamingEvent['type']) => {
    switch (type) {
      case 'thinking':
        return <Brain className="h-4 w-4 text-blue-600" />;
      case 'analysis':
        return <Target className="h-4 w-4 text-green-600" />;
      case 'recommendation':
        return <Lightbulb className="h-4 w-4 text-orange-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  // 获取事件样式
  const getEventStyle = (type: StreamingEvent['type']) => {
    switch (type) {
      case 'thinking':
        return 'border-l-blue-500 bg-blue-50';
      case 'analysis':
        return 'border-l-green-500 bg-green-50';
      case 'recommendation':
        return 'border-l-orange-500 bg-orange-50';
      case 'completed':
        return 'border-l-green-600 bg-green-100';
      case 'error':
        return 'border-l-red-500 bg-red-50';
      default:
        return 'border-l-gray-400 bg-gray-50';
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) {
      return new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            🤖 {t('title')}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!isStreaming && events.length === 0 && (
              <Button
                onClick={startStreamingAnalysis}
                disabled={isRequestingRef.current}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t('start_analysis')}
              </Button>
            )}
            
            {isStreaming && (
              <Button
                onClick={stopStreamingAnalysis}
                variant="outline"
                size="sm"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t('streaming.cancel')}
              </Button>
            )}

            {events.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      收起
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      展开
                    </>
                  )}
                </Button>
                
                {fullContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAnalysis}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    复制
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 进度条 */}
        {isStreaming && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI正在分析中...
              </span>
              <span className="text-muted-foreground">{currentProgress.toFixed(0)}%</span>
            </div>
            <Progress value={currentProgress} className="h-2" />
          </div>
        )}
      </CardHeader>

      {isExpanded && events.length > 0 && (
        <CardContent className="pt-0">
          <ScrollArea ref={scrollAreaRef} className="h-96 w-full">
            <div className="space-y-3">
              {events.map((event, index) => (
                <div
                  key={index}
                  className={cn(
                    'p-3 rounded-lg border-l-4 transition-all duration-200',
                    getEventStyle(event.type)
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.type)}
                      <Badge variant="outline" className="text-xs">
                        {event.step}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(event.timestamp)}
                    </div>
                  </div>
                  
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    <span className="inline-block min-h-[1.5em]">
                      {event.content}
                      {/* 添加光标效果，表示正在输入 */}
                      {isStreaming && index === events.length - 1 && (
                        <span className="inline-block w-2 h-4 bg-purple-600 ml-1 animate-pulse"></span>
                      )}
                    </span>
                  </div>
                </div>
              ))}

              {/* 流式输入动画 */}
              {isStreaming && (
                <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <span className="text-sm text-purple-800">AI正在思考中...</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-purple-600 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      )}

      {/* 分析完成后的结果展示 */}
      {!isStreaming && events.length > 0 && (
        <CardContent className="pt-0">
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-green-800">分析完成</h3>
            </div>
            
            {/* 最终分析结果 */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <div className="prose prose-sm max-w-none">
                {fullContent ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {fullContent}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-green-800 mb-3">分析过程总结:</div>
                    {events.filter(e => e.type !== 'error').map((event, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        {getEventIcon(event.type)}
                        <div>
                          <div className="font-medium text-gray-800">{event.step}</div>
                          <div className="text-gray-600 mt-1">{event.content}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* 操作按钮 */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t">
              <Button
                onClick={copyAnalysis}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                复制分析结果
              </Button>
              
              <Button
                onClick={() => {
                  setEvents([]);
                  setFullContent('');
                  setCurrentProgress(0);
                  setHasRated(false);
                }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                重新分析
              </Button>
            </div>
            
            {/* 流式分析评价 - 只在完成且未评价时显示 */}
            {!hasRated && (
              <div className="mt-4 pt-4 border-t">
                <StreamingRating 
                  analysisContent={fullContent}
                  asin={productData.asin}
                  warehouseLocation={productData.warehouse_location}
                  onRatingSubmit={(rating, feedback) => {
                    console.log('Streaming analysis rated:', { rating, feedback });
                    setHasRated(true);
                  }}
                />
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* 空状态 */}
      {!isStreaming && events.length === 0 && (
        <CardContent className="pt-0">
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
              <Brain className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-medium mb-2">AI运营决策分析</h3>
            <p className="text-sm mb-4">
              观看AI分析师的完整思考过程，实时了解分析逻辑和推理步骤，获取专业的运营建议
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-xs">
              <div className="p-3 bg-purple-50 rounded-lg border">
                <div className="font-medium text-purple-900 mb-1 flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  思考过程
                </div>
                <div className="text-purple-700">实时展示AI思路</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border">
                <div className="font-medium text-blue-900 mb-1 flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  分析步骤
                </div>
                <div className="text-blue-700">逐步深入分析</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border">
                <div className="font-medium text-green-900 mb-1 flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  行动建议
                </div>
                <div className="text-green-700">可执行的建议</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border">
                <div className="font-medium text-yellow-900 mb-1 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  实时反馈
                </div>
                <div className="text-yellow-700">即时查看结果</div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}