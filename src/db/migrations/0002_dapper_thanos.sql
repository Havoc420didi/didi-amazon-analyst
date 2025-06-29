CREATE TABLE "ai_analysis_tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_analysis_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_number" varchar(20) NOT NULL,
	"asin" varchar(50) NOT NULL,
	"warehouse_location" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"executor" varchar(100) NOT NULL,
	"product_data" text NOT NULL,
	"analysis_content" text,
	"ai_model" varchar(50) DEFAULT 'deepseek-chat',
	"processing_time" integer,
	"tokens_used" integer,
	"rating" integer,
	"rating_feedback" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_analysis_tasks_task_number_unique" UNIQUE("task_number")
);
--> statement-breakpoint
CREATE INDEX "idx_ai_analysis_asin_warehouse" ON "ai_analysis_tasks" USING btree ("asin","warehouse_location");--> statement-breakpoint
CREATE INDEX "idx_ai_analysis_status" ON "ai_analysis_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_analysis_created_at" ON "ai_analysis_tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_analysis_executor" ON "ai_analysis_tasks" USING btree ("executor");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_task_number" ON "ai_analysis_tasks" USING btree ("task_number");