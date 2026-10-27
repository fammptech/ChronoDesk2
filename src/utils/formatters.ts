export function formatDurationHms(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function formatHoursDecimal(totalSeconds: number): string {
  const hours = (Math.max(0, totalSeconds) / 3600).toFixed(2);
  return `${hours.replace('.', ',')} h`;
}

export function formatDateTimePtBr(val: unknown): string {
  if (!val) return 'Agora';
  try {
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return val;
    }
    if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as any).toDate === 'function') {
      const d: Date = (val as any).toDate();
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    return 'Recente';
  }
  return 'Recente';
}
