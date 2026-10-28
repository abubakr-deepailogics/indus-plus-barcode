import { getPool, sql } from "@/lib/db";
import type { DummyEmployee } from "../types";

export async function findDummyEmployee(employeeCode: string): Promise<DummyEmployee | null> {
  const result = await (await getPool("pitSystem")).request()
    .input("employeeCode", sql.NVarChar, employeeCode.trim())
    .query(`SELECT EmployeeCode AS employeeCode, EmployeeName AS employeeName,
      Department AS department, OperationCode AS operationCode,
      OperationName AS operationName, IsActive AS isActive
      FROM dbo.DummyEmployee WHERE EmployeeCode = @employeeCode`);
  return (result.recordset[0] as DummyEmployee | undefined) ?? null;
}

export async function searchDummyEmployees(query: string, includeInactive = false): Promise<DummyEmployee[]> {
  const request = (await getPool("pitSystem")).request();
  request.input("query", sql.NVarChar, `%${query.trim()}%`);
  const result = await request.query(`SELECT TOP 20 EmployeeCode AS employeeCode,
    EmployeeName AS employeeName, Department AS department, OperationCode AS operationCode,
    OperationName AS operationName, IsActive AS isActive
    FROM dbo.DummyEmployee
    WHERE (${includeInactive ? "1 = 1" : "IsActive = 1"})
      AND (EmployeeCode LIKE @query OR EmployeeName LIKE @query)
    ORDER BY EmployeeName, EmployeeCode`);
  return result.recordset as DummyEmployee[];
}

export async function findDummyEmployeesByCodes(employeeCodes: string[]): Promise<Map<string, DummyEmployee>> {
  const employees = new Map<string, DummyEmployee>();
  if (employeeCodes.length === 0) return employees;
  const request = (await getPool("pitSystem")).request();
  const placeholders = employeeCodes.map((code, index) => {
    request.input(`employee${index}`, sql.NVarChar, code);
    return `@employee${index}`;
  });
  const result = await request.query(`SELECT EmployeeCode AS employeeCode, EmployeeName AS employeeName,
    Department AS department, OperationCode AS operationCode, OperationName AS operationName,
    IsActive AS isActive FROM dbo.DummyEmployee WHERE EmployeeCode IN (${placeholders.join(", ")})`);
  for (const employee of result.recordset as DummyEmployee[]) employees.set(employee.employeeCode, employee);
  return employees;
}

export async function createDummyEmployee(input: {
  employeeName: string; department: string; operationCode: string; operationName: string | null; createdBy: string;
}): Promise<DummyEmployee> {
  const pool = await getPool("pitSystem");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const insert = await new sql.Request(transaction)
      .input("employeeName", sql.NVarChar, input.employeeName)
      .input("department", sql.NVarChar, input.department)
      .input("operationCode", sql.NVarChar, input.operationCode)
      .input("operationName", sql.NVarChar, input.operationName)
      .input("createdBy", sql.NVarChar, input.createdBy || null)
      .query(`INSERT INTO dbo.DummyEmployee (EmployeeCode, EmployeeName, Department, OperationCode, OperationName, CreatedBy)
        OUTPUT inserted.Id VALUES (CONCAT('PENDING-', LEFT(CONVERT(NVARCHAR(36), NEWID()), 20)), @employeeName, @department, @operationCode, @operationName, @createdBy)`);
    const id = Number(insert.recordset[0].Id);
    const employeeCode = `DUMMY-${String(id).padStart(6, "0")}`;
    await new sql.Request(transaction).input("employeeCode", sql.NVarChar, employeeCode).input("id", sql.Int, id)
      .query("UPDATE dbo.DummyEmployee SET EmployeeCode = @employeeCode WHERE Id = @id");
    await transaction.commit();
    return { employeeCode, employeeName: input.employeeName, department: input.department, operationCode: input.operationCode, operationName: input.operationName, isActive: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateDummyEmployee(employeeCode: string, input: {
  employeeName: string; department: string; operationCode: string; operationName: string | null; isActive: boolean;
}): Promise<DummyEmployee | null> {
  const result = await (await getPool("pitSystem")).request()
    .input("employeeCode", sql.NVarChar, employeeCode)
    .input("employeeName", sql.NVarChar, input.employeeName)
    .input("department", sql.NVarChar, input.department)
    .input("operationCode", sql.NVarChar, input.operationCode)
    .input("operationName", sql.NVarChar, input.operationName)
    .input("isActive", sql.Bit, input.isActive).query(`
      UPDATE dbo.DummyEmployee SET EmployeeName = @employeeName, Department = @department,
        OperationCode = @operationCode, OperationName = @operationName, IsActive = @isActive
      OUTPUT inserted.EmployeeCode AS employeeCode, inserted.EmployeeName AS employeeName,
        inserted.Department AS department, inserted.OperationCode AS operationCode,
        inserted.OperationName AS operationName, inserted.IsActive AS isActive
      WHERE EmployeeCode = @employeeCode`);
  return (result.recordset[0] as DummyEmployee | undefined) ?? null;
}

export async function validateDummyEmployeeOperation(employeeCode: string, operationCodes: string[]) {
  const dummy = await findDummyEmployee(employeeCode);
  if (!dummy) return { isDummy: false as const };
  if (!dummy.isActive) return { isDummy: true as const, allowed: false, error: "This employee card is inactive." };
  const allowed = operationCodes.every((code) => code === dummy.operationCode);
  return { isDummy: true as const, allowed, error: allowed ? undefined : `Dummy employee ${dummy.employeeCode} is restricted to operation ${dummy.operationCode}.` };
}
