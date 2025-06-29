'use client';

import { useState } from 'react';
import { ProductAnalysisData } from '@/types/ai-analysis';
import { StreamingAnalysisDisplay } from './streaming-analysis-display';

interface AnalysisPanelProps {
  productData: ProductAnalysisData;
  executor?: string;
}

export function AnalysisPanel({ productData, executor = 'system' }: AnalysisPanelProps) {
  const [streamingComplete, setStreamingComplete] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');


  // 流式分析完成处理
  const handleStreamingComplete = (content: string) => {
    setStreamingComplete(true);
    setStreamingContent(content);
  };

  return (
    <StreamingAnalysisDisplay 
      productData={productData}
      executor={executor}
      onComplete={handleStreamingComplete}
    />
  );
}