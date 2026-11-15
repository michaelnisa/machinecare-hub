-- ============================================================================
-- Migration: Add 'gps_tracking' to industry_profile enum (Optional / Standalone)
-- Run this as a single statement in the Supabase SQL editor if you wish to
-- register 'gps_tracking' directly into PostgreSQL's public.industry_profile enum.
-- ============================================================================

ALTER TYPE public.industry_profile ADD VALUE IF NOT EXISTS 'gps_tracking';
