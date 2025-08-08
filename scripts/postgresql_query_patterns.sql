-- PostgreSQL查询模式转换
-- MySQL → PostgreSQL 查询映射参考

-- 1. MySQL LIMIT → PostgreSQL LIMIT
-- MySQL: SELECT * FROM table LIMIT 10 OFFSET 20
-- PostgreSQL: SELECT * FROM table LIMIT 10 OFFSET 20 (相同)

-- 2. 日期时间查询转换
-- MySQL: SELECT * FROM table WHERE DATE(date_column) = '2024-01-01'
-- PostgreSQL: SELECT * FROM table WHERE date_column::date = '2024-01-01'

-- 3. 聚合查询示例
-- 时间范围聚合 (用于AI分析的多日数据)
SELECT 
    asin,
    marketplace,
    DATE_TRUNC('day', data_date) as day,
    AVG(total_inventory) as avg_total_inventory,
    AVG(average_sales) as avg_avg_sales,
    AVG(daily_sales_amount) as avg_daily_revenue,
    SUM(ad_spend) as total_ad_spend,
    CASE 
        WHEN AVG(total_inventory) <= 0 THEN '断货'
        WHEN AVG(turnover_days) <= 45 THEN '库存不足'
        WHEN AVG(turnover_days) >= 90 THEN '周转超标' 
        ELSE '库存健康'
    END as status_analysis
FROM inventory_points 
WHERE data_date >= CURRENT_DATE - INTERVAL '7 days'
  AND asin = ?
  AND marketplace = ?
GROUP BY asin, marketplace, DATE_TRUNC('day', data_date)
ORDER BY day DESC;

-- 4. 库存点分析查询 (DataAggregationService核心查询)
SELECT 
    asin,
    marketplace,
    COUNT(*) as data_point_count,
    MIN(data_date) as start_date,
    MAX(data_date) as end_date,
    
    -- 最新数据
    FIRST_VALUE(total_inventory) OVER (
        PARTITION BY asin, marketplace ORDER BY data_date DESC
    ) as latest_total_inventory,
    FIRST_VALUE(average_sales) OVER (
        PARTITION BY asin, marketplace ORDER BY data_date DESC
    ) as latest_avg_sales,
    FIRST_VALUE(daily_sales_amount) OVER (  
        PARTITION BY asin, marketplace ORDER BY data_date DESC
    ) as latest_daily_revenue,
    
    -- 时间范围聚合
    AVG(total_inventory) as avg_total_inventory,
    AVG(fba_available) as avg_fba_available,
    AVG(average_sales) as avg_avg_sales,
    AVG(daily_sales_amount) as avg_daily_revenue,
    AVG(ad_impressions) as avg_ad_impressions,
    AVG(ad_clicks) as avg_ad_clicks,
    AVG(ad_spend) as avg_ad_spend,
    
    -- 趋势计算
    GREATEST(
        (MAX(daily_sales_amount) - MIN(daily_sales_amount)) / 
        NULLIF( MIN(daily_sales_amount) , 0) * 100,
        0
    ) as revenue_trend_pct,
    
    -- JSON结构输出
    COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', data_date,
            'inventory', total_inventory,
            'sales', average_sales,
            'revenue', daily_sales_amount
        )
    ), '[{}]') as history_data
    
FROM inventory_points 
WHERE data_date BETWEEN ? AND ?
  AND asin = ? 
  AND marketplace = ?
GROUP BY asin, marketplace;

-- 5. 快速查询示例 (用于getLatestAnalysis)
SELECT 
    asin,
    product_name,
    marketplace,
    total_inventory,
    fba_available,
    average_sales,
    daily_sales_amount,
    turnover_days,
    CASE 
        WHEN total_inventory <= 0 THEN '断货'
        WHEN turnover_days <= 45 THEN '库存不足'
        WHEN turnover_days >= 90 THEN '周转超标'
        ELSE '库存健康'
    END as inventory_status,
    ad_impressions,
    ad_clicks,
    ad_spend,
    ad_order_count,
    CASE 
        WHEN ad_impressions > 0 THEN (ad_clicks::float / ad_impressions) * 100
        ELSE 0
    END as ctr_pct,
    CASE 
        WHEN ad_clicks > 0 THEN (ad_order_count::float / ad_clicks) * 100
        ELSE 0
    END as cvr_pct,
    data_date
FROM inventory_points 
WHERE asin = ? 
  AND marketplace = ?
  AND data_date = (
      SELECT MAX(data_date) 
      FROM inventory_points 
      WHERE asin = ? AND marketplace = ?
  )
LIMIT 1;

-- 6. 历史数据查询 (用于getAnalysisHistory)
SELECT 
    asin,
    data_date,
    total_inventory,
    daily_sales_amount,
    average_sales,
    JSON_BUILD_OBJECT(
        'date', data_date::text,
        'inventory', total_inventory,
        'revenue', daily_sales_amount,
        'sales', average_sales
    ) as formatted_data
FROM inventory_points 
WHERE asin = ? 
  AND marketplace = ?
  AND data_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY data_date DESC
