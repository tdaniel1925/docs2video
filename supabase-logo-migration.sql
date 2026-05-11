ALTER TABLE creations DROP CONSTRAINT IF EXISTS creations_type_check;
ALTER TABLE creations ADD CONSTRAINT creations_type_check CHECK (type IN ('video', 'flyer', 'business-card', 'infographic', 'ad', 'brand-deck', 'logo'));
