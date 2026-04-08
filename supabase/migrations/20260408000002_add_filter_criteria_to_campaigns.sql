-- VBS-148: Store filter criteria JSON for campaign recipient selection
ALTER TABLE campaigns ADD COLUMN filter_criteria jsonb;
