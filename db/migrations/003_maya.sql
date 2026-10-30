-- Maya (InstaPay QR) as a second way to pay.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('gcash','maya','cash','bank','other'));

UPDATE settings
SET value = value || jsonb_build_object('paymentAlt', jsonb_build_object(
      'bankName', 'Maya',
      'accountName', value->'payment'->>'accountName',
      'accountNumber', '',
      'qrUrl', '/brand/maya-qr.jpg')),
    updated_at = now()
WHERE key = 'config' AND NOT value ? 'paymentAlt';
