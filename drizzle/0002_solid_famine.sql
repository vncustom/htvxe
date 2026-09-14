ALTER TABLE "bookings" ADD COLUMN "vehicle_group_yeu_cau" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "vehicle_group" text DEFAULT '5' NOT NULL;--> statement-breakpoint
UPDATE "vehicles" SET "vehicle_group" = CASE
	WHEN "seats" <= 4 THEN '4'
	WHEN "seats" = 5 THEN '5'
	WHEN "seats" <= 7 THEN '7'
	ELSE '16'
END;