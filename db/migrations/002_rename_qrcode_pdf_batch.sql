-- Renamed from Barcode_Pdf_Batch: these are QR codes, not barcodes.
-- Table and index renamed in two steps since sp_rename needs the index
-- renamed under its (at that point still old) table-qualified name first.
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Barcode_Pdf_Batch')
  AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'QrCode_Pdf_Batch')
BEGIN
  EXEC sp_rename 'dbo.Barcode_Pdf_Batch', 'QrCode_Pdf_Batch';
  EXEC sp_rename 'dbo.QrCode_Pdf_Batch.IX_Barcode_Pdf_Batch_AnlNo', 'IX_QrCode_Pdf_Batch_AnlNo', 'INDEX';
END
