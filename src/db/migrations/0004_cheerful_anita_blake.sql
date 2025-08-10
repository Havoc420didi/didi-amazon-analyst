CREATE TABLE "rpa_analysis_results" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rpa_analysis_results_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"timestamp" varchar(255) NOT NULL,
	"totalProducts" integer DEFAULT 0 NOT NULL,
	"highPotentialProducts" integer DEFAULT 0 NOT NULL,
	"aLevelProducts" text DEFAULT '[]' NOT NULL,
	"marketTrends" text DEFAULT '{}' NOT NULL,
	"processingTime" numeric(10, 2) DEFAULT '0' NOT NULL,
	"dataQualityScore" numeric(3, 2) DEFAULT '0' NOT NULL,
	"syncTimestamp" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rpa_configurations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rpa_configurations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"version" varchar(50) DEFAULT '1.0.0' NOT NULL,
	"configuration" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rpa_system_status" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rpa_system_status_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"status" varchar(50) NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"timestamp" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_analysis_tasks" ADD COLUMN "batch_id" varchar(50);--> statement-breakpoint
CREATE INDEX "idx_rpa_analysis_timestamp" ON "rpa_analysis_results" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_rpa_analysis_created_at" ON "rpa_analysis_results" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_rpa_config_active" ON "rpa_configurations" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_rpa_config_version" ON "rpa_configurations" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_rpa_status_created_at" ON "rpa_system_status" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_rpa_status_status" ON "rpa_system_status" USING btree ("status");