import { getPool, sql, OPERATIONS_CATALOG_TABLE } from "@/lib/db";
import { createDummyEmployee, searchDummyEmployees, updateDummyEmployee } from "@/features/dummy-employees/services/dummy-employees.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();
  const includeInactive = searchParams.get("all") === "true";
  try {
    return Response.json(await searchDummyEmployees(query, includeInactive));
  } catch (error) {
    console.error("Dummy employee lookup failed:", error);
    return Response.json({ error: "Could not load dummy employees." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const employeeName = String(body.employeeName || "").trim();
    const department = String(body.department || "").trim();
    const operationCode = String(body.operationCode || "").trim();
    const createdBy = String(body.createdBy || "").trim();
    if (!employeeName || !department || !operationCode) return Response.json({ error: "Employee name, department, and ERP operation are required." }, { status: 400 });
    if (employeeName.length > 150 || department.length > 50 || operationCode.length > 50) return Response.json({ error: "One or more fields are too long." }, { status: 400 });
    const operation = await (await getPool("indusPlus")).request().input("operationCode", sql.NVarChar, operationCode)
      .query(`SELECT TOP 1 OperationCode, OperationName, Department FROM ${OPERATIONS_CATALOG_TABLE} WHERE OperationCode = @operationCode`);
    if (!operation.recordset[0]) return Response.json({ error: "Choose a valid ERP operation code." }, { status: 400 });
    if (String(operation.recordset[0].Department || "").toLowerCase() !== department.toLowerCase()) {
      return Response.json({ error: "The ERP operation must belong to the selected department." }, { status: 400 });
    }
    const created = await createDummyEmployee({ employeeName, department, operationCode, operationName: operation.recordset[0].OperationName ?? null, createdBy });
    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error("Dummy employee creation failed:", error);
    return Response.json({ error: "Could not create employee card." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const employeeCode = String(body.employeeCode || "").trim();
    const employeeName = String(body.employeeName || "").trim();
    const department = String(body.department || "").trim();
    const operationCode = String(body.operationCode || "").trim();
    if (!employeeCode || !employeeName || !department || !operationCode) return Response.json({ error: "Employee, department, and operation are required." }, { status: 400 });
    const operation = await (await getPool("indusPlus")).request().input("operationCode", sql.NVarChar, operationCode).query(`SELECT TOP 1 OperationName, Department FROM ${OPERATIONS_CATALOG_TABLE} WHERE OperationCode = @operationCode`);
    if (!operation.recordset[0] || String(operation.recordset[0].Department || "").toLowerCase() !== department.toLowerCase()) return Response.json({ error: "Choose an ERP operation from the selected department." }, { status: 400 });
    const updated = await updateDummyEmployee(employeeCode, { employeeName, department, operationCode, operationName: operation.recordset[0].OperationName ?? null, isActive: body.isActive !== false });
    if (!updated) return Response.json({ error: "Employee card not found." }, { status: 404 });
    return Response.json(updated);
  } catch (error) {
    console.error("Dummy employee update failed:", error);
    return Response.json({ error: "Could not update employee card." }, { status: 500 });
  }
}
