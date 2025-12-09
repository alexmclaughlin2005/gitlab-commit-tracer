CREATE TABLE "analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"reason" text NOT NULL,
	"approach" text NOT NULL,
	"impact" text NOT NULL,
	"alignment" varchar(50) NOT NULL,
	"alignment_notes" text,
	"confidence" numeric(3, 2),
	"provider" varchar(50),
	"model" varchar(100),
	"tokens_used" integer,
	"cost_usd" numeric(10, 6),
	"duration_ms" integer,
	"analyzed_at" timestamp DEFAULT now(),
	CONSTRAINT "analyses_commit_sha_unique" UNIQUE("commit_sha")
);
--> statement-breakpoint
CREATE TABLE "commit_chains" (
	"id" serial PRIMARY KEY NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"merge_request_ids" integer[],
	"issue_ids" integer[],
	"epic_ids" integer[],
	"team_ids" integer[],
	"is_complete" boolean DEFAULT false,
	"api_call_count" integer,
	"duration_ms" integer,
	"warnings" text[],
	"traced_at" timestamp DEFAULT now(),
	CONSTRAINT "commit_chains_commit_sha_unique" UNIQUE("commit_sha")
);
--> statement-breakpoint
CREATE TABLE "commit_merge_requests" (
	"commit_sha" varchar(40) NOT NULL,
	"merge_request_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commits" (
	"sha" varchar(40) PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"short_id" varchar(12),
	"title" text NOT NULL,
	"message" text,
	"author_name" varchar(255),
	"author_email" varchar(255),
	"authored_date" timestamp,
	"committed_date" timestamp,
	"web_url" text,
	"discovered_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "epics" (
	"id" integer PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"iid" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"state" varchar(50),
	"web_url" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" integer PRIMARY KEY NOT NULL,
	"iid" integer NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"epic_id" integer,
	"team_id" integer,
	"title" text NOT NULL,
	"description" text,
	"state" varchar(50),
	"labels" text[],
	"web_url" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "merge_request_issues" (
	"merge_request_id" integer NOT NULL,
	"issue_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merge_requests" (
	"id" integer PRIMARY KEY NOT NULL,
	"iid" integer NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"state" varchar(50),
	"source_branch" varchar(255),
	"target_branch" varchar(255),
	"author_name" varchar(255),
	"author_username" varchar(255),
	"labels" text[],
	"upvotes" integer DEFAULT 0,
	"downvotes" integer DEFAULT 0,
	"user_notes_count" integer DEFAULT 0,
	"merged_at" timestamp,
	"web_url" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"gitlab_url" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"config" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stakeholder_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"analysis_id" integer,
	"technical_update" text NOT NULL,
	"business_update" text NOT NULL,
	"provider" varchar(50),
	"model" varchar(100),
	"tokens_used" integer,
	"cost_usd" numeric(10, 6),
	"duration_ms" integer,
	"generated_at" timestamp DEFAULT now(),
	CONSTRAINT "stakeholder_updates_commit_sha_unique" UNIQUE("commit_sha")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(255),
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_commit_sha_commits_sha_fk" FOREIGN KEY ("commit_sha") REFERENCES "public"."commits"("sha") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_chains" ADD CONSTRAINT "commit_chains_commit_sha_commits_sha_fk" FOREIGN KEY ("commit_sha") REFERENCES "public"."commits"("sha") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_chains" ADD CONSTRAINT "commit_chains_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_merge_requests" ADD CONSTRAINT "commit_merge_requests_commit_sha_commits_sha_fk" FOREIGN KEY ("commit_sha") REFERENCES "public"."commits"("sha") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_merge_requests" ADD CONSTRAINT "commit_merge_requests_merge_request_id_merge_requests_id_fk" FOREIGN KEY ("merge_request_id") REFERENCES "public"."merge_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commits" ADD CONSTRAINT "commits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_epic_id_epics_id_fk" FOREIGN KEY ("epic_id") REFERENCES "public"."epics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_request_issues" ADD CONSTRAINT "merge_request_issues_merge_request_id_merge_requests_id_fk" FOREIGN KEY ("merge_request_id") REFERENCES "public"."merge_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_request_issues" ADD CONSTRAINT "merge_request_issues_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_updates" ADD CONSTRAINT "stakeholder_updates_commit_sha_commits_sha_fk" FOREIGN KEY ("commit_sha") REFERENCES "public"."commits"("sha") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_updates" ADD CONSTRAINT "stakeholder_updates_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analyses_commit" ON "analyses" USING btree ("commit_sha");--> statement-breakpoint
CREATE INDEX "idx_analyses_alignment" ON "analyses" USING btree ("alignment");--> statement-breakpoint
CREATE INDEX "idx_analyses_confidence" ON "analyses" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "idx_analyses_analyzed" ON "analyses" USING btree ("analyzed_at");--> statement-breakpoint
CREATE INDEX "idx_chains_commit" ON "commit_chains" USING btree ("commit_sha");--> statement-breakpoint
CREATE INDEX "idx_chains_project" ON "commit_chains" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_chains_traced" ON "commit_chains" USING btree ("traced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pk_commit_merge_requests" ON "commit_merge_requests" USING btree ("commit_sha","merge_request_id");--> statement-breakpoint
CREATE INDEX "idx_commits_project" ON "commits" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_commits_authored" ON "commits" USING btree ("authored_date");--> statement-breakpoint
CREATE INDEX "idx_commits_discovered" ON "commits" USING btree ("discovered_at");--> statement-breakpoint
CREATE INDEX "idx_commits_author" ON "commits" USING btree ("author_email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_epics_group_iid" ON "epics" USING btree ("group_id","iid");--> statement-breakpoint
CREATE INDEX "idx_epics_group" ON "epics" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_epics_state" ON "epics" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_issues_project_iid" ON "issues" USING btree ("project_id","iid");--> statement-breakpoint
CREATE INDEX "idx_issues_project" ON "issues" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_issues_epic" ON "issues" USING btree ("epic_id");--> statement-breakpoint
CREATE INDEX "idx_issues_team" ON "issues" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_issues_state" ON "issues" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "pk_merge_request_issues" ON "merge_request_issues" USING btree ("merge_request_id","issue_id");--> statement-breakpoint
CREATE INDEX "idx_mr_issues_mr" ON "merge_request_issues" USING btree ("merge_request_id");--> statement-breakpoint
CREATE INDEX "idx_mr_issues_issue" ON "merge_request_issues" USING btree ("issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mrs_project_iid" ON "merge_requests" USING btree ("project_id","iid");--> statement-breakpoint
CREATE INDEX "idx_mrs_project" ON "merge_requests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_mrs_state" ON "merge_requests" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_mrs_merged_at" ON "merge_requests" USING btree ("merged_at");--> statement-breakpoint
CREATE INDEX "idx_mrs_author" ON "merge_requests" USING btree ("author_username");--> statement-breakpoint
CREATE INDEX "idx_projects_enabled" ON "projects" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_updates_commit" ON "stakeholder_updates" USING btree ("commit_sha");--> statement-breakpoint
CREATE INDEX "idx_updates_generated" ON "stakeholder_updates" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_teams_name" ON "teams" USING btree ("name");