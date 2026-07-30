export interface Operation {
  code: string;
  name: string;
  machine: string;
  sam: number;
  targetPerHour: number;
  operatorsNeeded: number;
}

export interface StyleBulletin {
  id: string;
  styleNo: string;
  styleName: string;
  buyer: string;
  season: string;
  totalSam: number;
  targetPerDay: number;
  totalOperations: number;
  status: 'Draft' | 'Approved' | 'Pending';
  dateCreated: string;
  operations: Operation[];
}

export const mockStyleBulletins: StyleBulletin[] = [
  {
    id: "OSB-2026-001",
    styleNo: "AZ-P-9081",
    styleName: "Premium Polo T-Shirt (Manga Edition)",
    buyer: "Azgard Nine Limited",
    season: "Summer 2026",
    totalSam: 14.85,
    targetPerDay: 1200,
    totalOperations: 12,
    status: "Approved",
    dateCreated: "2026-07-28",
    operations: [
      { code: "OP-01", name: "Collar Join (Overlock)", machine: "3-Thread Overlock", sam: 1.25, targetPerHour: 48, operatorsNeeded: 2 },
      { code: "OP-02", name: "Shoulder Join & Tape", machine: "Flatlock Stitch", sam: 0.95, targetPerHour: 63, operatorsNeeded: 1 },
      { code: "OP-03", name: "Placket Preparation", machine: "Lockstitch Plain", sam: 2.10, targetPerHour: 28, operatorsNeeded: 3 },
      { code: "OP-04", name: "Placket Join to Body", machine: "Lockstitch Plain", sam: 1.80, targetPerHour: 33, operatorsNeeded: 2 },
      { code: "OP-05", name: "Sleeve Hemming", machine: "2-Needle Flatlock", sam: 0.85, targetPerHour: 70, operatorsNeeded: 1 },
      { code: "OP-06", name: "Sleeve Attach", machine: "4-Thread Overlock", sam: 1.50, targetPerHour: 40, operatorsNeeded: 2 },
      { code: "OP-07", name: "Side Seam Join", machine: "4-Thread Overlock", sam: 1.65, targetPerHour: 36, operatorsNeeded: 2 },
      { code: "OP-08", name: "Bottom Hemming", machine: "Flatlock Cylindrical", sam: 1.10, targetPerHour: 54, operatorsNeeded: 1 },
      { code: "OP-09", name: "Button Hole Stitching", machine: "Button Hole Machine", sam: 0.75, targetPerHour: 80, operatorsNeeded: 1 },
      { code: "OP-10", name: "Button Sewing", machine: "Button Sewing Machine", sam: 0.60, targetPerHour: 100, operatorsNeeded: 1 },
      { code: "OP-11", name: "Final Inspection", machine: "Manual", sam: 1.50, targetPerHour: 40, operatorsNeeded: 2 },
      { code: "OP-12", name: "Ironing & Packing", machine: "Steam Iron", sam: 0.80, targetPerHour: 75, operatorsNeeded: 1 }
    ]
  },
  {
    id: "OSB-2026-002",
    styleNo: "AZ-D-4412",
    styleName: "Slim Fit Stretch Denim Jeans",
    buyer: "Levi's Brand Partner",
    season: "Fall/Winter 2026",
    totalSam: 28.40,
    targetPerDay: 800,
    totalOperations: 18,
    status: "Approved",
    dateCreated: "2026-07-29",
    operations: [
      { code: "OP-01", name: "Front Pocket Attachment", machine: "Lockstitch Plain", sam: 1.95, targetPerHour: 30, operatorsNeeded: 2 },
      { code: "OP-02", name: "Coin Pocket Stitch", machine: "Lockstitch Plain", sam: 1.10, targetPerHour: 54, operatorsNeeded: 1 },
      { code: "OP-03", name: "Back Pocket Prep & Creasing", machine: "Iron / Manual", sam: 1.50, targetPerHour: 40, operatorsNeeded: 2 },
      { code: "OP-04", name: "Back Pocket Attachment", machine: "Pattern Sewer", sam: 2.20, targetPerHour: 27, operatorsNeeded: 3 },
      { code: "OP-05", name: "Yoke Join (Feed of Arm)", machine: "Feed-of-Arm", sam: 1.60, targetPerHour: 37, operatorsNeeded: 2 },
      { code: "OP-06", name: "Back Rise Seaming", machine: "Overlock / Plain", sam: 1.45, targetPerHour: 41, operatorsNeeded: 2 },
      { code: "OP-07", name: "Zipper Fly Prep", machine: "Lockstitch Plain", sam: 2.10, targetPerHour: 28, operatorsNeeded: 2 },
      { code: "OP-08", name: "Zipper Fly Attachment", machine: "Lockstitch J-Stitch", sam: 2.80, targetPerHour: 21, operatorsNeeded: 3 },
      { code: "OP-09", name: "Inseam Join", machine: "Feed-of-Arm", sam: 1.85, targetPerHour: 32, operatorsNeeded: 2 },
      { code: "OP-10", name: "Outseam Join", machine: "Overlock 5-Thread", sam: 2.10, targetPerHour: 28, operatorsNeeded: 2 }
    ]
  },
  {
    id: "OSB-2026-003",
    styleNo: "AZ-J-2219",
    styleName: "Windbreaker Active Jacket",
    buyer: "Decathlon Sourcing",
    season: "Spring 2027",
    totalSam: 24.15,
    targetPerDay: 950,
    totalOperations: 15,
    status: "Pending",
    dateCreated: "2026-07-30",
    operations: [
      { code: "OP-01", name: "Pocket Zipper Join", machine: "Lockstitch Plain", sam: 2.40, targetPerHour: 25, operatorsNeeded: 3 },
      { code: "OP-02", name: "Front Panel Assembly", machine: "Lockstitch Plain", sam: 1.80, targetPerHour: 33, operatorsNeeded: 2 },
      { code: "OP-03", name: "Back Mesh Lining Join", machine: "Overlock 3-Thread", sam: 1.50, targetPerHour: 40, operatorsNeeded: 2 },
      { code: "OP-04", name: "Main Zipper Attachment", machine: "Lockstitch Plain", sam: 3.10, targetPerHour: 19, operatorsNeeded: 4 },
      { code: "OP-05", name: "Hood Attachment", machine: "Lockstitch Plain", sam: 2.05, targetPerHour: 29, operatorsNeeded: 2 }
    ]
  }
];

