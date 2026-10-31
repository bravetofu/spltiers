ALTER TABLE rating_pending_battles ADD COLUMN source text NOT NULL DEFAULT 'public-queue';
CREATE INDEX rating_battles_queue_lookup ON rating_battles USING gin (queue_ids);
