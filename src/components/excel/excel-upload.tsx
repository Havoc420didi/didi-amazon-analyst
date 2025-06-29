"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import * as XLSX from "xlsx";

interface ExcelData {
  filename: string;
  data: any[][];
  headers: string[];
}

interface ExcelUploadProps {
  onUpload: (data: ExcelData) => void;
}

export function ExcelUpload({ onUpload }: ExcelUploadProps) {
  const t = useTranslations("analysis.upload_component");
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    // 文件类型验证
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error(t("file_format_error"), {
        description: t("file_format_description")
      });
      return;
    }

    // 文件大小验证 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("file_too_large"), {
        description: t("file_size_description")
      });
      return;
    }

    setIsProcessing(true);
    setUploadedFile(file);

    try {
      toast.info(t("processing_file"), {
        description: t("processing_description")
      });

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      
      // 获取第一个工作表
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error(t("processing_failed"));
      }

      const worksheet = workbook.Sheets[firstSheetName];
      
      // 将工作表转换为JSON数组
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        throw new Error(t("processing_failed"));
      }

      if (jsonData.length < 2) {
        throw new Error(t("processing_failed"));
      }

      // 提取表头和数据
      const headers = jsonData[0] as string[];
      const data = jsonData.slice(1) as any[][];

      // 验证表头
      if (!headers || headers.length === 0) {
        throw new Error(t("processing_failed"));
      }

      // 过滤空行并验证数据
      const filteredData = data.filter(row => row.some(cell => cell != null && cell !== ""));
      
      if (filteredData.length === 0) {
        throw new Error(t("processing_failed"));
      }

      const excelData: ExcelData = {
        filename: file.name,
        headers: headers.map(h => h?.toString() || ""),
        data: filteredData,
      };

      toast.success(t("processing_success"), {
        description: t("processing_success_description", { 
          rows: filteredData.length, 
          columns: headers.length 
        })
      });

      onUpload(excelData);
    } catch (error) {
      console.error("文件处理错误:", error);
      const errorMessage = error instanceof Error ? error.message : t("processing_failed");
      
      toast.error(t("processing_failed"), {
        description: errorMessage
      });
      
      // 清理状态
      setUploadedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {!uploadedFile ? (
        <Card
          className={`border-dashed border-2 transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("upload_title")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("drag_drop_text")}
            </p>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("processing")}
                </>
              ) : (
                t("select_file")
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {t("supported_formats")}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium">{uploadedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={removeFile}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isProcessing && (
            <div className="mt-3 flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("processing_description")}</span>
            </div>
          )}
        </Card>
      )}

      <div className="text-sm text-muted-foreground">
        <h4 className="font-medium mb-2">{t("supported_data_types")}</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>{t("data_types.sales")}</li>
          <li>{t("data_types.product")}</li>
          <li>{t("data_types.advertising")}</li>
          <li>{t("data_types.review")}</li>
          <li>{t("data_types.inventory")}</li>
        </ul>
      </div>
    </div>
  );
}