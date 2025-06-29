'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Star, MessageSquare, Send, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface QuickRatingProps {
  taskId: number;
  currentRating?: number | null;
  currentFeedback?: string | null;
  onRatingUpdate?: (rating: number, feedback?: string) => void;
}

export function QuickRating({ 
  taskId, 
  currentRating, 
  currentFeedback,
  onRatingUpdate 
}: QuickRatingProps) {
  const [rating, setRating] = useState<number | null>(currentRating || null);
  const [feedback, setFeedback] = useState(currentFeedback || '');
  const [showFeedback, setShowFeedback] = useState(!!currentFeedback);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!currentRating);

  // 提交评价
  const submitRating = async () => {
    if (!rating) {
      toast.error('请先选择评分');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/ai-analysis/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          feedback: feedback.trim() || undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        setSubmitted(true);
        toast.success('评价提交成功！');
        onRatingUpdate?.(rating, feedback.trim() || undefined);
      } else {
        toast.error(result.error || '评价提交失败');
      }
    } catch (error) {
      console.error('Submit rating error:', error);
      toast.error('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 星级评价组件
  const StarRating = () => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={cn(
              'p-1 rounded transition-colors',
              'hover:bg-yellow-100',
              !submitted && 'cursor-pointer',
              submitted && 'cursor-default'
            )}
            onClick={() => !submitted && setRating(star)}
            disabled={submitted}
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                rating && star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              )}
            />
          </button>
        ))}
      </div>
    );
  };

  // 获取评价文字描述
  const getRatingText = (score: number) => {
    switch (score) {
      case 1: return '很差';
      case 2: return '较差';
      case 3: return '一般';
      case 4: return '良好';
      case 5: return '优秀';
      default: return '';
    }
  };

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* 标题和状态 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900">这个分析对您有帮助吗？</h4>
              {submitted && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <Check className="h-3 w-3 mr-1" />
                  已评价
                </Badge>
              )}
            </div>
          </div>

          {/* 星级评价 */}
          <div className="flex items-center gap-3">
            <StarRating />
            {rating && (
              <span className="text-sm font-medium text-gray-600">
                {getRatingText(rating)}
              </span>
            )}
          </div>

          {/* 文字反馈 */}
          {(showFeedback || currentFeedback) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  详细反馈 (可选)
                </span>
              </div>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="请分享您的具体想法和建议..."
                className="min-h-[60px] resize-none"
                disabled={submitted}
              />
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {!submitted && (
              <>
                {!showFeedback && !currentFeedback && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFeedback(true)}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    添加反馈
                  </Button>
                )}
                
                <Button
                  onClick={submitRating}
                  disabled={!rating || submitting}
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      提交评价
                    </>
                  )}
                </Button>
              </>
            )}

            {submitted && currentFeedback && (
              <div className="text-sm text-gray-600 bg-white/50 rounded-md p-2 border border-gray-200">
                <div className="font-medium mb-1">您的反馈：</div>
                <div className="italic">{currentFeedback}</div>
              </div>
            )}
          </div>

          {/* 感谢信息 */}
          {submitted && (
            <div className="text-sm text-gray-600 bg-white/50 rounded-md p-3 border border-gray-200">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>感谢您的评价！您的反馈将帮助我们改进AI分析的质量。</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}