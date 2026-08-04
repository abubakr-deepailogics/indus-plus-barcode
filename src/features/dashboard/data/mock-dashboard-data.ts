export const MOCK_DASHBOARD_DATA = {
  stats: [
    { label: "Orders", value: "1,248", change: "+ 12.4%", status: "up", sub: "from last month", color: "blue" },
    { label: "Completed", value: "892", change: "+ 8.7%", status: "up", sub: "from last month", color: "green" },
    { label: "In Progress", value: "64", change: "+ 5.1%", status: "up", sub: "from last month", color: "orange" },
    { label: "Efficiency", value: "98.5%", change: "+ 3.6%", status: "up", sub: "from last month", color: "blue" },
  ],
  efficiencyPercentage: 76,
  efficiencyChange: "+ 6% from last month",
  recentActivities: [
    { id: "act-1", text: "Order #ORD-2024-1256 approved", time: "2 minutes ago", type: "order" },
    { id: "act-2", text: "Sample #SMP-2024-089 created", time: "15 minutes ago", type: "sample" },
    { id: "act-3", text: "Cutting report #CR-2024-045 submitted", time: "1 hour ago", type: "report" },
    { id: "act-4", text: "PPC planning updated for Line 3", time: "2 hours ago", type: "ppc" },
  ],
  quickActions: [
    { label: "Create Order", icon: "FileText", color: "blue" },
    { label: "Add Sample", icon: "Beaker", color: "green" },
    { label: "Cutting Report", icon: "Scissors", color: "orange" },
    { label: "View Reports", icon: "BarChart3", color: "blue" },
  ],
};
