-- Custom auth: replaces Firebase Authentication entirely. Users are created
-- only by an existing admin via the Manage Users page (no public sign-up).
-- Passwords are hashed (scrypt) server-side, never stored/sent in plain text.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.Users (
    UserId            INT IDENTITY(1,1) PRIMARY KEY,
    Email             NVARCHAR(255)   NOT NULL UNIQUE,
    DisplayName       NVARCHAR(100)   NOT NULL,
    PasswordHash      NVARCHAR(255)   NOT NULL, -- "scrypt$<saltHex>$<hashHex>"
    IsAdmin           BIT             NOT NULL DEFAULT 0,
    IsActive          BIT             NOT NULL DEFAULT 1, -- disable instead of delete, preserves audit trail (ActedBy/CreatedBy fields elsewhere reference email)
    MustResetPassword BIT             NOT NULL DEFAULT 0, -- forces a reset on next login (used after an admin-triggered reset)
    CreatedAt         DATETIME        NOT NULL DEFAULT GETDATE(),
    CreatedBy         NVARCHAR(255)   NULL,
    UpdatedAt         DATETIME        NULL,
    LastLoginAt       DATETIME        NULL
  );
END;

-- RBAC groundwork: per-user, per-page, per-operation grants. Not enforced
-- everywhere yet (IsAdmin bypasses all checks) — this table exists so
-- granular grants can be added/enforced incrementally without another
-- migration. One row per (user, page, operation) they're explicitly granted;
-- admins implicitly have everything and never need rows here.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserPermissions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.UserPermissions (
    UserPermissionId INT IDENTITY(1,1) PRIMARY KEY,
    UserId            INT           NOT NULL,
    PageKey           NVARCHAR(100) NOT NULL, -- e.g. 'coupon-tracing', 'style-bulletin', 'manage-users'
    Operation         NVARCHAR(20)  NOT NULL, -- 'create' | 'read' | 'update' | 'delete'
    CreatedAt         DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_UserPermissions_UserId FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT CK_UserPermissions_Operation CHECK (Operation IN ('create', 'read', 'update', 'delete')),
    CONSTRAINT UQ_UserPermissions_User_Page_Op UNIQUE (UserId, PageKey, Operation)
  );
END;

-- Seed the one required admin account with a known temporary password
-- ("ChangeMe123!"), forced to be reset on first login (MustResetPassword=1)
-- so the real password is never left as this migration's committed value.
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = 'admin@gmail.com')
BEGIN
  INSERT INTO dbo.Users (Email, DisplayName, PasswordHash, IsAdmin, IsActive, MustResetPassword)
  VALUES ('admin@gmail.com', 'Admin', 'scrypt$bda0308a93eddefd18e9bfd8324f4cd1$bce9df19b8021a01e76e738833c6bc4c1f87a10e4132070631afb0266b6b8f56dafd80373c13a1607446823f88282d94ea5d6c75e9989ae6c248523bdafe16dc', 1, 1, 1);
END;
