CREATE TYPE "public"."category" AS ENUM('daily_soup', 'daily_main', 'featured', 'all_week', 'dessert', 'pickle', 'side', 'side_extra');--> statement-breakpoint
CREATE TYPE "public"."fulfilment" AS ENUM('delivery', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('received', 'processed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."slot" AS ENUM('soup', 'main', 'side', 'pickle', 'dessert');--> statement-breakpoint
CREATE TABLE "closed_dates" (
	"date" date PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_key" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"last_order_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_key_unique" UNIQUE("email_key")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "category" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_weekday" integer NOT NULL,
	"price_weekend" integer,
	"variations" text[] NOT NULL,
	"allergens" text[] NOT NULL,
	"soup_included" boolean NOT NULL,
	"requires_side" boolean NOT NULL,
	"sold_out" boolean NOT NULL,
	"active" boolean NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iso_year" integer NOT NULL,
	"iso_week" smallint NOT NULL,
	"day" smallint,
	"menu_item_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "menu_schedule_week_day_item_unique" UNIQUE NULLS NOT DISTINCT("iso_year","iso_week","day","menu_item_id")
);
--> statement-breakpoint
CREATE TABLE "menu_weeks" (
	"iso_year" integer NOT NULL,
	"iso_week" smallint NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "menu_weeks_iso_year_iso_week_pk" PRIMARY KEY("iso_year","iso_week")
);
--> statement-breakpoint
CREATE TABLE "order_extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"extra_key" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_menu_id" uuid NOT NULL,
	"slot" "slot" NOT NULL,
	"menu_item_id" uuid,
	"name" text NOT NULL,
	"variation" text,
	"unit_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"delivery_date" date NOT NULL,
	"fulfilment" "fulfilment" NOT NULL,
	"status" "order_status" NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"address" text NOT NULL,
	"note" text,
	"food_subtotal" integer NOT NULL,
	"delivery_fee" integer NOT NULL,
	"total" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "menu_schedule" ADD CONSTRAINT "menu_schedule_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_schedule" ADD CONSTRAINT "menu_schedule_week_fk" FOREIGN KEY ("iso_year","iso_week") REFERENCES "public"."menu_weeks"("iso_year","iso_week") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_extras" ADD CONSTRAINT "order_extras_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_menu_id_order_menus_id_fk" FOREIGN KEY ("order_menu_id") REFERENCES "public"."order_menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_menus" ADD CONSTRAINT "order_menus_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_schedule_menu_item_id_idx" ON "menu_schedule" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "order_extras_order_id_idx" ON "order_extras" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_menu_id_idx" ON "order_items" USING btree ("order_menu_id");--> statement-breakpoint
CREATE INDEX "order_items_menu_item_id_idx" ON "order_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "order_menus_order_id_idx" ON "order_menus" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_delivery_date_idx" ON "orders" USING btree ("delivery_date");--> statement-breakpoint
CREATE INDEX "orders_status_delivery_date_idx" ON "orders" USING btree ("status","delivery_date");--> statement-breakpoint
CREATE INDEX "orders_submission_id_idx" ON "orders" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");