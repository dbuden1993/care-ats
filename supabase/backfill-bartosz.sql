-- Backfill: Create Bartosz Solilo as a candidate and link his WhatsApp messages
-- Run this in the Supabase SQL editor

-- Step 1: Insert Bartosz as a candidate (only if he doesn't already exist)
-- Borrows org_id and phone_e164 from his existing whatsapp_messages row
INSERT INTO candidates (name, phone_e164, status, source, org_id, created_at)
SELECT
  'Bartosz Solilo',
  (SELECT phone_e164 FROM whatsapp_messages WHERE chat_name ILIKE '%bartosz%' AND phone_e164 IS NOT NULL LIMIT 1),
  'new',
  'whatsapp',
  (SELECT org_id FROM candidates ORDER BY created_at LIMIT 1),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM candidates WHERE name ILIKE '%bartosz%'
);

-- Step 2: Link all his WhatsApp messages to the candidate record
UPDATE whatsapp_messages
SET candidate_id = (
  SELECT id FROM candidates WHERE name ILIKE '%bartosz%' LIMIT 1
)
WHERE chat_name ILIKE '%bartosz%'
  AND candidate_id IS NULL;

-- Step 3: Verify
SELECT
  c.id,
  c.name,
  c.phone_e164,
  c.status,
  c.source,
  COUNT(w.id) AS message_count
FROM candidates c
LEFT JOIN whatsapp_messages w ON w.candidate_id = c.id
WHERE c.name ILIKE '%bartosz%'
GROUP BY c.id, c.name, c.phone_e164, c.status, c.source;
