interface Props { cents: number; suffix?: string; className?: string; }

export function PriceTag({ cents, suffix = '', className = '' }: Props) {
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {(cents / 100).toFixed(2)} €{suffix}
    </span>
  );
}
