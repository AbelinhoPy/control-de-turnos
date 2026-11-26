ALTER TABLE "attendances" ADD COLUMN "clock_in_photo" text;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "clock_out_photo" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "require_photo_on_clock" boolean DEFAULT true NOT NULL;