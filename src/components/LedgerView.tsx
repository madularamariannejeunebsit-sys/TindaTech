import React, { useMemo, useState } from 'react';
import {
  Receipt,
  BookOpen,
  UserPlus,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import { SaleTransaction, SukiCustomer } from '../types/store';
import {
  formatDateTimeShort,
  formatPeso,
  formatPesoExact,
  isSameCalendarDay,
} from '../utils/storage';
import { ModalSheet } from './ModalSheet';

interface LedgerViewProps {
  transactions: SaleTransaction[];
  sukis: SukiCustomer[];
  onVoidTransaction: (txId: string) => void;
  onAddSuki: (params: { name: string; phone?: string; addressNote?: string }) => void;
  onRecordUtangPayment: (sukiId: string, amount: number, note: string) => void;
  onRecordManualUtang: (sukiId: string, amount: number, note: string) => void;
}

type LedgerSection = 'sales' | 'utang';
type SalesPeriod = 'today' | 'all';

export function LedgerView({
  transactions,
  sukis,
  onVoidTransaction,
  onAddSuki,
  onRecordUtangPayment,
  onRecordManualUtang,
}: LedgerViewProps) {
  const [section, setSection] = useState<LedgerSection>('sales');
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('today');
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);
  const [expandedSukiId, setExpandedSukiId] = useState<string | null>(null);

  // Add Suki modal
  const [sukiModalOpen, setSukiModalOpen] = useState(false);
  const [sukiName, setSukiName] = useState('');
  const [sukiPhone, setSukiPhone] = useState('');
  const [sukiNote, setSukiNote] = useState('');

  // Payment / Charge modal
  const [paymentModal, setPaymentModal] = useState<{
    suki: SukiCustomer;
    mode: 'payment' | 'charge';
  } | null>(null);
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');

  const filteredTransactions = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (salesPeriod === 'today') {
      return sorted.filter((tx) => isSameCalendarDay(tx.createdAt));
    }
    return sorted;
  }, [transactions, salesPeriod]);

  const salesSummary = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        acc.gross += tx.totalAmount;
        acc.profit += tx.totalProfit;
        if (tx.paymentMethod === 'cash') acc.cash += tx.totalAmount;
        else acc.utang += tx.totalAmount;
        return acc;
      },
      { gross: 0, profit: 0, cash: 0, utang: 0 }
    );
  }, [filteredTransactions]);

  const totalUtangReceivable = useMemo(
    () => sukis.reduce((sum, s) => sum + Math.max(0, s.balance), 0),
    [sukis]
  );

  const sortedSukis = useMemo(() => {
    return [...sukis].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  }, [sukis]);

  const handleSaveSuki = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sukiName.trim()) return;
    onAddSuki({
      name: sukiName.trim(),
      phone: sukiPhone.trim() || undefined,
      addressNote: sukiNote.trim() || undefined,
    });
    setSukiName('');
    setSukiPhone('');
    setSukiNote('');
    setSukiModalOpen(false);
  };

  const openEntryModal = (suki: SukiCustomer, mode: 'payment' | 'charge') => {
    setPaymentModal({ suki, mode });
    setEntryAmount(mode === 'payment' ? String(suki.balance) : '');
    setEntryNote(mode === 'payment' ? 'Cash payment' : '');
  };

  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;
    const amt = parseFloat(entryAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    if (paymentModal.mode === 'payment') {
      onRecordUtangPayment(
        paymentModal.suki.id,
        amt,
        entryNote.trim() || 'Payment received'
      );
    } else {
      onRecordManualUtang(
        paymentModal.suki.id,
        amt,
        entryNote.trim() || 'Manual listahan entry'
      );
    }
    setPaymentModal(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-2 sm:inline-flex p-1 bg-[#EDEAE3] rounded-xl">
          <button
            type="button"
            onClick={() => setSection('sales')}
            className={`min-h-[40px] px-4 rounded-lg text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap ${
              section === 'sales'
                ? 'bg-white text-[#181715] shadow-xs'
                : 'text-[#64615B] hover:text-[#181715]'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Sales History</span>
          </button>
          <button
            type="button"
            onClick={() => setSection('utang')}
            className={`min-h-[40px] px-4 rounded-lg text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap ${
              section === 'utang'
                ? 'bg-white text-[#181715] shadow-xs'
                : 'text-[#64615B] hover:text-[#181715]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Utang Listahan ({sukis.filter((s) => s.balance > 0).length})</span>
          </button>
        </div>

        {section === 'sales' ? (
          <div className="flex items-center p-1 bg-[#EDEAE3] rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSalesPeriod('today')}
              className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                salesPeriod === 'today'
                  ? 'bg-white text-[#181715] shadow-xs'
                  : 'text-[#64615B] hover:text-[#181715]'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSalesPeriod('all')}
              className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                salesPeriod === 'all'
                  ? 'bg-white text-[#181715] shadow-xs'
                  : 'text-[#64615B] hover:text-[#181715]'
              }`}
            >
              All Time
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSukiModalOpen(true)}
            className="min-h-[44px] px-4 rounded-xl bg-[#0F766E] text-white text-xs sm:text-sm font-semibold hover:bg-[#0D655E] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Suki Account</span>
          </button>
        )}
      </div>

      {section === 'sales' ? (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-[#E6E4DF] rounded-2xl p-4">
              <p className="text-xs text-[#64615B]">
                {salesPeriod === 'today' ? "Today's Revenue" : 'All-Time Revenue'}
              </p>
              <p className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-[#181715] mt-1">
                {formatPesoExact(salesSummary.gross)}
              </p>
            </div>
            <div className="bg-white border border-[#E6E4DF] rounded-2xl p-4">
              <p className="text-xs text-[#64615B]">Estimated Profit</p>
              <p className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-[#0F766E] mt-1">
                {formatPesoExact(salesSummary.profit)}
              </p>
            </div>
            <div className="bg-white border border-[#E6E4DF] rounded-2xl p-4">
              <p className="text-xs text-[#64615B]">Cash Collected</p>
              <p className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-[#181715] mt-1">
                {formatPesoExact(salesSummary.cash)}
              </p>
            </div>
            <div className="bg-white border border-[#E6E4DF] rounded-2xl p-4">
              <p className="text-xs text-[#64615B]">Charged to Utang</p>
              <p className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-[#B45309] mt-1">
                {formatPesoExact(salesSummary.utang)}
              </p>
            </div>
          </div>

          {/* Transaction List */}
          {filteredTransactions.length === 0 ? (
            <div className="bg-white border border-[#E6E4DF] rounded-2xl p-8 text-center">
              <Receipt className="w-8 h-8 text-[#9E9A91] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#181715]">No recorded sales yet</p>
              <p className="text-xs text-[#64615B] mt-1">
                Sales recorded in the Counter tab will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E6E4DF] rounded-2xl divide-y divide-[#ECEAE4]">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64615B]">
                        <span className="font-medium text-[#181715]">
                          {formatDateTimeShort(tx.createdAt)}
                        </span>
                        <span aria-hidden="true">·</span>
                        {tx.paymentMethod === 'cash' ? (
                          <span className="font-semibold text-[#0F766E]">Cash</span>
                        ) : (
                          <span className="font-semibold text-[#B45309]">
                            Utang · {tx.sukiName ?? 'Suki'}
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {tx.items.reduce((s, i) => s + i.quantity, 0)} items
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-mono font-bold tabular-nums text-[#181715]">
                        {formatPesoExact(tx.totalAmount)}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-[#0F766E]">
                        +{formatPesoExact(tx.totalProfit)} profit
                      </p>
                    </div>
                  </div>

                  {/* Line Items Summary */}
                  <div className="text-xs text-[#64615B] space-y-1">
                    {tx.items.map((item, idx) => (
                      <div
                        key={`${tx.id}-${item.productId}-${idx}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          <span className="font-mono font-semibold text-[#181715] tabular-nums">
                            {item.quantity}×
                          </span>{' '}
                          {item.name}
                        </span>
                        <span className="font-mono tabular-nums shrink-0">
                          {formatPesoExact(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Cash Details / Void Action */}
                  <div className="pt-1 flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#64615B] font-mono tabular-nums">
                      {tx.paymentMethod === 'cash'
                        ? `Paid ${formatPesoExact(tx.amountTendered)} · Sukli ${formatPesoExact(
                            tx.changeDue
                          )}`
                        : tx.note || 'Added to suki listahan'}
                    </span>

                    {confirmVoidId === tx.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmVoidId(null)}
                          className="min-h-[34px] px-2.5 rounded-lg border border-[#E6E4DF] text-[#64615B] hover:text-[#181715]"
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onVoidTransaction(tx.id);
                            setConfirmVoidId(null);
                          }}
                          className="min-h-[34px] px-2.5 rounded-lg bg-[#BE123C] text-white font-semibold"
                        >
                          Void & Restore Stock
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmVoidId(tx.id)}
                        className="min-h-[34px] px-2 rounded-lg text-[#64615B] hover:text-[#BE123C] inline-flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Void</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Utang Summary Card */}
          <div className="bg-white border border-[#E6E4DF] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[#64615B]">Total Collectible Utang</p>
              <p className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-[#B45309] mt-1">
                {formatPesoExact(totalUtangReceivable)}
              </p>
            </div>
            <p className="text-xs text-[#64615B]">
              {sukis.filter((s) => s.balance > 0).length} suki customers with open balances
            </p>
          </div>

          {sortedSukis.length === 0 ? (
            <div className="bg-white border border-[#E6E4DF] rounded-2xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-[#9E9A91] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#181715]">No suki accounts yet</p>
              <p className="text-xs text-[#64615B] mt-1 mb-4">
                Replace your paper notebook by adding regular neighbors who buy on credit.
              </p>
              <button
                type="button"
                onClick={() => setSukiModalOpen(true)}
                className="min-h-[44px] px-5 rounded-xl bg-[#0F766E] text-white text-sm font-semibold"
              >
                Add Suki Customer
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#E6E4DF] rounded-2xl divide-y divide-[#ECEAE4]">
              {sortedSukis.map((suki) => {
                const isExpanded = expandedSukiId === suki.id;
                return (
                  <div key={suki.id} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-[#181715] truncate">
                          {suki.name}
                        </h3>
                        <p className="text-xs text-[#64615B] mt-0.5">
                          {suki.phone ? `${suki.phone} · ` : ''}
                          {suki.addressNote || 'Registered suki'}
                          {' · '}
                          Updated {formatDateTimeShort(suki.updatedAt)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-[#64615B]">Balance</p>
                          <p
                            className={`text-lg font-mono font-bold tabular-nums ${
                              suki.balance > 0 ? 'text-[#B45309]' : 'text-[#0F766E]'
                            }`}
                          >
                            {suki.balance > 0 ? formatPesoExact(suki.balance) : 'Settled (₱0)'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {suki.balance > 0 && (
                            <button
                              type="button"
                              onClick={() => openEntryModal(suki, 'payment')}
                              className="min-h-[40px] px-3.5 rounded-xl bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0D655E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>Bayad</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEntryModal(suki, 'charge')}
                            className="min-h-[40px] px-3 rounded-xl border border-[#E6E4DF] bg-white text-[#181715] text-xs font-semibold hover:bg-[#F3F1EC] transition-colors whitespace-nowrap"
                          >
                            + Utang
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSukiId(isExpanded ? null : suki.id)
                            }
                            aria-label={`Toggle history for ${suki.name}`}
                            className="min-h-[40px] min-w-[40px] rounded-xl border border-[#E6E4DF] flex items-center justify-center text-[#64615B] hover:text-[#181715]"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[#ECEAE4] space-y-2">
                        {suki.entries.length === 0 ? (
                          <p className="text-xs text-[#64615B]">No recorded entries yet.</p>
                        ) : (
                          [...suki.entries]
                            .sort(
                              (a, b) =>
                                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            )
                            .map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-start justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="text-[#181715] font-medium truncate">
                                    {entry.note}
                                  </p>
                                  <p className="text-[#64615B]">
                                    {formatDateTimeShort(entry.createdAt)}
                                  </p>
                                </div>
                                <span
                                  className={`font-mono font-semibold tabular-nums shrink-0 ${
                                    entry.type === 'payment'
                                      ? 'text-[#0F766E]'
                                      : 'text-[#B45309]'
                                  }`}
                                >
                                  {entry.type === 'payment' ? '-' : '+'}
                                  {formatPeso(entry.amount)}
                                </span>
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Suki Modal */}
      <ModalSheet
        open={sukiModalOpen}
        onClose={() => setSukiModalOpen(false)}
        title="Add Suki Account"
        subtitle="Track neighbor credit cleanly without losing paper notes"
        footer={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSukiModalOpen(false)}
              className="flex-1 min-h-[44px] rounded-xl border border-[#E6E4DF] bg-white text-sm font-medium text-[#181715]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-suki-form"
              className="flex-1 min-h-[44px] rounded-xl bg-[#0F766E] text-white text-sm font-semibold"
            >
              Save Suki
            </button>
          </div>
        }
      >
        <form id="add-suki-form" onSubmit={handleSaveSuki} className="space-y-4">
          <div>
            <label htmlFor="suki-name" className="block text-sm font-medium text-[#181715] mb-1.5">
              Customer Name
            </label>
            <input
              id="suki-name"
              type="text"
              required
              value={sukiName}
              onChange={(e) => setSukiName(e.target.value)}
              placeholder="e.g., Kuya Joel (Purok 2)"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>
          <div>
            <label htmlFor="suki-phone" className="block text-sm font-medium text-[#181715] mb-1.5">
              Mobile Number (Optional)
            </label>
            <input
              id="suki-phone"
              type="tel"
              value={sukiPhone}
              onChange={(e) => setSukiPhone(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>
          <div>
            <label htmlFor="suki-note" className="block text-sm font-medium text-[#181715] mb-1.5">
              Address or Note (Optional)
            </label>
            <input
              id="suki-note"
              type="text"
              value={sukiNote}
              onChange={(e) => setSukiNote(e.target.value)}
              placeholder="e.g., Blue gate near basketball court"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>
        </form>
      </ModalSheet>

      {/* Bayad / Manual Utang Modal */}
      <ModalSheet
        open={Boolean(paymentModal)}
        onClose={() => setPaymentModal(null)}
        title={
          paymentModal?.mode === 'payment'
            ? `Record Payment · ${paymentModal.suki.name}`
            : `Add Utang · ${paymentModal?.suki.name ?? ''}`
        }
        subtitle={
          paymentModal
            ? `Current balance: ${formatPesoExact(paymentModal.suki.balance)}`
            : undefined
        }
        footer={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaymentModal(null)}
              className="flex-1 min-h-[44px] rounded-xl border border-[#E6E4DF] bg-white text-sm font-medium text-[#181715]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="utang-entry-form"
              className={`flex-1 min-h-[44px] rounded-xl text-white text-sm font-semibold ${
                paymentModal?.mode === 'payment' ? 'bg-[#0F766E]' : 'bg-[#B45309]'
              }`}
            >
              {paymentModal?.mode === 'payment' ? 'Save Payment' : 'Add to Listahan'}
            </button>
          </div>
        }
      >
        <form id="utang-entry-form" onSubmit={handleEntrySubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="entry-amt" className="text-sm font-medium text-[#181715]">
                Amount
              </label>
              {paymentModal?.mode === 'payment' && (
                <button
                  type="button"
                  onClick={() => setEntryAmount(String(paymentModal.suki.balance))}
                  className="text-xs font-semibold text-[#0F766E] hover:underline"
                >
                  Pay Full ({formatPesoExact(paymentModal.suki.balance)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#64615B] font-mono">
                ₱
              </span>
              <input
                id="entry-amt"
                type="number"
                step="0.25"
                min="0.25"
                max={
                  paymentModal?.mode === 'payment' ? paymentModal.suki.balance : undefined
                }
                required
                inputMode="decimal"
                value={entryAmount}
                onChange={(e) => setEntryAmount(e.target.value)}
                className="w-full min-h-[44px] pl-8 pr-3 rounded-xl border border-[#DEDBD4] text-base font-mono font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="entry-note" className="block text-sm font-medium text-[#181715] mb-1.5">
              Note
            </label>
            <input
              id="entry-note"
              type="text"
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder={
                paymentModal?.mode === 'payment'
                  ? 'e.g., Partial payment via GCash'
                  : 'e.g., 2x Coke Mismo & Bread'
              }
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>
        </form>
      </ModalSheet>
    </div>
  );
}
