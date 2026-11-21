CREATE TABLE "attendance_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"attendance_id" text,
	"date" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"resolution_notes" text,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendances" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"shift_id" text,
	"date" text NOT NULL,
	"clock_in_time" timestamp with time zone,
	"clock_in_lat" double precision,
	"clock_in_lng" double precision,
	"clock_in_accuracy" double precision,
	"clock_in_distance_meters" double precision,
	"clock_in_status" text DEFAULT 'VALID',
	"clock_out_time" timestamp with time zone,
	"clock_out_lat" double precision,
	"clock_out_lng" double precision,
	"clock_out_accuracy" double precision,
	"clock_out_distance_meters" double precision,
	"clock_out_status" text,
	"worked_days" numeric DEFAULT '0' NOT NULL,
	"day_hours" numeric DEFAULT '0' NOT NULL,
	"night_hours" numeric DEFAULT '0' NOT NULL,
	"total_hours" numeric DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'EN_CURSO' NOT NULL,
	"is_manual_correction" boolean DEFAULT false NOT NULL,
	"correction_reason" text,
	"corrected_by_user_id" text,
	"corrected_at" timestamp with time zone,
	"idempotency_token" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crews" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"type" text DEFAULT 'FIXED' NOT NULL,
	"description" text,
	"color" text DEFAULT 'Azul Real' NOT NULL,
	"badge_color_class" text DEFAULT 'bg-blue-100 text-blue-800 border-blue-300' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'FUNCIONARIO' NOT NULL,
	"crew_id" text,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"invited_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"night_hour_start" text DEFAULT '20:00' NOT NULL,
	"night_hour_end" text DEFAULT '06:00' NOT NULL,
	"night_surcharge_percent" integer DEFAULT 30 NOT NULL,
	"workplace_name" text DEFAULT 'Sede Central - Asunción' NOT NULL,
	"workplace_lat" double precision DEFAULT -25.2867 NOT NULL,
	"workplace_lng" double precision DEFAULT -57.647 NOT NULL,
	"geofence_radius_meters" integer DEFAULT 300 NOT NULL,
	"half_day_rule_confirmed" boolean DEFAULT false NOT NULL,
	"hourly_rate_rule_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "period_closures" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'BORRADOR' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" text,
	"night_hour_start" text DEFAULT '20:00' NOT NULL,
	"night_hour_end" text DEFAULT '06:00' NOT NULL,
	"night_surcharge_percent" integer DEFAULT 30 NOT NULL,
	"rules_snapshot" jsonb,
	"summary_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"duration_hours" numeric DEFAULT '8' NOT NULL,
	"crosses_midnight" boolean DEFAULT false NOT NULL,
	"target_headcount" integer DEFAULT 2 NOT NULL,
	"color_class" text DEFAULT 'bg-blue-50 text-blue-700 border-blue-200' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"crew_id" text,
	"shift_template_id" text NOT NULL,
	"date" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_user_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'FUNCIONARIO' NOT NULL,
	"crew_id" text,
	"document_number" text,
	"phone" text,
	"base_daily_wage" integer DEFAULT 100000,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_incidents" ADD CONSTRAINT "attendance_incidents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_incidents" ADD CONSTRAINT "attendance_incidents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_incidents" ADD CONSTRAINT "attendance_incidents_attendance_id_attendances_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_incidents" ADD CONSTRAINT "attendance_incidents_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_closures" ADD CONSTRAINT "period_closures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_closures" ADD CONSTRAINT "period_closures_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_shift_template_id_shift_templates_id_fk" FOREIGN KEY ("shift_template_id") REFERENCES "public"."shift_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE set null ON UPDATE no action;