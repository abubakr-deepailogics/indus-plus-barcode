"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/context/auth-context";
import { useDepartment, type DepartmentKey } from "@/lib/department-context";
import { useWorkOrder } from "@/lib/work-order-context";
import {
  ChevronDown,
  Scissors,
  Layers, FileText, BarChart3, ChevronRight,
  Menu,
  X,
  ScanLine,
  Search as SearchIcon,
  RotateCcw,
  Users
} from "lucide-react";

function productionModuleTabs(basePath: "/sewing" | "/washing" | "/finishing") {
  return [
    { label: "Style Bulletin", href: `${basePath}/style-bulletin`, hasDropdown: false },
    { label: "Coupon Generation", href: `${basePath}/coupon-generation`, hasDropdown: false },
    { label: "Coupon Scanning", href: `${basePath}/coupon-scanning`, hasDropdown: false },
    { label: "Coupon Tracing", href: `${basePath}/coupon-tracing`, hasDropdown: false },
    { label: "Rework Coupon", href: `${basePath}/rework-coupon`, hasDropdown: false },
    { label: "Reports", href: `${basePath}/reports`, hasDropdown: false },
    { label: "Wages", href: `${basePath}/reports/wages`, hasDropdown: false },
  ];
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isIeOpen, setIsIeOpen] = useState(false); // Dropdown closed by default
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (initialTheme !== "light") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(initialTheme);
    }
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isIeOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsIeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isIeOpen]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { department, setDepartment, departments } = useDepartment();
  const { workOrder } = useWorkOrder();

  const workOrderHref = (href: string) =>
    workOrder ? `${href}?wo=${encodeURIComponent(workOrder)}` : href;

  // Sync route with active department
  useEffect(() => {
    if (pathname.startsWith("/washing") && department !== "washing") {
      setDepartment("washing");
    } else if (pathname.startsWith("/finishing") && department !== "finishing") {
      setDepartment("finishing");
    } else if (
      (pathname.startsWith("/sewing") || pathname.startsWith("/industrial-engineering")) &&
      department !== "sewing"
    ) {
      setDepartment("sewing");
    }
  }, [pathname, department, setDepartment]);

  const handleDepartmentSwitch = (deptId: DepartmentKey) => {
    setDepartment(deptId);
    if (deptId === "washing" || deptId === "finishing") {
      router.push(`/${deptId}/style-bulletin`);
    } else if (
      deptId === "sewing" &&
      (pathname.startsWith("/washing") || pathname.startsWith("/finishing"))
    ) {
      router.push("/sewing/cut-report");
    }
  };

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Top navigation tabs
  const currentNavTabs = useMemo(() => {
    if (department === "washing" || department === "finishing") {
      return productionModuleTabs(`/${department}`);
    }
    if (department === "sewing") {
      return [
        { label: "Cut Report", href: "/sewing/cut-report", hasDropdown: false },
        ...productionModuleTabs("/sewing"),
      ];
    }
    return [];
  }, [department, user?.isAdmin]);

  return (
    <div data-client-brand className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Primary Header */}
      <header className="no-print sticky top-0 z-50 bg-white border-b border-[#f1f5f9] px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-xs gap-3">
        {/* Logo block */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <img
            src="/logo.png"
            alt="Indus Plus Logo"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain group-hover:scale-105 transition-transform duration-200"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#0f172a] leading-tight tracking-tight">Indus Plus Ltd</span>
            <span className="text-[10px] text-[#64748b] leading-none">INDUS PLUS LIMITED</span>
          </div>
        </Link>

        {/* Center: Manufacturing Department Items (Sewing, Washing, Finishing, GDP) */}
        <nav aria-label="Department Navigation" className="hidden md:flex items-center justify-center flex-1 max-w-xl mx-2">
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 gap-1 shadow-xs">
            {departments.map((dept) => {
              const isActive = department === dept.id;
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => handleDepartmentSwitch(dept.id)}
                  className={`px-3.5 lg:px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-[#4f46e5] shadow-xs"
                      : "text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200/50"
                  }`}
                  title={dept.description}
                >
                  {dept.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Profile and Action Bar */}
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          {user?.isAdmin && (
            <Link
              href="/manage-users"
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
            >
              <Users className="size-3.5" />
              Manage Users
            </Link>
          )}
          {/* User Profile */}
          <div className="flex items-center gap-3 border-l border-[#f1f5f9] pl-4 sm:pl-6">
            <div className="w-9 h-9 rounded-full bg-[#1e293b] flex items-center justify-center font-semibold text-white text-xs shadow-inner">
              {initials}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-[#0f172a] leading-tight">{displayName}</span>
              <span className="text-[10px] text-[#64748b]">{user?.email}</span>
            </div>
            <button
              onClick={() => logout()}
              className="text-xs font-semibold text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded-lg md:hidden transition-colors cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden no-print bg-white border-b border-slate-200 shadow-md px-4 py-3 flex flex-col gap-3 z-50">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Manufacturing Department
            </span>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              {departments.map((dept) => {
                const isActive = department === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      handleDepartmentSwitch(dept.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-[#4f46e5] shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>{dept.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {user?.isAdmin && (
            <Link
              href="/manage-users"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700"
            >
              <span className="flex items-center gap-2"><Users className="size-3.5" />Manage Users</span>
              <ChevronRight className="size-3.5" />
            </Link>
          )}

          {currentNavTabs.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 capitalize">
                {department} Navigation
              </span>
              <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                {currentNavTabs.map((tab, idx) => (
                  <Link
                    key={idx}
                    href={workOrderHref(tab.href)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      pathname === tab.href
                        ? "bg-indigo-50 text-[#4f46e5] font-bold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Secondary Top Tab Navigation */}
      <nav className="no-print bg-white border-b border-[#e2e8f0] px-4 sm:px-6 py-2.5 relative z-40">
        <div className="max-w-[1400px] mx-auto overflow-x-auto scrollbar-none">
          {currentNavTabs.length > 0 ? (
            <div className="flex items-center gap-1.5 min-w-max">
              {currentNavTabs.map((tab, idx) => {
                const isTabActive = tab.href !== "#"
                  ? pathname === tab.href
                  : (tab.label === "Industrial Engineering" && isIeOpen);

                const content = (
                  <>
                    {tab.label}
                    {tab.hasDropdown && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isTabActive && isIeOpen ? "rotate-180 text-[#4f46e5]" : "text-[#94a3b8]"
                        }`}
                      />
                    )}
                  </>
                );

                const className = `px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  isTabActive
                    ? "bg-[#e0e7ff] text-[#4f46e5] shadow-xs font-bold"
                    : "text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]"
                }`;

                return (
                  <div key={idx} className="relative">
                    {tab.href !== "#" ? (
                      <Link href={workOrderHref(tab.href)} className={className}>
                        {content}
                      </Link>
                    ) : (
                      <button
                        ref={tab.label === "Industrial Engineering" ? triggerRef : undefined}
                        onClick={() => {
                          if (tab.label === "Industrial Engineering") {
                            setIsIeOpen(!isIeOpen);
                          }
                        }}
                        className={className}
                      >
                        {content}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-7" />
          )}
        </div>

        {/* Industrial Engineering Dropdown Menu Overlay - Positioned outside overflow wrapper */}
        {isIeOpen && (
          <div
            ref={dropdownRef}
            className="absolute left-6 mt-3 w-[720px] bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] p-6 grid grid-cols-2 divide-x divide-[#f1f5f9] gap-0 animate-fade-in z-50"
          >
            
            {/* LEFT COLUMN: BULLETIN & CUTTING and STITCHING */}
            <div className="pr-6 flex flex-col gap-6">
              
              {/* SECTION: BULLETIN & CUTTING */}
              <div className="flex flex-col gap-2">
                <h4 className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">
                  Bulletin & Cutting
                </h4>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                    <Scissors className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Pre Order Style Bulletin cutting
                  </span>
                </Link>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <Scissors className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Order Style Bulletin cutting
                  </span>
                </Link>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    OSB Cutting (Extra Work Size Wise)
                  </span>
                </Link>
              </div>

              {/* SECTION: STITCHING */}
              <div className="flex flex-col gap-2 pt-4 border-t border-[#f1f5f9]">
                <h4 className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">
                  Stitching
                </h4>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                    {/* Spool / Cup representation */}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12M8 3v18M16 3v18M6 21h12M6 8h12M6 12h12M6 16h12" />
                    </svg>
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Pre Order Style Bulletin Stitch
                  </span>
                </Link>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Order Style Bulletin Stitch
                  </span>
                </Link>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12M8 3v18M16 3v18M6 21h12M6 8h12M6 12h12M6 16h12" />
                    </svg>
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    OSB Stitching (Extra Work Size Wise)
                  </span>
                </Link>
              </div>

            </div>

            {/* RIGHT COLUMN: FINISHING, G.D.P & G.W.P, and ANALYSIS */}
            <div className="pl-6 flex flex-col gap-6">
              
              {/* SECTION: FINISHING */}
              <div className="flex flex-col gap-2">
                <h4 className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">
                  Finishing
                </h4>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                    <Scissors className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Pre Order Style Bulletin Finish
                  </span>
                </Link>
                {/* Highlighted item in UI screenshot */}
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center justify-between p-1.5 rounded-xl bg-purple-50 border border-purple-100/50 shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white text-purple-600 flex items-center justify-center shadow-sm">
                      <FileText className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-purple-700 leading-snug">
                      Order Style Bulletin Finish
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-purple-500 mr-1" />
                </Link>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                    <Scissors className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    OSB Finishing (Extra Work Size Wise)
                  </span>
                </Link>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                      Development Cell
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8] mr-1" />
                </Link>
                <Link
                  href="/industrial-engineering/qr-code-generation-finishing"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                      QR Code Generation
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8] mr-1" />
                </Link>
              </div>

              {/* SECTION: COUPONS */}
              <div className="flex flex-col gap-2 pt-4 border-t border-[#f1f5f9]">
                <h4 className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">
                  Coupons
                </h4>
                <Link
                  href="/industrial-engineering/coupon-scanning"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-500 flex items-center justify-center">
                    <ScanLine className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Coupon Scanning
                  </span>
                </Link>
                <Link
                  href="/industrial-engineering/coupon-tracing"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-500 flex items-center justify-center">
                    <SearchIcon className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Coupon Tracing
                  </span>
                </Link>
                <Link
                  href="/industrial-engineering/rework-coupon"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Rework Coupon
                  </span>
                </Link>
              </div>

              {/* SECTION: G.D.P & G.W.P */}
              <div className="flex flex-col gap-2 pt-4 border-t border-[#f1f5f9]">
                <h4 className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">
                  G.D.P & G.W.P
                </h4>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Pre Order Style Bulletin G.D.P & G.W.P
                  </span>
                </Link>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12M8 3v18M16 3v18M6 21h12M6 8h12M6 12h12M6 16h12" />
                    </svg>
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Order Style Bulletin G.D.P & G.W.P
                  </span>
                </Link>
                <Link
                  href="/industrial-engineering/order-style-bulletin-finish"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    OSB GDP (Extra Work Size Wise)
                  </span>
                </Link>
              </div>

              {/* SECTION: ANALYSIS */}
              <div className="flex flex-col gap-2 pt-4 border-t border-[#f1f5f9]">
                <h4 className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">
                  Analysis
                </h4>
                <Link
                  href="/industrial-engineering/reports"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors leading-snug">
                    Employee Report
                  </span>
                </Link>
                <Link
                  href="#"
                  onClick={() => setIsIeOpen(false)}
                  className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#f8fafc] group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-semibold text-[#475569] group-hover:text-[#0f172a] transition-colors">
                      Efficiency
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8] mr-1" />
                </Link>
              </div>

            </div>

          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-6 md:p-8 relative">
        {department === "sewing" || department === "washing" || department === "finishing" ? (
          children
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[380px] text-center p-8 bg-white rounded-2xl border border-dashed border-slate-200 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#4f46e5] flex items-center justify-center mb-3 text-sm font-bold uppercase tracking-wider">
              {department}
            </div>
            <h3 className="text-base font-bold text-slate-900 capitalize mb-1">
              {department} Department
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Module navigation is ready. Forms and reports for {department} will be added here as needed.
            </p>
          </div>
        )}
      </main>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; width: 100% !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
