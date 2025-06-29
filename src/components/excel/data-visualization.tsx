"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Eye } from "lucide-react";
import { useTranslations } from "next-intl";

interface ExcelData {
  filename: string;
  data: any[][];
  headers: string[];
}

interface DataVisualizationProps {
  data: ExcelData;
}

export function DataVisualization({ data }: DataVisualizationProps) {
  const t = useTranslations("analysis.data_visualization");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(data.data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.data.slice(startIndex, endIndex);

  // 限制显示的列数
  const maxColumns = showAllColumns ? data.headers.length : Math.min(6, data.headers.length);
  const displayHeaders = data.headers.slice(0, maxColumns);

  const getDataTypeIcon = (header: string) => {
    const lowerHeader = header.toLowerCase();
    if (lowerHeader.includes("price") || lowerHeader.includes("amount") || lowerHeader.includes("revenue")) {
      return "💰";
    }
    if (lowerHeader.includes("date") || lowerHeader.includes("time")) {
      return "📅";
    }
    if (lowerHeader.includes("quantity") || lowerHeader.includes("count") || lowerHeader.includes("number")) {
      return "🔢";
    }
    if (lowerHeader.includes("asin") || lowerHeader.includes("sku")) {
      return "🏷️";
    }
    return "📊";
  };

  const formatCellValue = (value: any, headerIndex: number) => {
    if (value == null || value === "") return "-";
    
    const header = data.headers[headerIndex]?.toLowerCase() || "";
    
    // 格式化价格
    if (header.includes("price") || header.includes("amount") || header.includes("revenue")) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return `$${num.toFixed(2)}`;
      }
    }
    
    // 格式化数量
    if (header.includes("quantity") || header.includes("count")) {
      const num = parseInt(value);
      if (!isNaN(num)) {
        return num.toLocaleString();
      }
    }

    return value.toString();
  };

  return (
    <div className="space-y-4">
      {/* 数据统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{data.data.length}</div>
            <p className="text-sm text-muted-foreground">{t("total_rows")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{data.headers.length}</div>
            <p className="text-sm text-muted-foreground">{t("total_columns")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalPages}</div>
            <p className="text-sm text-muted-foreground">{t("total_pages")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {Math.round((data.data.filter(row => row.some(cell => cell != null && cell !== "")).length / data.data.length) * 100)}%
            </div>
            <p className="text-sm text-muted-foreground">{t("data_completeness")}</p>
          </CardContent>
        </Card>
      </div>

      {/* 列信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5" />
            <span>{t("column_info")}</span>
          </CardTitle>
          <CardDescription>{t("column_info_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.headers.map((header, index) => (
              <Badge key={index} variant="secondary" className="text-sm">
                <span className="mr-1">{getDataTypeIcon(header)}</span>
                {header}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 数据预览表格 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>{t("data_preview")}</span>
              </CardTitle>
              <CardDescription>
                {t("data_preview_description", {
                  start: startIndex + 1,
                  end: Math.min(endIndex, data.data.length),
                  total: data.data.length
                })}
              </CardDescription>
            </div>
            {data.headers.length > 6 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllColumns(!showAllColumns)}
              >
                {showAllColumns ? t("show_partial_columns") : t("show_all_columns")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  {displayHeaders.map((header, index) => (
                    <TableHead key={index} className="min-w-24">
                      <div className="flex items-center space-x-1">
                        <span>{getDataTypeIcon(header)}</span>
                        <span>{header}</span>
                      </div>
                    </TableHead>
                  ))}
                  {!showAllColumns && data.headers.length > 6 && (
                    <TableHead>...</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.map((row, rowIndex) => (
                  <TableRow key={startIndex + rowIndex}>
                    <TableCell className="font-mono text-sm">
                      {startIndex + rowIndex + 1}
                    </TableCell>
                    {displayHeaders.map((_, colIndex) => (
                      <TableCell key={colIndex} className="max-w-32 truncate">
                        {formatCellValue(row[colIndex], colIndex)}
                      </TableCell>
                    ))}
                    {!showAllColumns && data.headers.length > 6 && (
                      <TableCell className="text-muted-foreground">
                        {t("more_columns", { count: data.headers.length - 6 })}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* 分页控制 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {t("page_info", { current: currentPage, total: totalPages })}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("previous_page")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  {t("next_page")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}