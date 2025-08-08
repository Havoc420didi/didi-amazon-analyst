'use client';

import { useState } from 'react';
import { ProductData } from '@/types/product';

interface FileUploadProps {
  onUpload?: (file: File) => Promise<void>;
}

export function FileUpload({ onUpload }: FileUploadProps) {
  const [fileName, setFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 处理文件上传事件
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setUploadError(null);
    setIsUploading(true);
    
    try {
      // 如果父组件提供了onUpload回调，使用它处理文件
      if (onUpload) {
        await onUpload(file);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(error instanceof Error ? error.message : '上传文件时发生错误');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm mb-8">
      <h2 className="text-lg font-medium mb-4">上传产品数据</h2>
      <div className="mb-4">
        <label className="inline-block px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600">
          {isUploading ? '正在上传...' : '选择Excel文件'}
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading}
          />
        </label>
        {fileName && (
          <span className="ml-4 text-gray-600">
            {fileName}
          </span>
        )}
      </div>
      
      {uploadError && (
        <div className="p-3 bg-red-100 text-red-700 rounded mt-2">
          {uploadError}
        </div>
      )}
      
      <div className="text-sm text-gray-500">
        <p>请上传Excel格式的产品数据文件，文件应包含以下字段：</p>
        <p>ASIN、品名、SKU、站点、店铺、分类、业务员等基础信息</p>
      </div>
    </div>
  );
}