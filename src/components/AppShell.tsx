"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/context/auth-context";
import {
  ChevronDown,
  Scissors,
  Layers, FileText, BarChart3, ChevronRight,
  Menu,
  X,
  ScanLine,
  Search as SearchIcon,
  RotateCcw
} from "lucide-react";

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

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Top navigation tabs
  const navTabs = [
    // { label: "Industrial Engineering", href: "#", hasDropdown: true },
    { label: "Cut Report", href: "/industrial-engineering/cut-report", hasDropdown: false },
    { label: "Style Bulletin", href: "/industrial-engineering/style-bulletin", hasDropdown: false },
    { label: "Coupon Tracing", href: "/industrial-engineering/coupon-tracing", hasDropdown: false },
    { label: "Coupon Scanning", href: "/industrial-engineering/coupon-scanning", hasDropdown: false },
    { label: "Rework Coupon", href: "/industrial-engineering/rework-coupon", hasDropdown: false }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Primary Header */}
      <header className="no-print sticky top-0 z-50 bg-white border-b border-[#f1f5f9] px-6 py-3 flex items-center justify-between shadow-sm">
        {/* Logo block */}
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/logo.png"
            alt="Indus Plus Logo"
            className="w-10 h-10 object-contain group-hover:scale-105 transition-transform duration-200"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#0f172a] leading-tight tracking-tight">Indus Plus Ltd</span>
            <span className="text-[10px] text-[#64748b] leading-none">INDUS PLUS LIMITED</span>
          </div>
        </Link>

        {/* Search and Action Bar */}
        <div className="flex items-center gap-6">
          {/* Search box */}
          {/* <div className="relative hidden md:flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-9 pr-14 py-1.5 w-64 rounded-full border border-[#e2e8f0] text-xs bg-[#f8fafc] text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition-all"
            />
            <span className="absolute right-3 text-[10px] font-medium text-[#94a3b8] bg-white border border-[#e2e8f0] px-1.5 py-0.5 rounded shadow-sm pointer-events-none">
              Ctrl + K
            </span>
          </div> */}

          {/* Quick controls */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 border-l border-[#f1f5f9] pl-6">
            <div className="w-9 h-9 rounded-full bg-[#1e293b] flex items-center justify-center font-semibold text-white text-xs shadow-inner">
              {initials}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-[#0f172a] leading-tight">{displayName}</span>
              <span className="text-[10px] text-[#64748b]">{user?.email}</span>
            </div>
            <button
              onClick={() => logout()}
              className="text-xs font-semibold text-[#64748b] hover:text-[#0f172a] transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded-lg md:hidden transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Secondary Top Tab Navigation */}
      <nav className="no-print bg-white border-b border-[#e2e8f0] px-6 py-2.5 relative z-40">
        <div className="max-w-[1400px] mx-auto overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-max">
            {navTabs.map((tab, idx) => {
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
                  ? "bg-[#e0e7ff] text-[#4f46e5] shadow-sm font-bold"
                  : "text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]"
              }`;

              return (
                <div key={idx} className="relative">
                  {tab.href !== "#" ? (
                    <Link href={tab.href} className={className}>
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
                      QR Code Generation Finishing
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
        {children}
      </main>
    </div>
  );
}
