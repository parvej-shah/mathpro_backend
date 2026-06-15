-- Migration: remove legacy discussion feature tables.

DROP TABLE IF EXISTS sub_discussion CASCADE;
DROP TABLE IF EXISTS discussion CASCADE;
