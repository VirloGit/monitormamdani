-- Add URL field to notable_alerts table to store article/source links
ALTER TABLE notable_alerts ADD COLUMN url TEXT;

-- Add source field to track which news/video item inspired the alert
ALTER TABLE notable_alerts ADD COLUMN source TEXT;
