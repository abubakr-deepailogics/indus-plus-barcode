-- Extends dbo.UserPermissions.Operation to allow two feature-specific values
-- beyond plain CRUD: 'attach' (style bulletin attachments) and 'unscan'
-- (coupon tracing unscan). Same (UserId, PageKey, Operation) row shape as
-- before, just a wider allowed set.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_UserPermissions_Operation')
BEGIN
  ALTER TABLE dbo.UserPermissions DROP CONSTRAINT CK_UserPermissions_Operation;
END;

ALTER TABLE dbo.UserPermissions
  ADD CONSTRAINT CK_UserPermissions_Operation
  CHECK (Operation IN ('create', 'read', 'update', 'delete', 'attach', 'unscan'));
