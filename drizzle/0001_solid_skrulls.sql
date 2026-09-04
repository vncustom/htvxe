CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"booking_id" uuid,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "bien_tap_username" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "quay_phim_username" text;--> statement-breakpoint
CREATE INDEX "notif_username_idx" ON "notifications" USING btree ("username","read_at");