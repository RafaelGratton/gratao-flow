import { Input } from "@/components/ui/Input";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function Time24Input({ label, value, onChange, disabled }: Props) {
  return (
    <Input
      label={label}
      type="text"
      inputMode="numeric"
      placeholder="HH:mm"
      maxLength={5}
      value={value}
      onChange={(event) => onChange(maskTime24(event.target.value))}
      disabled={disabled}
    />
  );
}

export function maskTime24(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes(":")) {
    const [rawHour = "", rawMinute = ""] = trimmed.split(":");
    const hour = rawHour.replace(/\D/g, "").slice(0, 2);
    const minute = rawMinute.replace(/\D/g, "").slice(0, 2);
    const normalizedHour = hour.length === 1 ? hour.padStart(2, "0") : hour;
    return `${normalizedHour}:${minute}`.slice(0, 5);
  }

  const digits = trimmed.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function isValidTime24(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function formatTime24(value: string | null) {
  if (!value) return "-";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "-";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}
