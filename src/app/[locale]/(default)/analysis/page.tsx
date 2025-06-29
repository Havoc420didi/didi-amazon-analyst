"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, BarChart3, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ExcelUpload } from "@/components/excel/excel-upload";
import { DataVisualization } from "@/components/excel/data-visualization";
import { AnalysisResults } from "@/components/excel/analysis-results";

interface ExcelData {
  filename: string;
  data: any[][];
  headers: string[];
}

interface AnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
  charts?: any[];
}

export default function AnalysisPage() {
  const t = useTranslations("analysis");
  
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");

  const handleFileUpload = (data: ExcelData) => {
    setExcelData(data);
    setActiveTab("preview");
  };

  const handleAnalysis = async () => {
    if (!excelData) {
      toast.error(t("messages.no_data_error"), {
        description: t("messages.no_data_description")
      });
      return;
    }

    setIsAnalyzing(true);
    toast.info(t("messages.analysis_start"), {
      description: t("messages.analysis_start_description")
    });

    try {
      const response = await fetch("/api/analyze-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: excelData.data,
          headers: excelData.headers,
          filename: excelData.filename,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t("messages.analysis_retry"));
      }

      const result = await response.json();
      
      if (!result || !result.summary) {
        throw new Error(t("messages.invalid_result"));
      }

      setAnalysisResult(result);
      setActiveTab("results");
      
      toast.success(t("messages.analysis_success"), {
        description: t("messages.analysis_success_description")
      });
    } catch (error) {
      console.error("分析错误:", error);
      const errorMessage = error instanceof Error ? error.message : t("messages.analysis_retry");
      
      toast.error(t("messages.analysis_failed"), {
        description: errorMessage
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <BarChart3 className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{t("page_title")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>{t("tabs.upload")}</span>
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!excelData} className="flex items-center space-x-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span>{t("tabs.preview")}</span>
          </TabsTrigger>
          <TabsTrigger value="analysis" disabled={!excelData} className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>{t("tabs.analysis")}</span>
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!analysisResult} className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>{t("tabs.results")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("upload.title")}</CardTitle>
              <CardDescription>
                {t("upload.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExcelUpload onUpload={handleFileUpload} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          {excelData && (
            <Card>
              <CardHeader>
                <CardTitle>{t("preview.title")}</CardTitle>
                <CardDescription>
                  {t("preview.description", { 
                    filename: excelData.filename, 
                    count: excelData.data.length 
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataVisualization data={excelData} />
                <div className="mt-4 flex justify-end">
                  <Button onClick={() => setActiveTab("analysis")}>
                    {t("preview.start_analysis")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("ai_analysis.title")}</CardTitle>
              <CardDescription>
                {t("ai_analysis.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {t("ai_analysis.content_description")}
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t("ai_analysis.features.sales_trend")}</li>
                <li>{t("ai_analysis.features.product_performance")}</li>
                <li>{t("ai_analysis.features.inventory_optimization")}</li>
                <li>{t("ai_analysis.features.marketing_strategy")}</li>
                <li>{t("ai_analysis.features.competitive_analysis")}</li>
              </ul>
              <Button 
                onClick={handleAnalysis} 
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("ai_analysis.analyzing_button")}
                  </>
                ) : (
                  t("ai_analysis.start_button")
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {analysisResult && (
            <AnalysisResults result={analysisResult} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}