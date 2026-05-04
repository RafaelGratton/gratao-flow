import type { ReactNode } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function AuthenticatedShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen lg:flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />
          <main className="px-5 py-6 xl:px-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
