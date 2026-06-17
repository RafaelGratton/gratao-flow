export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatCurrency(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatHoursDuration(value: number | string): string {
  const hours = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(hours) || hours <= 0) return "0min";

  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) return `${minutes}min`;
  if (minutes === 0) return `${wholeHours}h`;

  return `${wholeHours}h${String(minutes).padStart(2, "0")}min`;
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
