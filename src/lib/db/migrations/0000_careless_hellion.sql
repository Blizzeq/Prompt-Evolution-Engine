CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_id` text NOT NULL,
	`test_case_id` text NOT NULL,
	`response` text NOT NULL,
	`score` real NOT NULL,
	`judge_reasoning` text NOT NULL,
	`latency_ms` integer NOT NULL,
	`tokens_used` integer NOT NULL,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `evolution_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_description` text NOT NULL,
	`config` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`current_generation` integer DEFAULT 0 NOT NULL,
	`best_fitness` real,
	`best_prompt_id` text,
	`total_api_calls` integer DEFAULT 0 NOT NULL,
	`total_tokens_used` integer DEFAULT 0 NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	`stopped_reason` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`generation` integer NOT NULL,
	`text` text NOT NULL,
	`fitness` real,
	`parent_ids` text DEFAULT '[]' NOT NULL,
	`origin` text NOT NULL,
	`metadata` text,
	FOREIGN KEY (`run_id`) REFERENCES `evolution_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `test_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`input` text NOT NULL,
	`expected_output` text NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `evolution_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
