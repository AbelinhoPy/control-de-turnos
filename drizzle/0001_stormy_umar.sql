ALTER TABLE "organizations" ALTER COLUMN "workplace_name" SET DEFAULT 'Sede Operativa - Minga Guazú';--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "workplace_lat" SET DEFAULT -25.496469;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "workplace_lng" SET DEFAULT -54.789641;--> statement-breakpoint
ALTER TABLE "period_closures" ADD COLUMN "details_snapshot" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "attendances_org_user_date_idx" ON "attendances" USING btree ("organization_id","user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendances_idempotency_idx" ON "attendances" USING btree ("idempotency_token");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_org_user_date_idx" ON "shifts" USING btree ("organization_id","user_id","date");