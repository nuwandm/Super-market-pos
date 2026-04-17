-- Supermarket POS — Initial Schema Migration
-- Version: 0000_initial

CREATE TABLE IF NOT EXISTS `supermarkets` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`currency` text DEFAULT 'LKR' NOT NULL,
	`timezone` text DEFAULT 'Asia/Colombo' NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`vat_number` text,
	`receipt_header` text,
	`receipt_footer` text,
	`receipt_language` text DEFAULT 'en' NOT NULL,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `branches` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`supermarket_id` text NOT NULL,
	`name` text NOT NULL,
	`branch_code` text NOT NULL,
	`phone` text,
	`address` text,
	`tax_rate` real,
	`receipt_header` text,
	`receipt_footer` text,
	`is_active` integer DEFAULT true NOT NULL,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`staff_code` text NOT NULL,
	`role` text NOT NULL,
	`pin_hash` text NOT NULL,
	`pin_salt` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `staff_code_idx` ON `staff` (`staff_code`);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `categories` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `units` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`abbreviation` text NOT NULL,
	`is_decimal` integer DEFAULT false NOT NULL,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `products` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`branch_id` text NOT NULL,
	`category_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`name` text NOT NULL,
	`name_sinhala` text,
	`name_tamil` text,
	`sku` text NOT NULL,
	`barcode` text,
	`cost_price` real DEFAULT 0 NOT NULL,
	`selling_price` real NOT NULL,
	`wholesale_price` real,
	`tax_rate` real,
	`tax_type` text DEFAULT 'vat' NOT NULL,
	`reorder_level` real DEFAULT 0 NOT NULL,
	`reorder_qty` real DEFAULT 0 NOT NULL,
	`has_expiry` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`image_url` text,
	`description` text,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `product_barcodes` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`product_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`barcode` text NOT NULL,
	`pack_qty` real DEFAULT 1 NOT NULL,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `inventory` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`branch_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty_on_hand` real DEFAULT 0 NOT NULL,
	`qty_reserved` real DEFAULT 0 NOT NULL,
	`last_counted_at` integer,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `inventory_product_branch_idx` ON `inventory` (`product_id`, `branch_id`);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `stock_movements` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`branch_id` text NOT NULL,
	`product_id` text NOT NULL,
	`type` text NOT NULL,
	`reference_id` text,
	`reference_type` text,
	`qty_before` real NOT NULL,
	`qty_change` real NOT NULL,
	`qty_after` real NOT NULL,
	`unit_cost` real,
	`staff_id` text NOT NULL,
	`note` text,
	`batch_number` text,
	`expiry_date` integer,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `sales` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`branch_id` text NOT NULL,
	`receipt_number` text NOT NULL,
	`staff_id` text NOT NULL,
	`customer_id` text,
	`subtotal` real NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`discount_type` text,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`note` text,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `sale_items` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`sale_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`barcode` text,
	`qty` real NOT NULL,
	`unit_price` real NOT NULL,
	`cost_price` real NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `sale_payments` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`sale_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`method` text NOT NULL,
	`amount` real NOT NULL,
	`reference` text,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `cash_sessions` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`branch_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`opening_float` real NOT NULL,
	`closing_cash` real,
	`expected_cash` real,
	`cash_variance` real,
	`status` text DEFAULT 'open' NOT NULL,
	`note` text,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `customers` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`address` text,
	`loyalty_points` real DEFAULT 0 NOT NULL,
	`credit_balance` real DEFAULT 0 NOT NULL,
	`total_purchases` real DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sync_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`device_id` text,
	`synced_at` integer,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS `sync_queue` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`device_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`synced_at` integer,
	`status` text DEFAULT 'pending' NOT NULL
);
