interface Props { title: string; subtitle?: string; color?: string; icon?: string; }

export function StationHeader({ title, subtitle, color = 'text-brand-orange', icon }: Props) {
  return (
    <div className="px-4 py-3 border-b border-brand-border bg-brand-surface sticky top-0 z-10">
      <h2 className={`font-bold text-sm uppercase tracking-widest ${color} flex items-center gap-2`}>
        {icon && <span>{icon}</span>}{title}
      </h2>
      {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
