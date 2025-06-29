'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  ArrowLeft,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import type { ExcelUploadResult } from '@/types/inventory';

export default function InventoryUpload() {
  const router = useRouter();
  const [uploadDate, setUploadDate] = useState(() => {
    // 默认为今天
    return new Date().toISOString().split('T')[0];
  });
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ExcelUploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 文件拖拽处理
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setUploadResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  // 上传文件
  const handleUpload = async () => {
    if (!selectedFile || !uploadDate) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('date', uploadDate);

      const response = await fetch('/api/inventory/upload', {
        method: 'POST',
        body: formData
      });

      const result: ExcelUploadResult = await response.json();
      setUploadResult(result);

      if (result.success) {
        // 清空文件选择
        setSelectedFile(null);
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: '上传失败: ' + (error instanceof Error ? error.message : '未知错误'),
        total_rows: 0,
        success_count: 0,
        error_count: 0
      });
    } finally {
      setUploading(false);
    }
  };

  // 下载示例文件
  const downloadTemplate = () => {
    // TODO: 提供示例Excel文件下载
    console.log('Template download will be implemented');
  };

  // 返回列表页
  const goBack = () => {
    router.push('/inventory');
  };

  // 查看上传结果
  const viewResults = () => {
    router.push('/inventory');
  };

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div>
        <Button variant="ghost" onClick={goBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回库存列表
        </Button>
      </div>

      {/* 主上传区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            数据上传
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 日期选择 */}
          <div className="space-y-2">
            <Label htmlFor="upload-date">数据日期</Label>
            <Input
              id="upload-date"
              type="date"
              value={uploadDate}
              onChange={(e) => setUploadDate(e.target.value)}
              className="w-48"
            />
            <p className="text-sm text-muted-foreground">
              选择此次上传数据对应的日期
            </p>
          </div>

          {/* 文件上传区域 */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
              }
              ${selectedFile ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            {selectedFile ? (
              <div className="space-y-2">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                <div className="text-lg font-medium text-green-800 dark:text-green-200">
                  文件已选择
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  重新选择
                </Button>
              </div>
            ) : isDragActive ? (
              <div className="space-y-2">
                <Upload className="h-12 w-12 text-primary mx-auto" />
                <div className="text-lg font-medium">松开鼠标上传文件</div>
              </div>
            ) : (
              <div className="space-y-2">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto" />
                <div className="text-lg font-medium">拖拽文件到此处或点击选择</div>
                <div className="text-sm text-muted-foreground">
                  支持 .xlsx、.xls、.csv 格式，最大 10MB
                </div>
              </div>
            )}
          </div>

          {/* 上传按钮 */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !uploadDate || uploading}
              className="min-w-32"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  开始上传
                </>
              )}
            </Button>

            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              下载模板
            </Button>
          </div>

          {/* 上传进度 */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>上传进度</span>
                <span>处理中...</span>
              </div>
              <Progress value={50} className="w-full" />
            </div>
          )}

          {/* 上传结果 */}
          {uploadResult && (
            <div className="space-y-4">
              <Alert className={uploadResult.success ? 'border-green-500' : 'border-red-500'}>
                <div className="flex items-center gap-2">
                  {uploadResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className="font-medium">
                    {uploadResult.message}
                  </AlertDescription>
                </div>
              </Alert>

              {/* 结果统计 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{uploadResult.total_rows}</div>
                  <div className="text-sm text-muted-foreground">总行数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{uploadResult.success_count}</div>
                  <div className="text-sm text-muted-foreground">成功</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{uploadResult.error_count}</div>
                  <div className="text-sm text-muted-foreground">失败</div>
                </div>
              </div>

              {/* 错误详情 */}
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium">错误详情:</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {uploadResult.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-sm bg-red-50 dark:bg-red-950 p-2 rounded">
                        <span className="font-medium">第{error.row}行:</span> {error.message}
                      </div>
                    ))}
                    {uploadResult.errors.length > 5 && (
                      <div className="text-sm text-muted-foreground">
                        ... 还有 {uploadResult.errors.length - 5} 个错误
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 成功后的操作 */}
              {uploadResult.success && (
                <div className="flex gap-2">
                  <Button onClick={viewResults}>
                    查看上传结果
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 格式说明 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              文件格式要求
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="font-medium">必需字段:</div>
              <div className="text-sm space-y-1">
                <div>• ASIN - 产品标识符</div>
                <div>• 品名 - 产品名称</div>
                <div>• 业务员 - 负责业务员</div>
                <div>• 库存点 - 英国/欧盟</div>
                <div>• 库存状态 - 库存不足/周转合格/周转超标</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium">数据字段:</div>
              <div className="text-sm space-y-1">
                <div>• FBA可用、FBA在途、本地仓</div>
                <div>• 平均销量、日均销售额</div>
                <div>• 广告数据（曝光、点击、花费等）</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              注意事项
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <div>• 文件大小不超过 10MB</div>
              <div>• 支持 .xlsx、.xls、.csv 格式</div>
              <div>• 相同ASIN+库存点+日期的记录会被更新</div>
              <div>• 数值字段请确保格式正确</div>
              <div>• 建议先下载模板文件参考格式</div>
            </div>
            
            <div className="pt-2 border-t">
              <div className="text-sm font-medium mb-1">上传策略:</div>
              <div className="text-sm text-muted-foreground">
                系统采用 upsert 策略，如果存在相同的记录（ASIN+库存点+日期），
                将更新现有记录；否则创建新记录。
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}