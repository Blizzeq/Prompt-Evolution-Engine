ALTER TABLE `evolution_runs` ADD `user_prompt` text;--> statement-breakpoint
CREATE INDEX `evolution_runs_started_at_idx` ON `evolution_runs` (`started_at`);--> statement-breakpoint
CREATE INDEX `evaluations_prompt_id_idx` ON `evaluations` (`prompt_id`);--> statement-breakpoint
CREATE INDEX `prompts_run_id_idx` ON `prompts` (`run_id`);--> statement-breakpoint
CREATE INDEX `prompts_run_generation_idx` ON `prompts` (`run_id`,`generation`);--> statement-breakpoint
CREATE INDEX `test_cases_run_id_idx` ON `test_cases` (`run_id`);