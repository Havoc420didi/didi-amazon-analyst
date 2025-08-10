/**
 * AI分析触发组件
 * 集成到现有库存管理表格中，为每个库存点提供AI分析功能
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  Info
} from 'lucide-react';
import { InventoryPoint } from '@/types/inventory-view';
import { ProductAnalysisData, AIAnalysisResult, AnalysisPeriod } from '@/types/ai-analysis';
import { AnalysisResult } from './analysis-result';
import { AnalysisPeriodSelector } from './analysis-period-selector';

interface AnalysisTriggerProps {
  inventoryPoint: InventoryPoint;
  className?: string;
  size?: 'sm' | 'lg' | 'default';
  variant?: 'default' | 'outline' | 'ghost';
}

interface AnalysisState {
  status: 'idle' | 'analyzing' | 'completed' | 'error';
  result?: AIAnalysisResult;
  error?: string;
  taskId?: string;
  progress?: number;
}

const DEFAULT_ANALYSIS_PERIOD: AnalysisPeriod = {
  type: 'single_day',
  days: 1,
  end_date: new Date().toISOString().split('T')[0],
  aggregation_method: 'latest'
};

export function AnalysisTrigger({ 
  inventoryPoint, 
  className,
  size = 'sm',
  variant = 'outline'
}: AnalysisTriggerProps) {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: 'idle' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<AnalysisPeriod>(DEFAULT_ANALYSIS_PERIOD);
  const [showPeriodSelector, setShowPeriodSelector] = useState(false);
  // 流式“打字机”显示
  const [displayedText, setDisplayedText] = useState('');
  const [bufferText, setBufferText] = useState('');
  // 不再延迟显示，直接显示正文增量
  const typingIntervalRef = useRef<number | null>(null);
  const displayContainerRef = useRef<HTMLDivElement | null>(null);
  const displayedRef = useRef('');

  useEffect(() => { displayedRef.current = displayedText; }, [displayedText]);

  // 打字机效果：把 bufferText 按字符输出到 displayedText
  useEffect(() => {
    if (analysisState.status !== 'analyzing') {
      // 停止打字机
      if (typingIntervalRef.current) {
        window.clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      return;
    }
    if (typingIntervalRef.current) return;
    typingIntervalRef.current = window.setInterval(() => {
      setBufferText(prev => {
        if (!prev || prev.length === 0) return prev;
        // 取一个字符放入展示文本
        const nextChar = prev[0];
        setDisplayedText(d => d + nextChar);
        return prev.slice(1);
      });
    }, 15);
    return () => {
      if (typingIntervalRef.current) {
        window.clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, [analysisState.status]);

  // 打字区域自动滚动到最新
  useEffect(() => {
    const el = displayContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [displayedText]);

  // 判断产品是否需要优先分析
  const getPriorityLevel = (point: InventoryPoint): 'high' | 'medium' | 'low' => {
    // 库存不足 - 高优先级
    if (point.isOutOfStock || point.isLowInventory) return 'high';
    
    // 库存积压或零销量 - 中优先级
    if (point.isTurnoverExceeded || point.isZeroSales) return 'medium';
    
    // 日均销售额较高 - 中优先级
    if (point.dailySalesAmount >= 50) return 'medium';
    
    return 'low';
  };

  // 获取优先级颜色和图标
  const getPriorityDisplay = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return { color: 'destructive', icon: AlertTriangle, text: '优先' };
      case 'medium':
        return { color: 'warning', icon: TrendingUp, text: '关注' };
      default:
        return { color: 'secondary', icon: Info, text: '正常' };
    }
  };

  // 转换库存点数据为AI分析数据格式
  const convertToAnalysisData = (point: InventoryPoint): ProductAnalysisData => {
    return {
      asin: point.asin,
      product_name: point.productName,
      warehouse_location: point.marketplace,
      sales_person: point.salesPerson || '',
      
      // 库存数据
      total_inventory: point.totalInventory,
      fba_available: point.fbaAvailable || 0,
      fba_in_transit: point.fbaInbound || 0,
      local_warehouse: point.localAvailable || 0,
      inventory_turnover_days: point.turnoverDays,
      inventory_status: point.isOutOfStock ? '断货' : 
                       point.isLowInventory ? '库存不足' :
                       point.isTurnoverExceeded ? '周转超标' : '库存健康',
      
      // 销售数据
      avg_sales: point.averageSales,
      daily_revenue: point.dailySalesAmount,
      
      // 广告数据
      ad_impressions: point.adImpressions || 0,
      ad_clicks: point.adClicks || 0,
      ad_spend: point.adSpend || 0,
      ad_orders: point.adOrderCount || 0,
      acos: point.adSpend && point.dailySalesAmount ? 
            (point.adSpend / (point.dailySalesAmount * 7)) : 0,
      
      // 默认趋势数据
      trends: {
        inventory_change: 0,
        revenue_change: 0,
        sales_change: 0
      },
      
      history: []
    };
  };

  // 触发AI分析
  const handleAnalyze = async () => {
    try {
      console.log('[AnalysisTrigger] handleAnalyze: start', {
        asin: inventoryPoint.asin,
        marketplace: inventoryPoint.marketplace,
        selectedPeriod,
      });
    } catch {}
    setAnalysisState({ status: 'analyzing', progress: 0 });
    setDisplayedText('');
    setBufferText('');
    setIsDialogOpen(true);

    setIsPending(true);
    (async () => {
      try {
        // 构建请求体，根据分析类型决定是否包含product_data
        const requestBody: any = {
          asin: inventoryPoint.asin,
          warehouse_location: inventoryPoint.marketplace,
          executor: 'system', // 或从用户上下文获取
          analysis_period: selectedPeriod
        };

        // 单日分析需要提供产品数据，多日分析由后端聚合
        if (selectedPeriod.type === 'single_day') {
          requestBody.product_data = convertToAnalysisData(inventoryPoint);
        } else {
          // 多日分析提供空的产品数据结构（后端会忽略并重新聚合）
          requestBody.product_data = {
            asin: inventoryPoint.asin,
            product_name: inventoryPoint.productName,
            warehouse_location: inventoryPoint.marketplace,
            sales_person: inventoryPoint.salesPerson || '',
            total_inventory: 0,
            fba_available: 0,
            fba_in_transit: 0,
            local_warehouse: 0,
            avg_sales: 0,
            daily_revenue: 0,
            ad_impressions: 0,
            ad_clicks: 0,
            ad_spend: 0,
            ad_orders: 0
          };
        }
        // 优先尝试SSE流式分析
        try {
          const sseResp = await fetch('/api/ai-analysis/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (sseResp.ok && sseResp.headers.get('content-type')?.includes('text/event-stream') && sseResp.body) {
            const reader = sseResp.body.getReader();
            const decoder = new TextDecoder();
            let buffered = '';
            let reachedDone = false;

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              buffered += chunk;
              const events = buffered.split('\n\n');
              buffered = events.pop() || '';

              for (const ev of events) {
                // 解析 event & data
                const lines = ev.split('\n');
                let eventName = 'message';
                const dataLines: string[] = [];
                for (const ln of lines) {
                  if (ln.startsWith('event:')) eventName = ln.slice(6).trim();
                  if (ln.startsWith('data:')) dataLines.push(ln.slice(5).trimStart());
                }
                const dataStr = dataLines.join('\n');
                if (dataStr === '[DONE]') {
                  const finalText = (displayedRef.current + bufferText).trim();
                  setAnalysisState(prev => ({
                    ...prev,
                    status: 'completed',
                    result: prev.result ?? {
                      analysis_content: finalText,
                      processing_time: 0,
                      tokens_used: 0,
                      recommendations: {
                        inventory_action: '详见报告正文的库存建议',
                        sales_strategy: '详见报告正文的销售策略',
                        ad_optimization: '详见报告正文的广告建议',
                        risk_level: 'medium',
                      },
                    },
                  }));
                  reachedDone = true;
                  continue;
                }
                try {
                  const payload = JSON.parse(dataStr) as { type?: string; content?: string; message?: string; text?: string; progress?: number; agent_name?: string; token?: string; delta?: string; output?: string; chunk?: string };
                  const evtType = payload.type || eventName;
                  if (payload.progress !== undefined) {
                    const nextProgress = Math.min(99, Number(payload.progress || 0));
                    setAnalysisState(prev => ({ ...prev, progress: nextProgress }));
                  }
                  // 忽略控制事件（start_of_agent/end_of_agent/start_of_llm/end_of_llm）在文本区的显示，仅用于进度
                  // 不再写入 bufferText。

                  // 内容提取（处理增量结构，如 { delta: { content: '字' } }）
                  let contentText = '';
                  if (typeof (payload as any).content === 'string') {
                    contentText = (payload as any).content;
                  } else if (payload.delta && typeof payload.delta === 'object' && typeof (payload.delta as any).content === 'string') {
                    contentText = (payload.delta as any).content;
                  } else if (typeof (payload as any).message === 'string') {
                    contentText = (payload as any).message;
                  } else if (typeof (payload as any).text === 'string') {
                    contentText = (payload as any).text;
                  } else if (typeof (payload as any).token === 'string') {
                    contentText = (payload as any).token;
                  } else if (typeof (payload as any).delta === 'string') {
                    contentText = (payload as any).delta;
                  } else if (typeof (payload as any).output === 'string') {
                    contentText = (payload as any).output;
                  } else if (typeof (payload as any).chunk === 'string') {
                    contentText = (payload as any).chunk;
                  }

                  if (contentText) {
                    // 去重：若刚输出的尾部已包含相同内容，则跳过，避免循环/重复片段
                    setBufferText(prev => {
                      const tailSource = displayedRef.current + prev;
                      const sliceLen = Math.min(contentText.length, tailSource.length);
                      const tail = tailSource.slice(tailSource.length - sliceLen);
                      if (tail === contentText) return prev;
                      return prev + contentText;
                    });
                  } else if (dataStr && evtType !== 'message') {
                    setBufferText(prev => prev + `[${eventName}] ` + dataStr + '\n');
                    setAnalysisState(prev => ({ ...prev, progress: Math.min(95, (prev.progress || 30) + 1) }));
                  }

                  if (evtType === 'error') {
                    throw new Error(contentText || '流式分析失败');
                  }
                  if (evtType === 'completed') {
                    const finalText = (displayedText + bufferText).trim();
                    setAnalysisState({
                      status: 'completed',
                      result: {
                        analysis_content: finalText || contentText || '',
                        processing_time: 0,
                        tokens_used: 0,
                        recommendations: {
                          inventory_action: '库存操作建议已生成',
                          sales_strategy: '销售策略建议已生成',
                          ad_optimization: '广告优化建议已生成',
                          risk_level: 'medium',
                        },
                      },
                      progress: 100,
                    });
                    continue;
                  }
                  // 非完成事件，推进进度条
                  setAnalysisState(prev => ({ ...prev, progress: Math.min(95, (prev.progress || 30) + 1) }));
                } catch {
                  if (dataStr) {
                    setBufferText(prev => prev + `[${eventName}] ` + dataStr + '\n');
                    setAnalysisState(prev => ({ ...prev, progress: Math.min(95, (prev.progress || 30) + 1) }));
                  }
                }
              }
            }
            // SSE流程已完成，若未标记完成则补一次，并生成最终报告
            setAnalysisState(prev => {
              if (prev.status === 'completed') return prev;
              const finalText = (displayedRef.current + bufferText).trim();
              return {
                ...prev,
                status: 'completed',
                result: prev.result ?? {
                  analysis_content: finalText,
                  processing_time: 0,
                  tokens_used: 0,
                  recommendations: {
                    inventory_action: '详见报告正文的库存建议',
                    sales_strategy: '详见报告正文的销售策略',
                    ad_optimization: '详见报告正文的广告建议',
                    risk_level: 'medium',
                  },
                },
              };
            });
            return;
          }
        } catch (e) {
          console.warn('[AnalysisTrigger] SSE streaming failed, fallback to polling', e);
        }

        // 回退：非流式创建任务 + 轮询
        const response = await fetch('/api/ai-analysis/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || '分析请求失败');
        }

        const taskId = data.data.task_id;
        try {
          console.log('[AnalysisTrigger] generate success', { taskId, taskNumber: data.data.task_number, status: data.data.status });
        } catch {}
        setAnalysisState(prev => ({ ...prev, taskId, progress: 20 }));

        // 轮询任务状态
        await pollTaskStatus(taskId);

      } catch (error) {
        console.error('Analysis failed:', error);
        setAnalysisState({
          status: 'error',
          error: error instanceof Error ? error.message : '分析失败'
        });
      } finally {
        setIsPending(false);
      }
    })();
  };

  // 轮询任务状态
  const pollTaskStatus = async (taskId: string) => {
    const maxAttempts = 60; // 最多轮询60次（5分钟）
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/ai-analysis/${taskId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || '获取分析状态失败');
        }

        const task = data.data;
        const progress = Math.min(30 + (attempts * 2), 90);
        
        setAnalysisState(prev => ({ ...prev, progress }));

        switch (task.status) {
          case 'completed':
            try { console.log('[AnalysisTrigger] task completed', { taskId }); } catch {}
            setAnalysisState({
              status: 'completed',
              result: {
                analysis_content: task.analysis_content,
                processing_time: task.processing_time,
                tokens_used: task.tokens_used,
                recommendations: {
                  inventory_action: '库存操作建议已生成',
                  sales_strategy: '销售策略建议已生成',
                  ad_optimization: '广告优化建议已生成',
                  risk_level: 'medium'
                }
              },
              progress: 100
            });
            return;

          case 'failed':
            try { console.warn('[AnalysisTrigger] task failed', { taskId }); } catch {}
            throw new Error(task.analysis_content || '分析任务失败');

          case 'processing':
            attempts++;
            try { console.log('[AnalysisTrigger] polling', { taskId, attempts, status: task.status }); } catch {}
            if (attempts < maxAttempts) {
              setTimeout(poll, 3000); // 3秒后重试
            } else {
              throw new Error('分析超时，请稍后重试');
            }
            break;

          default:
            // pending状态，继续轮询
            attempts++;
            try { console.log('[AnalysisTrigger] polling', { taskId, attempts, status: task.status }); } catch {}
            if (attempts < maxAttempts) {
              setTimeout(poll, 2000); // 2秒后重试
            } else {
              throw new Error('分析超时，请稍后重试');
            }
        }
      } catch (error) {
        console.error('Poll task status error:', error);
        setAnalysisState({
          status: 'error',
          error: error instanceof Error ? error.message : '获取分析状态失败'
        });
      }
    };

    // 开始轮询
    setTimeout(poll, 1000);
  };

  const priority = getPriorityLevel(inventoryPoint);
  const priorityDisplay = getPriorityDisplay(priority);
  const Icon = priorityDisplay.icon;

  // 状态图标
  const getStatusIcon = () => {
    switch (analysisState.status) {
      case 'analyzing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  // 按钮文本
  const getButtonText = () => {
    switch (analysisState.status) {
      case 'analyzing':
        return '分析中...';
      case 'completed':
        return 'AI分析'; // CSV模式下，即使完成也显示"AI分析"，允许重新分析
      case 'error':
        return '重新分析';
      default:
        return 'AI分析';
    }
  };

  return (
    <TooltipProvider>
      <div className={className}>
        {/* 优先级标识 */}
        {priority === 'high' && (
          <Badge variant="destructive" className="mb-1 text-xs">
            <Icon className="h-3 w-3 mr-1" />
            {priorityDisplay.text}
          </Badge>
        )}
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={variant === 'default' ? 'gradient' : variant}
                  size={size}
                  onClick={() => { try { console.log('[AnalysisTrigger] dialog trigger clicked'); } catch {}; setIsDialogOpen(true); }}
                  disabled={isPending || analysisState.status === 'analyzing'}
                  className="w-full"
                >
                  {getStatusIcon()}
                  <span className="ml-2">{getButtonText()}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  为 {inventoryPoint.asin} ({inventoryPoint.marketplace}) 生成AI运营分析
                </p>
              </TooltipContent>
            </Tooltip>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI智能分析：{inventoryPoint.productName}
              </DialogTitle>
              <DialogDescription>
                ASIN: {inventoryPoint.asin} | 库存点: {inventoryPoint.marketplace}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* 分析周期选择器 - CSV模式下，即使有结果也可以重新分析 */}
              {(analysisState.status === 'idle' || analysisState.status === 'completed' || analysisState.status === 'error') && (
                <div className="space-y-4">
                  <AnalysisPeriodSelector
                    onPeriodChange={setSelectedPeriod}
                    defaultPeriod={selectedPeriod}
                  />
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleAnalyze}
                      disabled={isPending}
                      className="flex-1"
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      {analysisState.status === 'completed' ? '重新分析' : '开始AI分析'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* 分析状态 */}
              {analysisState.status === 'analyzing' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在进行AI分析...</span>
                  </div>
                  
                  {/* 进度条与文案已移除 */}
              {/* 流式内容打字机显示 */}
              <div className="rounded-md border bg-muted/40 p-3 max-h-[300px] overflow-auto" ref={displayContainerRef}>
                <div className="font-mono text-sm whitespace-pre-wrap break-words min-h-[140px]">
                  {displayedText || '等待AI输出...'}
                  <span className="ml-1 inline-block animate-pulse">▋</span>
                </div>
                    </div>
                  
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      AI智能体正在分析产品数据，通常需要30-60秒完成。请保持页面打开。
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {analysisState.status === 'completed' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>分析完成</span>
                </div>
              )}

              {/* 分析错误 */}
              {analysisState.status === 'error' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {analysisState.error}
                  </AlertDescription>
                </Alert>
              )}

              {/* 产品基本信息 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <h4 className="font-medium mb-2">库存状况</h4>
                  <div className="space-y-1 text-sm">
                    <p>总库存: {inventoryPoint.totalInventory} 件</p>
                    <p>周转天数: {inventoryPoint.turnoverDays} 天</p>
                    <p>平均销量: {inventoryPoint.averageSales} 件/天</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">销售表现</h4>
                  <div className="space-y-1 text-sm">
                    <p>日均销售额: ${inventoryPoint.dailySalesAmount.toFixed(2)}</p>
                    <p>业务员: {inventoryPoint.salesPerson}</p>
                    <p>有效库存点: {inventoryPoint.dailySalesAmount >= 16.7 ? '是' : '否'}</p>
                  </div>
                </div>
              </div>

              {/* 分析完成后在库存状况模块下显示综合分析报告 */}
              {analysisState.status === 'completed' && analysisState.result && (
                <div className="mt-4">
                  <AnalysisResult result={analysisState.result} inventoryPoint={inventoryPoint} />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}