LIMIT ?;

-- 7. 聚合视图优化
CREATE OR REPLACE FUNCTION get_inventory_aggregated(
    p_asin VARCHAR,
    p_marketplace VARCHAR,
    p_days INTEGER DEFAULT 7,
    p_method VARCHAR DEFAULT 'average'
)
RETURNS TABLE(
    total_inventory NUMERIC,
    fba_available NUMERIC,
    avg_sales NUMERIC,
    daily_revenue NUMERIC,
    avg_ad_impressions NUMERIC,
    avg_ad_clicks NUMERIC,
    avg_ad_spend NUMERIC,
    total_data_points INTEGER,
    start_date DATE,
    end_date DATE,
    trend_pct NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE p_method 
            WHEN 'latest' THEN 
                FIRST_VALUE(total_inventory) OVER (ORDER BY data_date DESC)::NUMERIC
            WHEN 'sum' THEN 
                SUM(total_inventory)::NUMERIC
            WHEN 'average' THEN 
                AVG(total_inventory)::NUMERIC
            ELSE AVG(total_inventory)::NUMERIC
        END,
        CASE p_method 
            WHEN 'latest' THEN 
                FIRST_VALUE(fba_available) OVER (ORDER BY data_date DESC)::NUMERIC
            WHEN 'sum' THEN 
                SUM(fba_available)::NUMERIC  
            WHEN 'average' THEN 
                AVG(fba_available)::NUMERIC
            ELSE AVG(fba_available)::NUMERIC
        END,
        CASE p_method 
            WHEN 'latest' THEN 
                FIRST_VALUE(average_sales) OVER (ORDER BY data_date DESC)::NUMERIC
            WHEN 'sum' THEN 
                SUM(average_sales)::NUMERIC
            WHEN 'average' THEN 
                AVG(average_sales)::NUMERIC
            ELSE AVG(average_sales)::NUMERIC
        END,
        CASE p_method 
            WHEN 'latest' THEN 
                FIRST_VALUE(daily_sales_amount) OVER (ORDER BY data_date DESC)::NUMERIC
            WHEN 'sum' THEN 
                SUM(daily_sales_amount)::NUMERIC
            WHEN 'average' THEN 
                AVG(daily_sales_amount)::NUMERIC
            ELSE AVG(daily_sales_amount)::NUMERIC
        END,
        AVG(ad_impressions)::NUMERIC,
        AVG(ad_clicks)::NUMERIC,
        AVG(ad_spend)::NUMERIC,
        COUNT(*)::INTEGER,
        MIN(data_date),
        MAX(data_date),
        CASE 
            WHEN COUNT(*) > 1 THEN
                (LAST_VALUE(daily_sales_amount) OVER (ORDER BY data_date) - 
                 FIRST_VALUE(daily_sales_amount) OVER (ORDER BY data_date)) / 
                NULLIF(FIRST_VALUE(daily_sales_amount) OVER (ORDER BY data_date), 0) * 100
            ELSE 0
        END
    FROM inventory_points 
    WHERE asin = p_asin 
      AND marketplace = p_marketplace
      AND data_date >= CURRENT_DATE - INTERVAL '1 day' * p_days
    GROUP BY asin, marketplace;
END;
$$ LANGUAGE plpgsql;

-- 8. 数据质量验证查询
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT asin) as unique_asins,
    COUNT(DISTINCT marketplace) as unique_marketplaces,
    MIN(data_date) as earliest_date,
    MAX(data_date) as latest_date,
    AVG(total_inventory) as avg_total_inventory,
    COUNT(CASE WHEN total_inventory < 0 THEN 1 END) as negative_inventory_count,
    COUNT(CASE WHEN data_date IS NULL THEN 1 END) as null_date_count
FROM inventory_points;

-- 9. 分页查询 (用于API分页)
SELECT 
    COUNT(*) OVER() as total_count,
    ip.*,
    pa.sales_amount as product_sales,
    pa.impressions as product_impressions,
    pa.clicks as product_clicks
FROM inventory_points ip
LEFT JOIN product_analytics pa 
  ON ip.asin = pa.asin 
  AND ip.marketplace = pa.marketplace 
  AND ip.data_date = pa.data_date
WHERE (
    CASE 
        WHEN ?::VARCHAR IS NOT NULL THEN ip.asin = ?::VARCHAR
        ELSE TRUE
    END
)
AND (
    CASE 
        WHEN ?::VARCHAR IS NOT NULL THEN ip.marketplace = ?::VARCHAR
        ELSE TRUE
    END
)
AND (
    CASE 
        WHEN ?::DATE IS NOT NULL THEN ip.data_date >= ?::DATE
        ELSE TRUE
    END
)
AND (
    CASE 
        WHEN ?::DATE IS NOT NULL THEN ip.data_date <= ?::DATE
        ELSE TRUE
    END
)
ORDER BY ip.data_date DESC, ip.id ASC
LIMIT ?::INT OFFSET (?::INT - 1) * ?::INT;