import type { FinancePeriodPreset } from "@/components/finance/types";
import { Card, CardContent } from "@/components/ui/Card";

type Props = {
  preset: FinancePeriodPreset;
  startDate: string;
  endDate: string;
  label: string;
  onPresetChange: (preset: FinancePeriodPreset) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
};

const presets: Array<[FinancePeriodPreset, string]> = [
  ["this_month", "Este mes"],
  ["previous_month", "Mes anterior"],
  ["this_week", "Esta semana"],
  ["today", "Hoje"],
  ["custom", "Personalizado"]
];

export function FinancePeriodFilter({
  preset,
  startDate,
  endDate,
  label,
  onPresetChange,
  onStartDateChange,
  onEndDateChange
}: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Periodo</p>
          <p className="mt-2 text-sm font-semibold text-ink">{label}</p>
          <p className="mt-1 text-sm text-muted">Os totais e as listas abaixo consideram este intervalo.</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Visualizar</span>
            <select
              className="h-12 min-w-48 rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={preset}
              onChange={(event) => onPresetChange(event.target.value as FinancePeriodPreset)}
            >
              {presets.map(([value, optionLabel]) => (
                <option key={value} value={value}>
                  {optionLabel}
                </option>
              ))}
            </select>
          </label>
          {preset === "custom" ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">De</span>
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(event) => onStartDateChange(event.target.value)}
                  className="h-12 rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Ate</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(event) => onEndDateChange(event.target.value)}
                  className="h-12 rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                />
              </label>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
