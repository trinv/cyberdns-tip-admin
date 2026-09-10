CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"role" varchar(50) DEFAULT 'Admin' NOT NULL,
	"action" varchar(50) NOT NULL,
	"target_count" integer DEFAULT 1 NOT NULL,
	"summary" text NOT NULL,
	"reason" text NOT NULL,
	"can_rollback" boolean DEFAULT false NOT NULL,
	"rollback_expires_at" timestamp,
	"rollback_data" jsonb,
	"details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocklist_acl_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"enforce_enabled" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocklist_unknown_requesters" (
	"ip_address" varchar(64) PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"last_category" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"count" integer DEFAULT 0 NOT NULL,
	"color" varchar(20) DEFAULT '#10B981' NOT NULL,
	"border_color" varchar(50) DEFAULT 'border-emerald-500/30' NOT NULL,
	"badge_bg" varchar(50) DEFAULT 'bg-emerald-500/10' NOT NULL,
	"badge_text" varchar(50) DEFAULT 'text-emerald-500' NOT NULL,
	"delta_threshold" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dns_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hostname" text,
	"ip_address" varchar(64),
	"ipv6_address" varchar(64),
	"tier" varchar(20) DEFAULT 'LITE' NOT NULL,
	"location" text,
	"latitude" double precision,
	"longitude" double precision,
	"provider" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dns_nodes_ip_address_unique" UNIQUE("ip_address"),
	CONSTRAINT "dns_nodes_ipv6_address_unique" UNIQUE("ipv6_address")
);
--> statement-breakpoint
CREATE TABLE "domain_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain_id" integer NOT NULL,
	"category_id" varchar(100) NOT NULL,
	"feed_source_id" varchar(100),
	"source_label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"etld1" text NOT NULL,
	"tld" varchar(50) NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"primary_category" varchar(100),
	"source" text NOT NULL,
	"source_detail" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"unblocked_by_source_pause" boolean DEFAULT false NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"is_protected" boolean DEFAULT false NOT NULL,
	"timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "feed_sources" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"domain_count" integer DEFAULT 0 NOT NULL,
	"last_sync" timestamp,
	"sync_interval" varchar(50) DEFAULT '1 giờ' NOT NULL,
	"status" varchar(50) DEFAULT 'idle' NOT NULL,
	"sync_progress" integer DEFAULT 0 NOT NULL,
	"sync_phase" text,
	"is_paused" boolean DEFAULT false NOT NULL,
	"color" varchar(20) DEFAULT '#10B981' NOT NULL,
	"removed_today" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"last_sync_message" text,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"email" text NOT NULL,
	"ip_address" varchar(64) NOT NULL,
	"user_agent" text,
	"success" boolean NOT NULL,
	"is_new_ip" boolean DEFAULT false NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"proposed_category" varchar(100) NOT NULL,
	"threat_score" double precision DEFAULT 0.5 NOT NULL,
	"query_count_24h" integer DEFAULT 0 NOT NULL,
	"reported_by" text NOT NULL,
	"feed_source_id" varchar(100),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"screenshot_url" text,
	"evidence_notes" text DEFAULT '' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_filters" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"category" varchar(100),
	"status" varchar(50),
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"role" varchar(50) DEFAULT 'Analyst' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "domain_categories" ADD CONSTRAINT "domain_categories_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_categories" ADD CONSTRAINT "domain_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_categories" ADD CONSTRAINT "domain_categories_feed_source_id_feed_sources_id_fk" FOREIGN KEY ("feed_source_id") REFERENCES "public"."feed_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_feed_source_id_feed_sources_id_fk" FOREIGN KEY ("feed_source_id") REFERENCES "public"."feed_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "blocklist_unknown_requesters_last_seen_idx" ON "blocklist_unknown_requesters" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "domain_categories_category_idx" ON "domain_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "domain_categories_feed_source_idx" ON "domain_categories" USING btree ("feed_source_id");--> statement-breakpoint
CREATE INDEX "domains_status_idx" ON "domains" USING btree ("status");--> statement-breakpoint
CREATE INDEX "domains_tld_idx" ON "domains" USING btree ("tld");--> statement-breakpoint
CREATE INDEX "domains_last_seen_idx" ON "domains" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "login_logs_user_idx" ON "login_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_logs_created_at_idx" ON "login_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "review_status_idx" ON "review_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");