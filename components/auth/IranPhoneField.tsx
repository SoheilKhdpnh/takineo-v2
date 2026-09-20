import { IranFlag } from "@/components/auth/IranFlag";
import { IRAN_CALLING_CODE, IRAN_MOBILE_EXAMPLE } from "@/lib/domain/iran-phone";

interface IranPhoneFieldProps {
  id: string;
  label: string;
  hint: string;
  countryLabel: string;
  value: string;
  describedBy?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}

export function IranPhoneField({
  id,
  label,
  hint,
  countryLabel,
  value,
  describedBy,
  invalid,
  onChange,
}: IranPhoneFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-zinc-900">
        {label}
      </label>

      <div dir="ltr" className="flex overflow-hidden rounded-xl border border-zinc-300 bg-white focus-within:border-zinc-950">
        <div
          className="flex items-center gap-2 border-e border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-800"
          title={countryLabel}
        >
          <IranFlag className="h-4 w-6 rounded-[2px] shadow-sm" />
          <span>{IRAN_CALLING_CODE}</span>
        </div>

        <input
          id={id}
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          placeholder={IRAN_MOBILE_EXAMPLE}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent px-3 py-2.5 text-left text-zinc-950 outline-none"
        />
      </div>

      <p id={`${id}-hint`} className="text-xs text-zinc-500">
        {hint}
      </p>
    </div>
  );
}
