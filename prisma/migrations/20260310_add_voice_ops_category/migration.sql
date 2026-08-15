-- Add voice to OpsEventCategory for voice follow-up logging
ALTER TYPE "OpsEventCategory" ADD VALUE IF NOT EXISTS 'voice';
