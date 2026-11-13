import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  CheckCircle2,
  UserPlus,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  CartItem,
  PaymentMethod,
  Product,
  STORE_CATEGORIES,
  SukiCustomer,
} from '../types/store';
import { formatPeso, formatPesoExact } from '../utils/storage';
import { ModalSheet } from './ModalSheet';

interface CounterPOSProps {
  products: Product[];
  sukis: SukiCustomer[];
  todaySalesTotal: number;
  todayOrderCount: number;
  onCompleteSale: (params: {
    items: CartItem[];
    paymentMethod: PaymentMethod;
    amountTendered: number;
    sukiId?: string;
    newSukiName?: string;
    note?: string;
  }) => void;
  onOpenAddProduct: () => void;
}

const QUICK_BILLS = [20, 50, 100, 200, 500, 1000];

export function CounterPOS({
  products,
  sukis,
  todaySalesTotal,
  todayOrderCount,
  onCompleteSale,
  onOpenAddProduct,
}: CounterPOSProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashInput, setCashInput] = useState<string>('');
  const [selectedSukiId, setSelectedSukiId] = useState<string>(sukis[0]?.id ?? '');
  const [addingNewSuki, setAddingNewSuki] = useState(sukis.length === 0);
  const [newSukiName, setNewSukiName] = useState('');
  const [note, setNote] = useState('');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    total: number;
    change: number;
    method: PaymentMethod;
    sukiName?: string;
  } | null>(null);

  const availableCategories = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    return ['All', ...STORE_CATEGORIES.filter((c) => present.has(c))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.unit.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.stock === 0 && b.stock > 0) return 1;
        if (b.stock === 0 && a.stock > 0) return -1;
        return a.name.localeCompare(b.name);
      });
  }, [products, search, selectedCategory]);

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => map.set(item.productId, item.quantity));
    return map;
  }, [cart]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setLastReceipt(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          price: product.price,
          cost: product.cost,
          quantity: 1,
        },
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    const maxStock = product?.stock ?? 9999;

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = Math.min(maxStock, item.quantity + delta);
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCashInput('');
    setNote('');
  };

  const parsedCash = cashInput.trim() === '' ? cartTotal : parseFloat(cashInput);
  const validCash = Number.isFinite(parsedCash) ? parsedCash : 0;
  const changeDue = Math.max(0, validCash - cartTotal);
  const isCashShort = paymentMethod === 'cash' && validCash < cartTotal;

  const canSubmit =
    cart.length > 0 &&
    (paymentMethod === 'cash'
      ? !isCashShort
      : addingNewSuki
      ? newSukiName.trim().length > 0
      : Boolean(selectedSukiId));

  const handleCheckout = () => {
    if (!canSubmit) return;
    const tendered = paymentMethod === 'cash' ? validCash : 0;
    const change = paymentMethod === 'cash' ? Math.max(0, tendered - cartTotal) : 0;
    const sukiName =
      paymentMethod === 'utang'
        ? addingNewSuki
          ? newSukiName.trim()
          : sukis.find((s) => s.id === selectedSukiId)?.name
        : undefined;

    onCompleteSale({
      items: cart,
      paymentMethod,
      amountTendered: tendered,
      sukiId: paymentMethod === 'utang' && !addingNewSuki ? selectedSukiId : undefined,
      newSukiName: paymentMethod === 'utang' && addingNewSuki ? newSukiName.trim() : undefined,
      note: note.trim() || undefined,
    });

    setLastReceipt({
      total: cartTotal,
      change,
      method: paymentMethod,
      sukiName,
    });
    setCart([]);
    setCashInput('');
    setNewSukiName('');
    setNote('');
    setMobileCartOpen(false);
  };

  const renderCartPanelContent = () => (
    <div className="flex flex-col h-full">
      {cart.length === 0 ? (
        <div className="py-10 text-center px-4">
          <ShoppingBag className="w-8 h-8 text-[#9E9A91] mx-auto mb-2.5" />
          <p className="text-sm font-semibold text-[#181715]">No items in current order</p>
          <p className="text-xs text-[#64615B] mt-1">
            Tap any product on the left to add it to the customer&apos;s order.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Line items */}
          <div className="divide-y divide-[#ECEAE4]">
            {cart.map((item) => {
              const product = products.find((p) => p.id === item.productId);
              const atMax = product ? item.quantity >= product.stock : false;

              return (
                <div key={item.productId} className="py-3 first:pt-0 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#181715] truncate">{item.name}</p>
                    <p className="text-xs text-[#64615B] font-mono tabular-nums mt-0.5">
                      {formatPeso(item.price)} / {item.unit} · Subtotal{' '}
                      <span className="text-[#181715] font-semibold">
                        {formatPesoExact(item.price * item.quantity)}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.productId, -1)}
                      aria-label={`Decrease ${item.name} quantity`}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-[#E6E4DF] bg-white hover:bg-[#F3F1EC] flex items-center justify-center text-[#181715] transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-mono font-bold tabular-nums text-[#181715]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.productId, 1)}
                      disabled={atMax}
                      aria-label={`Increase ${item.name} quantity`}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-[#E6E4DF] bg-white hover:bg-[#F3F1EC] disabled:opacity-40 flex items-center justify-center text-[#181715] transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      aria-label={`Remove ${item.name}`}
                      className="min-h-[40px] min-w-[40px] rounded-xl text-[#9E9A91] hover:text-[#BE123C] hover:bg-[#FFF1F2] flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment Method Switch */}
          <div className="pt-2 border-t border-[#ECEAE4]">
            <p className="text-xs font-medium text-[#64615B] mb-2">Payment Method</p>
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3F1EC] rounded-xl">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  paymentMethod === 'cash'
                    ? 'bg-white text-[#181715] shadow-xs'
                    : 'text-[#64615B] hover:text-[#181715]'
                }`}
              >
                Cash Payment
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('utang')}
                className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  paymentMethod === 'utang'
                    ? 'bg-white text-[#B45309] shadow-xs'
                    : 'text-[#64615B] hover:text-[#181715]'
                }`}
              >
                Utang (Listahan)
              </button>
            </div>
          </div>

          {/* Cash Sukli Calculator or Utang Suki Selector */}
          {paymentMethod === 'cash' ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="cash-received-input"
                    className="text-xs font-medium text-[#64615B]"
                  >
                    Cash Received (Bayad)
                  </label>
                  <button
                    type="button"
                    onClick={() => setCashInput(String(cartTotal))}
                    className="text-xs font-semibold text-[#0F766E] hover:underline"
                  >
                    Exact ({formatPeso(cartTotal)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#64615B] font-mono">
                    ₱
                  </span>
                  <input
                    id="cash-received-input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.25"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    placeholder={String(cartTotal)}
                    className="w-full min-h-[44px] pl-8 pr-3 rounded-xl border border-[#DEDBD4] bg-white text-[#181715] font-mono text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>
              </div>

              {/* Quick Bills */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_BILLS.map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => setCashInput(String(bill))}
                    className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-mono font-semibold tabular-nums transition-colors whitespace-nowrap ${
                      cashInput === String(bill)
                        ? 'border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]'
                        : 'border-[#E6E4DF] bg-white text-[#181715] hover:bg-[#F3F1EC]'
                    }`}
                  >
                    ₱{bill}
                  </button>
                ))}
              </div>

              {/* Sukli Display */}
              <div
                className={`p-3.5 rounded-xl flex items-center justify-between ${
                  isCashShort
                    ? 'bg-[#FFF1F2] text-[#BE123C]'
                    : 'bg-[#F3F1EC] text-[#181715]'
                }`}
              >
                <span className="text-xs font-semibold">
                  {isCashShort ? 'Insufficient cash' : 'Change (Sukli)'}
                </span>
                <span className="text-lg font-mono font-bold tabular-nums">
                  {isCashShort
                    ? `Short ${formatPesoExact(cartTotal - validCash)}`
                    : formatPesoExact(changeDue)}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64615B]">Select Suki Account</span>
                <button
                  type="button"
                  onClick={() => setAddingNewSuki(!addingNewSuki)}
                  className="text-xs font-semibold text-[#0F766E] inline-flex items-center gap-1 hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {addingNewSuki && sukis.length > 0 ? 'Choose Existing' : 'New Suki'}
                </button>
              </div>

              {addingNewSuki || sukis.length === 0 ? (
                <input
                  type="text"
                  value={newSukiName}
                  onChange={(e) => setNewSukiName(e.target.value)}
                  placeholder="Enter suki name (e.g., Ate Lisa)"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] bg-white text-sm text-[#181715] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                />
              ) : (
                <select
                  value={selectedSukiId}
                  onChange={(e) => setSelectedSukiId(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#DEDBD4] bg-white text-sm text-[#181715] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                >
                  {sukis.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Current balance: {formatPeso(s.balance)})
                    </option>
                  ))}
                </select>
              )}

              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note (e.g., Payday Friday)"
                className="w-full min-h-[40px] px-3.5 rounded-xl border border-[#DEDBD4] bg-white text-xs text-[#181715] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>
          )}

          {/* Total & Submit */}
          <div className="pt-3 border-t border-[#ECEAE4] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#64615B]">Total Amount</span>
              <span className="text-xl font-mono font-bold tabular-nums text-[#181715]">
                {formatPesoExact(cartTotal)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearCart}
                className="min-h-[48px] px-4 rounded-xl border border-[#E6E4DF] bg-white text-[#64615B] text-sm font-medium hover:text-[#181715] hover:bg-[#F3F1EC] transition-colors whitespace-nowrap"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleCheckout}
                className={`flex-1 min-h-[48px] px-4 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-45 whitespace-nowrap ${
                  paymentMethod === 'utang'
                    ? 'bg-[#B45309] hover:bg-[#92400E]'
                    : 'bg-[#0F766E] hover:bg-[#0D655E]'
                }`}
              >
                {paymentMethod === 'utang'
                  ? `Record Utang · ${formatPeso(cartTotal)}`
                  : `Complete Sale · ${formatPeso(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Compact Top Summary Bar + Receipt Confirmation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E6E4DF] rounded-2xl px-4 py-3.5">
        <div className="flex items-center justify-between sm:justify-start gap-6">
          <div>
            <p className="text-xs text-[#64615B]">Today&apos;s Sales</p>
            <p className="text-xl font-mono font-bold tabular-nums text-[#181715]">
              {formatPesoExact(todaySalesTotal)}
            </p>
          </div>
          <div className="h-8 w-px bg-[#ECEAE4]" />
          <div>
            <p className="text-xs text-[#64615B]">Orders</p>
            <p className="text-xl font-mono font-bold tabular-nums text-[#181715]">
              {todayOrderCount}
            </p>
          </div>
        </div>

        {lastReceipt && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-[#0F766E]/8 text-[#0F766E]">
            <div className="flex items-center gap-2 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {lastReceipt.method === 'utang'
                  ? `Utang recorded for ${lastReceipt.sukiName}: ${formatPesoExact(lastReceipt.total)}`
                  : `Sale recorded: ${formatPesoExact(lastReceipt.total)} · Sukli: ${formatPesoExact(
                      lastReceipt.change
                    )}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLastReceipt(null)}
              aria-label="Dismiss receipt notice"
              className="p-1 rounded-lg hover:bg-[#0F766E]/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Split Layout: Catalog (Left) + Live Order Cart (Right on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-3.5">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#64615B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search paninda (e.g., Kopiko, Coke, Rice)..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-[#E6E4DF] bg-white text-sm text-[#181715] placeholder:text-[#9E9A91] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>

          {/* Interactive Category Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-[#181715] text-white'
                    : 'bg-white border border-[#E6E4DF] text-[#64615B] hover:text-[#181715] hover:bg-[#F3F1EC]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Tap Grid */}
          {products.length === 0 ? (
            <div className="bg-white border border-[#E6E4DF] rounded-2xl p-8 text-center">
              <p className="text-base font-semibold text-[#181715]">Your store catalog is empty</p>
              <p className="text-sm text-[#64615B] mt-1 mb-4">
                Add your first sari-sari product to start ringing up sales.
              </p>
              <button
                type="button"
                onClick={onOpenAddProduct}
                className="min-h-[44px] px-5 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D655E] transition-colors"
              >
                Add First Product
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white border border-[#E6E4DF] rounded-2xl p-8 text-center">
              <p className="text-sm font-semibold text-[#181715]">No matching products</p>
              <p className="text-xs text-[#64615B] mt-1">
                Try another search term or switch category filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredProducts.map((product) => {
                const qtyInCart = cartQtyMap.get(product.id) ?? 0;
                const outOfStock = product.stock <= 0;
                const lowStock = !outOfStock && product.stock <= product.lowStockThreshold;
                const atLimit = qtyInCart >= product.stock;

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={outOfStock || atLimit}
                    onClick={() => addToCart(product)}
                    className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between min-h-[116px] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] ${
                      outOfStock
                        ? 'bg-[#F3F1EC]/70 border-[#E6E4DF] opacity-60 cursor-not-allowed'
                        : qtyInCart > 0
                        ? 'bg-white border-[#0F766E] ring-1 ring-[#0F766E]/25'
                        : 'bg-white border-[#E6E4DF] hover:border-[#C9C5BC]'
                    }`}
                  >
                    <div className="w-full">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#181715] leading-snug line-clamp-2">
                          {product.name}
                        </h3>
                        {qtyInCart > 0 && (
                          <span className="text-xs font-mono font-bold tabular-nums text-[#0F766E] shrink-0">
                            {qtyInCart}x
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 w-full">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-mono font-bold tabular-nums text-[#181715]">
                          {formatPeso(product.price)}
                        </span>
                        <span className="text-xs text-[#64615B]">/ {product.unit}</span>
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        {outOfStock ? (
                          <span className="font-medium text-[#BE123C]">Out of stock</span>
                        ) : lowStock ? (
                          <span className="inline-flex items-center gap-1 font-medium text-[#B45309] tabular-nums">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            Low · {product.stock} left
                          </span>
                        ) : (
                          <span className="text-[#64615B] tabular-nums">
                            {product.category} · {product.stock} left
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Right Column: Live Order Panel */}
        <aside className="hidden lg:block lg:col-span-5 bg-white border border-[#E6E4DF] rounded-2xl p-5 sticky top-20">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#ECEAE4]">
            <h2 className="text-base font-bold text-[#181715]">Current Order</h2>
            <span className="text-xs font-mono text-[#64615B] tabular-nums">
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          {renderCartPanelContent()}
        </aside>
      </div>

      {/* Mobile Compact Checkout Dock (only visible when cart has items, sits cleanly above 60px bottom nav) */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-[64px] left-3 right-3 z-30">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="w-full h-12 px-4 rounded-2xl bg-[#0F766E] text-white shadow-lg shadow-[#0F766E]/25 flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              <ShoppingBag className="w-4 h-4" />
              <span>
                View Order · {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
              </span>
            </div>
            <span className="font-mono font-bold text-base tabular-nums">
              {formatPesoExact(cartTotal)}
            </span>
          </button>
        </div>
      )}

      {/* Mobile Checkout Sheet */}
      <ModalSheet
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        title="Current Order & Sukli"
        subtitle={`${cartItemCount} ${cartItemCount === 1 ? 'item' : 'items'} ready for checkout`}
      >
        {renderCartPanelContent()}
      </ModalSheet>
    </div>
  );
}
