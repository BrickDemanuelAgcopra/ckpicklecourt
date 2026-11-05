-- GoTyme (InstaPay QR) as a third way to pay.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('gcash','maya','gotyme','cash','bank','other'));

UPDATE settings
SET value = value || jsonb_build_object('paymentAlt2', jsonb_build_object(
      'bankName', 'GoTyme',
      'accountName', value->'payment'->>'accountName',
      'accountNumber', '',
      'qrUrl', '/brand/gotyme-qr.jpg')),
    updated_at = now()
WHERE key = 'config' AND NOT value ? 'paymentAlt2';
