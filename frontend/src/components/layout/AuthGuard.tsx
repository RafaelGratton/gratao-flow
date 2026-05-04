"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isAuthenticated } from "@/lib/auth";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <div className="h-10 w-10 rounded-full border-2 border-accent border-r-transparent animate-spin" />
      </div>
    );
  }

  return children;
}
