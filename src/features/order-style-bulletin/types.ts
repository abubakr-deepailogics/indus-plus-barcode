export interface BulletinOperationRow {
  id: number;
  section: string;
  seq: number;
  opNo: string;
  opName: string;
  sm: string;
  sam: string;
  rate: string;
  incentive: string;
  mcType: string;
  folder: string;
  mcs100: string;
  mcsPin: string;
  secMc: string;
  headPlan: string;
  lastOp: string;
  refDel: boolean;
  attachedFileName?: string;
}

export interface StyleBulletinData {
  amNo: string;
  customer: string;
  styleCode: string;
  planQty: string;
  description: string;
  styleDescription: string;
  styleCategory: string;
  smdNo: string;
  finalSmdNo: string;
  target: string;
  targetUnitMin: string;
  startTime: string;
  pqcAm: string;
  pqcPieceRate: string;
  headReqd: string;
  totalSam: string;
  totalRate: string;
  appDate: string;
  appBy: string;
  status: string;
  remarks: string;
  operations: BulletinOperationRow[];
}
