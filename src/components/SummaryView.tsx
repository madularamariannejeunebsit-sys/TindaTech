import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  Upload,
  Copy,
  Check,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Product, SaleTransaction, StoreSettings, StoreState, SukiCustomer } from '../types/store';
import {
  downloadJsonFile,
  exportSalesCsv,
  formatPeso,
  formatPesoExact,
  isSameCalendarDay,
} from '../utils/storage';

interface SummaryViewProps {
  storeState: StoreState;
  onUpdateSettings: (settings: StoreSettings) => void;
  onImportState: (imported: StoreState) => void;
  onResetStarter: () => void;
  onClearEmpty: () => void;
}

export function SummaryView({
  storeState,
  onUpdateSettings,
  onImportState,
  onResetStarter,
  onClearEmpty,
}: SummaryViewProps) {
  const { settings, products, transactions, sukis } = storeState;
  const [storeName, setStoreName] = useState(settings.storeName);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [dailyGoal, setDailyGoal] = useState(String(settings.dailyGoal));
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedRestock, setCopiedRestock] = useState(false);
  const [importError, setImportError] = useState('');
  const [confirmMode, setConfirmMode] = useState<'starter' | 'empty' | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const todayStats = useMemo(() => {
    const todayTx = transactions.filter((tx) => isSameCalendarDay(tx.createdAt));
    const revenue = todayTx.reduce((s, t) => s + t.totalAmount, 0);
    const profit = todayTx.reduce((s, t) => s + t.totalProfit, 0);
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const goalPct = settings.dailyGoal > 0 ? Math.min(100, (revenue / settings.dailyGoal) * 100) : 0;
    return { count: todayTx.length, revenue, profit, margin, goalPct };
  }, [transactions, settings.dailyGoal]);

  const last7Days = useMemo(() => {
    const days: { label: string; dateStr: string; revenue: number; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayTx = transactions.filter((tx) => isSameCalendarDay(tx.createdAt, d));
      days.push({
        label: d.toLocaleDateString('en-PH', { weekday: 'short' }),
        dateStr: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        revenue: dayTx.reduce((s, t) => s + t.totalAmount, 0),
        profit: dayTx.reduce((s, t) => s + t.totalProfit, 0),
      });
    }
    const maxRev = Math.max(100, ...days.map((d) => d.revenue));
    return { days, maxRev };
  }, [transactions]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    transactions.forEach((tx) => {
      tx.items.forEach((item) => {
        const existing = map.get(item.productId) ?? {
          name: item.name,
          qty: 0,
          revenue: 0,
          profit: 0,
        };
        existing.qty += item.quantity;
        existing.revenue += item.subtotal;
        existing.profit += (item.unitPrice - item.unitCost) * item.quantity;
        map.set(item.productId, existing);
      });
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [transactions]);

  const restockList = useMemo(() => {
    return products
      .filter((p) => p.stock <= p.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock)
      .map((p) => {
        const target = Math.max(p.lowStockThreshold * 2, 12);
        const suggestedBuy = Math.max(1, target - p.stock);
        return {
          product: p,
          suggestedBuy,
          estimatedCost: suggestedBuy * p.cost,
        };
      });
  }, [products]);

  const totalRestockCost = useMemo(
    () => restockList.reduce((sum, item) => sum + item.estimatedCost, 0),
    [restockList]
  );

  const handleCopyRestockList = async () => {
    if (restockList.length === 0) return;
    const text = [
      `${settings.storeName} — Restock List`,
      ...restockList.map(
        (r) =>
          `- ${r.product.name}: buy ${r.suggestedBuy} ${r.product.unit} (left: ${r.product.stock}, est. ${formatPesoExact(
            r.estimatedCost
          )})`
      ),
      `Total Est. Capital: ${formatPesoExact(totalRestockCost)}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRestock(true);
      setTimeout(() => setCopiedRestock(false), 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const goal = parseFloat(dailyGoal);
    onUpdateSettings({
      storeName: storeName.trim() || 'My Sari-Sari Store',
      ownerName: ownerName.trim() || 'Store Owner',
      dailyGoal: Number.isFinite(goal) && goal > 0 ? goal : 2000,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as StoreState;
        if (
          !parsed ||
          !Array.isArray(parsed.products) ||
          !Array.isArray(parsed.transactions) ||
          !Array.isArray(parsed.sukis)
        ) {
          setImportError('Invalid backup file format.');
          return;
        }
        onImportState(parsed);
        setStoreName(parsed.settings?.storeName ?? 'My Sari-Sari Store');
        setOwnerName(parsed.settings?.ownerName ?? 'Store Owner');
        setDailyGoal(String(parsed.settings?.dailyGoal ?? 2000));
      } catch {
        setImportError('Could not read JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      {/* Daily Target & KPI Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-white border border-[#E6E4DF] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs text-[#64615B]">Today&apos;s Sales vs Daily Goal</p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <p className="text-3xl font-mono font-bold tabular-nums text-[#181715]">
                {formatPesoExact(todayStats.revenue)}
              </p>
              <span className="text-xs font-mono tabular-nums text-[#64615B]">
                Goal {formatPeso(settings.dailyGoal)}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2.5 w-full rounded-full bg-[#F3F1EC] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0F766E] transition-all duration-300"
                style={{ width: `${todayStats.goalPct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#64615B] tabular-nums">
              <span>{todayStats.goalPct.toFixed(0)}% of daily target</span>
              <span>
                Est. profit{' '}
                <strong className="font-mono text-[#0F766E]">
                  {formatPesoExact(todayStats.profit)}
                </strong>{' '}
                ({todayStats.margin.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* 7-Day Revenue Bar Chart */}
        <div className="lg:col-span-7 bg-white border border-[#E6E4DF] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#181715]">Last 7 Days Sales</h2>
              <p className="text-xs text-[#64615B]">Daily gross sales in Philippine Peso</p>
            </div>
            <span className="text-xs font-mono font-semibold tabular-nums text-[#0F766E]">
              7-Day Total:{' '}
              {formatPeso(last7Days.days.reduce((sum, d) => sum + d.revenue, 0))}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-32 pt-2">
            {last7Days.days.map((day, idx) => {
              const heightPct =
                day.revenue > 0 ? Math.max(10, (day.revenue / last7Days.maxRev) * 100) : 4;
              const isToday = idx === 6;

              return (
                <div key={day.dateStr} className="flex flex-col items-center h-full justify-end">
                  <span className="text-[10px] font-mono tabular-nums text-[#64615B] mb-1 truncate max-w-full">
                    {day.revenue > 0 ? formatPeso(day.revenue) : '—'}
                  </span>
                  <div className="w-full max-w-[36px] flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all ${
                        isToday ? 'bg-[#0F766E]' : 'bg-[#D6D3CB]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${day.dateStr}: ${formatPesoExact(day.revenue)}`}
                    />
                  </div>
                  <span
                    className={`text-[11px] mt-1.5 font-medium ${
                      isToday ? 'text-[#0F766E] font-bold' : 'text-[#64615B]'
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Palengke Restock List & Top Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-[#E6E4DF] rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#181715]">Palengke Restock List</h2>
              <p className="text-xs text-[#64615B]">
                Items at or below low-stock threshold · Est. capital{' '}
                <span className="font-mono font-semibold text-[#181715] tabular-nums">
                  {formatPesoExact(totalRestockCost)}
                </span>
              </p>
            </div>
            {restockList.length > 0 && (
              <button
                type="button"
                onClick={handleCopyRestockList}
                className="min-h-[40px] px-3.5 rounded-xl border border-[#E6E4DF] hover:bg-[#F3F1EC] text-xs font-semibold text-[#181715] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {copiedRestock ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#0F766E]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy List</span>
                  </>
                )}
              </button>
            )}
          </div>

          {restockList.length === 0 ? (
            <p className="text-sm text-[#64615B] py-4">
              All products are sufficiently stocked above their alert thresholds.
            </p>
          ) : (
            <div className="divide-y divide-[#ECEAE4]">
              {restockList.map(({ product, suggestedBuy, estimatedCost }) => (
                <div
                  key={product.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#181715] truncate">{product.name}</p>
                    <p className="text-xs text-[#64615B] tabular-nums">
                      {product.stock === 0 ? (
                        <span className="text-[#BE123C] font-semibold">Out of stock</span>
                      ) : (
                        <span className="text-[#B45309] font-semibold">
                          {product.stock} {product.unit} left
                        </span>
                      )}{' '}
                      · Suggested buy: +{suggestedBuy} {product.unit}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#181715] shrink-0">
                    {formatPesoExact(estimatedCost)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E6E4DF] rounded-2xl p-5">
          <h2 className="text-base font-bold text-[#181715]">Top Selling Items</h2>
          <p className="text-xs text-[#64615B] mb-4">Ranked by total sales revenue</p>

          {topProducts.length === 0 ? (
            <p className="text-sm text-[#64615B] py-4">No completed sales recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#ECEAE4]">
              {topProducts.map((item, index) => (
                <div
                  key={item.name}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-[#64615B] w-5 tabular-nums">
                      0{index + 1}.
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#181715] truncate">{item.name}</p>
                      <p className="text-xs text-[#64615B] tabular-nums">
                        {item.qty} sold · +{formatPesoExact(item.profit)} profit
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold tabular-nums text-[#181715] shrink-0">
                    {formatPesoExact(item.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Store Settings & Offline Data Backup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-6 bg-white border border-[#E6E4DF] rounded-2xl p-5 space-y-4"
        >
          <div>
            <h2 className="text-base font-bold text-[#181715]">Store Profile</h2>
            <p className="text-xs text-[#64615B]">Customize your store identity and daily target</p>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="store-name-input" className="block text-xs font-medium text-[#64615B] mb-1">
                Store Name
              </label>
              <input
                id="store-name-input"
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] text-sm text-[#181715] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="owner-name-input" className="block text-xs font-medium text-[#64615B] mb-1">
                  Owner Name
                </label>
                <input
                  id="owner-name-input"
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] text-sm text-[#181715] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>
              <div>
                <label htmlFor="daily-goal-input" className="block text-xs font-medium text-[#64615B] mb-1">
                  Daily Sales Goal (₱)
                </label>
                <input
                  id="daily-goal-input"
                  type="number"
                  min="100"
                  step="50"
                  inputMode="numeric"
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] text-sm font-mono tabular-nums text-[#181715] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#0F766E]">
              {savedNotice ? 'Store settings saved.' : ''}
            </span>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D655E] transition-colors"
            >
              Save Profile
            </button>
          </div>
        </form>

        <div className="lg:col-span-6 bg-white border border-[#E6E4DF] rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#181715]">Backups & Exports</h2>
            <p className="text-xs text-[#64615B]">
              Your records are saved locally on this device. Export anytime for safekeeping.
            </p>
          </div>

          {importError && (
            <p className="text-xs font-medium text-[#BE123C] bg-[#FFF1F2] p-2.5 rounded-xl">
              {importError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => exportSalesCsv(transactions)}
              className="min-h-[44px] px-3.5 rounded-xl border border-[#E6E4DF] bg-white hover:bg-[#F3F1EC] text-xs font-semibold text-[#181715] inline-flex items-center justify-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#0F766E]" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() =>
                downloadJsonFile(
                  `tindatech-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  storeState
                )
              }
              className="min-h-[44px] px-3.5 rounded-xl border border-[#E6E4DF] bg-white hover:bg-[#F3F1EC] text-xs font-semibold text-[#181715] inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-[#0F766E]" />
              <span>Save Backup</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-3.5 rounded-xl border border-[#E6E4DF] bg-white hover:bg-[#F3F1EC] text-xs font-semibold text-[#181715] inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4 text-[#0F766E]" />
              <span>Restore JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          <div className="pt-3 border-t border-[#ECEAE4] flex flex-wrap items-center justify-between gap-2">
            {confirmMode ? (
              <div className="w-full flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#BE123C]">
                  {confirmMode === 'starter'
                    ? 'Replace current store with starter sample items?'
                    : 'Erase all products, sales, and suki accounts?'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmMode(null)}
                    className="min-h-[36px] px-3 rounded-lg border border-[#E6E4DF] text-xs font-medium text-[#181715]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmMode === 'starter') onResetStarter();
                      else onClearEmpty();
                      setConfirmMode(null);
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-[#BE123C] text-white text-xs font-semibold"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmMode('starter')}
                  className="min-h-[38px] px-3 rounded-xl text-xs font-medium text-[#64615B] hover:text-[#181715] hover:bg-[#F3F1EC] inline-flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Load Starter Sample</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmMode('empty')}
                  className="min-h-[38px] px-3 rounded-xl text-xs font-medium text-[#BE123C] hover:bg-[#FFF1F2] inline-flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Start Fresh Empty Store</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
