export interface DummyEmployee {
  employeeCode: string;
  employeeName: string;
  department: string;
  operationCode: string;
  operationName: string | null;
  isActive: boolean;
}

export interface ErpOperation {
  operationCode: string;
  operationName: string | null;
  department: string | null;
}
