-- The "saved filters" feature was never finished: no API ever read or wrote
-- this table, so it is provably empty on every deployment. Dropping it with
-- the frontend scaffolding (see the P3 dead-code commit). IF EXISTS keeps the
-- migration safe to re-run / apply to a DB where 0000 hasn't run yet.
DROP TABLE IF EXISTS "saved_filters" CASCADE;
