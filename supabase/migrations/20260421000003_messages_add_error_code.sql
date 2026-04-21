-- VBS-205: persist Meta error code alongside error_message on failed messages.
ALTER TABLE messages ADD COLUMN error_code integer;
