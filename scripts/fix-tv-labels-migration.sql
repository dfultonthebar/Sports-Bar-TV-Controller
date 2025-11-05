-- Migration: Fix TV Labels from Cable Box to TV
-- Date: 2025-11-05
-- Issue: MatrixOutput labels were incorrectly set to "Cable Box 1" from old CEC configuration
-- Fix: Update all labels to "TV {channelNumber}"

-- Update all MatrixOutput labels that reference cable boxes
UPDATE MatrixOutput
SET label = 'TV ' || channelNumber
WHERE label LIKE 'Cable Box%';

-- Verify the update
SELECT
    COUNT(*) as total_outputs,
    COUNT(CASE WHEN label LIKE 'TV %' THEN 1 END) as tv_labels,
    COUNT(CASE WHEN label LIKE 'Cable Box%' THEN 1 END) as cable_box_labels
FROM MatrixOutput;
