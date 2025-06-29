CREATE TABLE "inventory_records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asin" varchar(50) NOT NULL,
	"product_name" varchar(500) NOT NULL,
	"sales_person" varchar(100) NOT NULL,
	"warehouse_location" varchar(50) NOT NULL,
	"date" date NOT NULL,
	"fba_available" integer DEFAULT 0 NOT NULL,
	"fba_in_transit" integer DEFAULT 0 NOT NULL,
	"local_warehouse" integer DEFAULT 0 NOT NULL,
	"total_inventory" integer DEFAULT 0 NOT NULL,
	"avg_sales" numeric(10, 2) DEFAULT '0' NOT NULL,
	"daily_revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"inventory_turnover_days" numeric(8, 2),
	"inventory_status" varchar(20),
	"ad_impressions" bigint DEFAULT 0 NOT NULL,
	"ad_clicks" integer DEFAULT 0 NOT NULL,
	"ad_spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"ad_orders" integer DEFAULT 0 NOT NULL,
	"ad_ctr" numeric(10, 8),
	"ad_conversion_rate" numeric(10, 8),
	"acos" numeric(10, 8),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_inventory_filter_latest" ON "inventory_records" USING btree ("warehouse_location","sales_person","asin","date");--> statement-breakpoint
CREATE INDEX "idx_inventory_sales_person" ON "inventory_records" USING btree ("sales_person","date");--> statement-breakpoint
CREATE INDEX "idx_inventory_asin" ON "inventory_records" USING btree ("asin","warehouse_location","date");--> statement-breakpoint
CREATE INDEX "idx_inventory_date_range" ON "inventory_records" USING btree ("date","warehouse_location");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_daily_inventory" ON "inventory_records" USING btree ("asin","warehouse_location","date");