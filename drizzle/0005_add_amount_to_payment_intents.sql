-- Add amount column to paymentIntents table
-- This column stores the actual charge amount in cents
ALTER TABLE `paymentIntents`
  ADD COLUMN `amount` int NOT NULL DEFAULT 0 AFTER `pagarmeIntentId`;
