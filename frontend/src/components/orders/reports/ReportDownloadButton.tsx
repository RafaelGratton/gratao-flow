"use client";

import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

type ReportDownloadButtonProps = {
  endpoint: string;
  fileName: string;
  children: ReactNode;
};

export function ReportDownloadButton({ endpoint, fileName, children }: ReportDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);

    try {
      const blob = await api.downloadBlob(endpoint);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível baixar o PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" isLoading={loading} onClick={handleDownload}>
        <Download size={18} />
        {children}
      </Button>
      {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
