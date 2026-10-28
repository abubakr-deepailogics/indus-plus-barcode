-- Shorter, scan-friendly prefix for trace employee cards. Update the coupon
-- trail in the same transaction-equivalent migration so historical reports
-- continue to resolve the renamed cards.
UPDATE c
SET EmployeeCode = CONCAT('DM-', SUBSTRING(c.EmployeeCode, 7, 100))
FROM dbo.QrCode_Coupon c
WHERE c.EmployeeCode LIKE 'DUMMY-%';

UPDATE dbo.DummyEmployee
SET EmployeeCode = CONCAT('DM-', SUBSTRING(EmployeeCode, 7, 100))
WHERE EmployeeCode LIKE 'DUMMY-%';
