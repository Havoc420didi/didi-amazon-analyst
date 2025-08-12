CREATE TABLE "inventory_deals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_deals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"snapshot_date" date NOT NULL,
	"asin" varchar(20) NOT NULL,
	"product_name" varchar(500) NOT NULL,
	"sales_person" varchar(100) NOT NULL,
	"warehouse_location" varchar(50) NOT NULL,
	"time_window" varchar(10) NOT NULL,
	"time_window_days" integer NOT NULL,
	"window_start_date" date NOT NULL,
	"window_end_date" date NOT NULL,
	"fba_available" integer DEFAULT 0 NOT NULL,
	"fba_in_transit" integer DEFAULT 0 NOT NULL,
	"local_warehouse" integer DEFAULT 0 NOT NULL,
	"total_inventory" integer DEFAULT 0 NOT NULL,
	"total_sales_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_sales_quantity" integer DEFAULT 0 NOT NULL,
	"avg_daily_sales" numeric(10, 2) DEFAULT '0' NOT NULL,
	"avg_daily_revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_ad_impressions" bigint DEFAULT 0 NOT NULL,
	"total_ad_clicks" integer DEFAULT 0 NOT NULL,
	"total_ad_spend" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_ad_orders" integer DEFAULT 0 NOT NULL,
	"ad_ctr" numeric(8, 6) DEFAULT '0' NOT NULL,
	"ad_conversion_rate" numeric(8, 6) DEFAULT '0' NOT NULL,
	"acos" numeric(8, 6) DEFAULT '0' NOT NULL,
	"inventory_turnover_days" numeric(10, 2) DEFAULT '0' NOT NULL,
	"inventory_status" varchar(20) DEFAULT '正常' NOT NULL,
	"source_records_count" integer DEFAULT 0 NOT NULL,
	"calculation_method" varchar(50) DEFAULT 'sum_aggregate' NOT NULL,
	"data_completeness_score" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"batch_id" varchar(50),
	"processing_duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_inventory_deals_main" ON "inventory_deals" USING btree ("snapshot_date","asin","warehouse_location","time_window");--> statement-breakpoint
CREATE INDEX "idx_inventory_deals_time_range" ON "inventory_deals" USING btree ("snapshot_date","time_window");--> statement-breakpoint
CREATE INDEX "idx_inventory_deals_sales_person" ON "inventory_deals" USING btree ("sales_person","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_deals_asin" ON "inventory_deals" USING btree ("asin","warehouse_location","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_deals_inventory_status" ON "inventory_deals" USING btree ("inventory_status","total_inventory","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_deals_batch" ON "inventory_deals" USING btree ("batch_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_inventory_deal_snapshot" ON "inventory_deals" USING btree ("asin","warehouse_location","snapshot_date","time_window");