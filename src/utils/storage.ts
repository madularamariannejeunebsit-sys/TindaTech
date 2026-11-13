import { StoreState, SaleTransaction } from '../types/store';
import { createStarterStoreState } from '../data/defaultStoreData';

const STORAGE_KEY = 'tindatech_store_v1';

export function loadStoreState(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createStarterStoreState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    if (
      !parsed ||
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.transactions) ||
      !Array.isArray(parsed.sukis)
    ) {
      return createStarterStoreState();
    }
    return {
      settings: parsed.settings ?? {
        storeName: 'My Sari-Sari Store',
        ownerName: 'Store Owner',
        dailyGoal: 2000,
      },
      products: parsed.products,
      transactions: parsed.transactions,
      sukis: parsed.sukis,
    };
  } catch {
    return createStarterStoreState();
  }
}

export function saveStoreState(state: StoreState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function formatPeso(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString('en-PH', {
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPesoExact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function isSameCalendarDay(isoDate: string, referenceDate: Date = new Date()): boolean {
  const d = new Date(isoDate);
  return (
    d.getFullYear() === referenceDate.getFullYear() &&
    d.getMonth() === referenceDate.getMonth() &&
    d.getDate() === referenceDate.getDate()
  );
}

export function formatTimeShort(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTimeShort(isoDate: string): string {
  const d = new Date(isoDate);
  if (isSameCalendarDay(isoDate)) {
    return `Today · ${formatTimeShort(isoDate)}`;
  }
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSalesCsv(transactions: SaleTransaction[]): void {
  const headers = [
    'Transaction ID',
    'Date & Time',
    'Payment Method',
    'Customer',
    'Items',
    'Total Sales (PHP)',
    'Total Cost (PHP)',
    'Estimated Profit (PHP)',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = transactions.map((tx) => [
    tx.id,
    new Date(tx.createdAt).toLocaleString('en-PH'),
    tx.paymentMethod === 'cash' ? 'Cash' : 'Utang',
    tx.sukiName ?? 'Walk-in',
    tx.items.map((i) => `${i.quantity}x ${i.name}`).join('; '),
    tx.totalAmount.toFixed(2),
    tx.totalCost.toFixed(2),
    tx.totalProfit.toFixed(2),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tindatech-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