export const mockDashboardData = {
  stats: [
    { label: "Orders", value: "1,248", change: "+ 12.4%", status: "up", sub: "from last month", color: "blue" },
    { label: "Completed", value: "892", change: "+ 8.7%", status: "up", sub: "from last month", color: "green" },
    { label: "In Progress", value: "64", change: "+ 5.1%", status: "up", sub: "from last month", color: "orange" },
    { label: "Efficiency", value: "98.5%", change: "+ 3.6%", status: "up", sub: "from last month", color: "blue" }
  ],
  efficiencyPercentage: 76,
  efficiencyChange: "+ 6% from last month",
  recentActivities: [
    { id: "act-1", text: "Order #ORD-2024-1256 approved", time: "2 minutes ago", type: "order" },
    { id: "act-2", text: "Sample #SMP-2024-089 created", time: "15 minutes ago", type: "sample" },
    { id: "act-3", text: "Cutting report #CR-2024-045 submitted", time: "1 hour ago", type: "report" },
    { id: "act-4", text: "PPC planning updated for Line 3", time: "2 hours ago", type: "ppc" }
  ],
  quickActions: [
    { label: "Create Order", icon: "FileText", color: "blue" },
    { label: "Add Sample", icon: "Beaker", color: "green" },
    { label: "Cutting Report", icon: "Scissors", color: "orange" },
    { label: "View Reports", icon: "BarChart3", color: "blue" }
  ]
};
