CREATE TABLE "ab_test_variants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ab_test_id" varchar NOT NULL,
	"page_id" varchar NOT NULL,
	"name" text NOT NULL,
	"traffic_percentage" integer DEFAULT 50 NOT NULL,
	"utm_source_match" text,
	"is_control" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ab_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"original_page_id" varchar NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"traffic_split_type" text DEFAULT 'random' NOT NULL,
	"goal_type" text DEFAULT 'form_submission' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar,
	"page_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"block_id" text,
	"visitor_id" text NOT NULL,
	"session_id" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"referrer" text,
	"user_agent" text,
	"ip_address" text,
	"ab_test_id" varchar,
	"variant_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" varchar,
	"attempted_store_id" varchar,
	"shop" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"details" jsonb NOT NULL,
	"ip" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar,
	"twilio_call_sid" text NOT NULL,
	"tracking_number_id" varchar,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"gclid" text,
	"call_status" text,
	"call_duration" integer,
	"shopify_customer_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "call_logs_twilio_call_sid_unique" UNIQUE("twilio_call_sid")
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar,
	"page_id" varchar NOT NULL,
	"block_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"utm_params" jsonb DEFAULT '{}'::jsonb,
	"landing_page" text,
	"referrer" text,
	"shopify_customer_id" varchar,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pixel_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb,
	"pixel_settings" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"allow_indexing" boolean DEFAULT true NOT NULL,
	"shopify_page_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopify_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar NOT NULL,
	"shopify_product_id" text NOT NULL,
	"handle" text NOT NULL,
	"title" text NOT NULL,
	"vendor" text,
	"product_type" text,
	"status" text DEFAULT 'active',
	"tags" text[],
	"featured_image_url" text,
	"price" text,
	"compare_at_price" text,
	"description" text,
	"product_data" jsonb NOT NULL,
	"shopify_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopify_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"state" text,
	"is_online" boolean DEFAULT false NOT NULL,
	"scope" text,
	"access_token" text,
	"expires" timestamp,
	"online_access_info" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_sync_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"products_added" integer DEFAULT 0,
	"products_updated" integer DEFAULT 0,
	"products_removed" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"shopify_domain" text NOT NULL,
	"custom_domain" text,
	"shopify_access_token" text,
	"storefront_access_token" text,
	"shopify_scopes" text,
	"install_state" text DEFAULT 'pending' NOT NULL,
	"installed_at" timestamp,
	"uninstalled_at" timestamp,
	"sync_schedule" text DEFAULT 'daily' NOT NULL,
	"last_sync_at" timestamp,
	"twilio_account_sid" text,
	"twilio_auth_token" text,
	"twilio_forward_to" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stores_shopify_domain_unique" UNIQUE("shopify_domain")
);
--> statement-breakpoint
CREATE TABLE "tracking_numbers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar,
	"phone_number" text NOT NULL,
	"gclid" text,
	"session_id" text,
	"visitor_id" text,
	"assigned_at" timestamp,
	"expires_at" timestamp,
	"is_available" boolean DEFAULT true NOT NULL,
	"forward_to" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_product_favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_store_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"store_id" varchar NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_ab_test_id_ab_tests_id_fk" FOREIGN KEY ("ab_test_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_original_page_id_pages_id_fk" FOREIGN KEY ("original_page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_tracking_number_id_tracking_numbers_id_fk" FOREIGN KEY ("tracking_number_id") REFERENCES "public"."tracking_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_products" ADD CONSTRAINT "shopify_products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sync_logs" ADD CONSTRAINT "store_sync_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_numbers" ADD CONSTRAINT "tracking_numbers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_favorites" ADD CONSTRAINT "user_product_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_favorites" ADD CONSTRAINT "user_product_favorites_product_id_shopify_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shopify_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_store_assignments" ADD CONSTRAINT "user_store_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_store_assignments" ADD CONSTRAINT "user_store_assignments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_page_id_idx" ON "analytics_events" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "analytics_events_store_id_idx" ON "analytics_events" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "page_versions_unique_idx" ON "page_versions" USING btree ("page_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_store_idx" ON "pages" USING btree ("slug","store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shopify_products_store_product_idx" ON "shopify_products" USING btree ("store_id","shopify_product_id");--> statement-breakpoint
CREATE INDEX "shopify_products_title_idx" ON "shopify_products" USING btree ("store_id","title");--> statement-breakpoint
CREATE INDEX "shopify_products_handle_idx" ON "shopify_products" USING btree ("store_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_numbers_phone_store_idx" ON "tracking_numbers" USING btree ("phone_number","store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_product_favorites_unique_idx" ON "user_product_favorites" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_store_unique_idx" ON "user_store_assignments" USING btree ("user_id","store_id");