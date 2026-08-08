import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="theme-light min-h-screen bg-cream font-sans text-carbon">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      {mobileOpen && <button aria-label="Đóng menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-20 bg-carbon/30 backdrop-blur-sm md:hidden" />}
      <div className="md:pl-64">
        <Header onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
