import React, { useEffect, useMemo, useState } from 'react';
import {
  Store,
  Package,
  BookOpen,
  BarChart3,
  Plus,
} from 'lucide-react';
import {
  CartItem,
  PaymentMethod,
  Product,
  SaleTransaction,
  StoreSettings,
  StoreState,
  SukiCustomer,
  TabKey,
} from './types/store';
import {
  createEmptyStoreState,
  createStarterStoreState,
} from './data/defaultStoreData';
import {
  generateId,
  isSameCalendarDay,
  loadStoreState,
  saveStoreState,
} from './utils/storage';
import { CounterPOS } from './components/CounterPOS';
import { InventoryManager } from './components/InventoryManager';
import { LedgerView } from './components/LedgerView';
import { SummaryView } from './components/SummaryView';
import { ProductFormModal } from './components/ProductFormModal';

const NAV_ITEMS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'counter', label: 'Counter', icon: Store },
  { key: 'stocks', label: 'Stocks', icon: Package },
  { key: 'ledger', label: 'Ledger', icon: BookOpen },
  { key: 'summary', label: 'Summary', icon: BarChart3 },
];

export default function App() {
  const [storeState, setStoreState] = useState<StoreState>(() => loadStoreState());
  const [activeTab, setActiveTab] = useState<TabKey>('counter');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    saveStoreState(storeState);
  }, [storeState]);

  const todaySalesStats = useMemo(() => {
    const todayTx = storeState.transactions.filter((tx) => isSameCalendarDay(tx.createdAt));
    return {
      total: todayTx.reduce((sum, tx) => sum + tx.totalAmount, 0),
      count: todayTx.length,
    };
  }, [storeState.transactions]);

  const lowStockCount = useMemo(
    () =>
      storeState.products.filter((p) => p.stock <= p.lowStockThreshold).length,
    [storeState.products]
  );

  const openUtangCount = useMemo(
    () => storeState.sukis.filter((s) => s.balance > 0).length,
    [storeState.sukis]
  );

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductModalOpen(true);
  };

  const handleSaveProduct = (
    data: Omit<Product, 'id' | 'updatedAt'>,
    existingId?: string
  ) => {
    const now = new Date().toISOString();
    setStoreState((prev) => {
      if (existingId) {
        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === existingId ? { ...p, ...data, updatedAt: now } : p
          ),
        };
      }
      const newProduct: Product = {
        ...data,
        id: generateId('prod'),
        updatedAt: now,
      };
      return {
        ...prev,
        products: [newProduct, ...prev.products],
      };
    });
  };

  const handleDeleteProduct = (id: string) => {
    setStoreState((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
  };

  const handleAdjustStock = (productId: string, delta: number) => {
    const now = new Date().toISOString();
    setStoreState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId
          ? { ...p, stock: Math.max(0, p.stock + delta), updatedAt: now }
          : p
      ),
    }));
  };

  const handleCompleteSale = ({
    items,
    paymentMethod,
    amountTendered,
    sukiId,
    newSukiName,
    note,
  }: {
    items: CartItem[];
    paymentMethod: PaymentMethod;
    amountTendered: number;
    sukiId?: string;
    newSukiName?: string;
    note?: string;
  }) => {
    const now = new Date().toISOString();
    const txId = generateId('tx');

    const lineItems = items.map((item) => ({
      productId: item.productId,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.price,
      unitCost: item.cost,
      subtotal: item.price * item.quantity,
    }));

    const totalAmount = lineItems.reduce((sum, i) => sum + i.subtotal, 0);
    const totalCost = lineItems.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
    const totalProfit = totalAmount - totalCost;
    const changeDue = paymentMethod === 'cash' ? Math.max(0, amountTendered - totalAmount) : 0;

    setStoreState((prev) => {
      // 1. Deduct stock
      const qtyById = new Map<string, number>();
      items.forEach((i) => qtyById.set(i.productId, i.quantity));
      const updatedProducts = prev.products.map((p) => {
        const sold = qtyById.get(p.id);
        if (!sold) return p;
        return {
          ...p,
          stock: Math.max(0, p.stock - sold),
          updatedAt: now,
        };
      });

      // 2. Resolve Suki if Utang
      let resolvedSukiId = sukiId;
      let resolvedSukiName = prev.sukis.find((s) => s.id === sukiId)?.name;
      let updatedSukis = [...prev.sukis];

      if (paymentMethod === 'utang') {
        const summaryNote =
          note ||
          lineItems.map((i) => `${i.quantity}x ${i.name}`).join(', ');

        if (newSukiName) {
          resolvedSukiId = generateId('suki');
          resolvedSukiName = newSukiName;
          const createdSuki: SukiCustomer = {
            id: resolvedSukiId,
            name: newSukiName,
            balance: totalAmount,
            updatedAt: now,
            entries: [
              {
                id: generateId('ut'),
                createdAt: now,
                type: 'charge',
                amount: totalAmount,
                note: summaryNote,
                transactionId: txId,
              },
            ],
          };
          updatedSukis = [createdSuki, ...updatedSukis];
        } else if (resolvedSukiId) {
          updatedSukis = updatedSukis.map((s) => {
            if (s.id !== resolvedSukiId) return s;
            return {
              ...s,
              balance: Math.round((s.balance + totalAmount) * 100) / 100,
              updatedAt: now,
              entries: [
                ...s.entries,
                {
                  id: generateId('ut'),
                  createdAt: now,
                  type: 'charge',
                  amount: totalAmount,
                  note: summaryNote,
                  transactionId: txId,
                },
              ],
            };
          });
        }
      }

      const newTx: SaleTransaction = {
        id: txId,
        createdAt: now,
        items: lineItems,
        totalAmount,
        totalCost,
        totalProfit,
        paymentMethod,
        amountTendered,
        changeDue,
        sukiId: resolvedSukiId,
        sukiName: resolvedSukiName,
        note,
      };

      return {
        ...prev,
        products: updatedProducts,
        sukis: updatedSukis,
        transactions: [newTx, ...prev.transactions],
      };
    });
  };

  const handleVoidTransaction = (txId: string) => {
    const now = new Date().toISOString();
    setStoreState((prev) => {
      const target = prev.transactions.find((t) => t.id === txId);
      if (!target) return prev;

      const restoreMap = new Map<string, number>();
      target.items.forEach((item) => {
        restoreMap.set(
          item.productId,
          (restoreMap.get(item.productId) ?? 0) + item.quantity
        );
      });

      const updatedProducts = prev.products.map((p) => {
        const restoreQty = restoreMap.get(p.id);
        if (!restoreQty) return p;
        return { ...p, stock: p.stock + restoreQty, updatedAt: now };
      });

      let updatedSukis = prev.sukis;
      if (target.paymentMethod === 'utang' && target.sukiId) {
        updatedSukis = prev.sukis.map((s) => {
          if (s.id !== target.sukiId) return s;
          return {
            ...s,
            balance: Math.max(0, Math.round((s.balance - target.totalAmount) * 100) / 100),
            updatedAt: now,
            entries: s.entries.filter((e) => e.transactionId !== txId),
          };
        });
      }

      return {
        ...prev,
        products: updatedProducts,
        sukis: updatedSukis,
        transactions: prev.transactions.filter((t) => t.id !== txId),
      };
    });
  };

  const handleAddSuki = ({
    name,
    phone,
    addressNote,
  }: {
    name: string;
    phone?: string;
    addressNote?: string;
  }) => {
    const now = new Date().toISOString();
    const newSuki: SukiCustomer = {
      id: generateId('suki'),
      name,
      phone,
      addressNote,
      balance: 0,
      updatedAt: now,
      entries: [],
    };
    setStoreState((prev) => ({
      ...prev,
      sukis: [newSuki, ...prev.sukis],
    }));
  };

  const handleRecordUtangPayment = (sukiId: string, amount: number, note: string) => {
    const now = new Date().toISOString();
    setStoreState((prev) => ({
      ...prev,
      sukis: prev.sukis.map((s) => {
        if (s.id !== sukiId) return s;
        return {
          ...s,
          balance: Math.max(0, Math.round((s.balance - amount) * 100) / 100),
          updatedAt: now,
          entries: [
            ...s.entries,
            {
              id: generateId('ut'),
              createdAt: now,
              type: 'payment',
              amount,
              note,
            },
          ],
        };
      }),
    }));
  };

  const handleRecordManualUtang = (sukiId: string, amount: number, note: string) => {
    const now = new Date().toISOString();
    setStoreState((prev) => ({
      ...prev,
      sukis: prev.sukis.map((s) => {
        if (s.id !== sukiId) return s;
        return {
          ...s,
          balance: Math.round((s.balance + amount) * 100) / 100,
          updatedAt: now,
          entries: [
            ...s.entries,
            {
              id: generateId('ut'),
              createdAt: now,
              type: 'charge',
              amount,
              note,
            },
          ],
        };
      }),
    }));
  };

  const handleUpdateSettings = (settings: StoreSettings) => {
    setStoreState((prev) => ({ ...prev, settings }));
  };

  const sectionSubtitle = useMemo(() => {
    const parts = [`${storeState.products.length} products`];
    if (lowStockCount > 0) parts.push(`${lowStockCount} low stock`);
    if (openUtangCount > 0) parts.push(`${openUtangCount} open utang`);
    return parts.join(' · ');
  }, [storeState.products.length, lowStockCount, openUtangCount]);

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#181715]">
      {/* Top Bar: Follows 3-zone contract on desktop, compact bar on mobile */}
      <header className="bg-white/95 backdrop-blur-md border-b border-[#E6E4DF] md:sticky md:top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('counter')}
            className="font-display text-xl font-extrabold tracking-tight text-[#181715] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded-lg"
          >
            TindaTech
          </button>

          {/* Zone 2: Clean single-line text nav links (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'text-[#0F766E] border-[#0F766E]'
                      : 'text-[#64615B] border-transparent hover:text-[#181715]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleOpenAddProduct}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0F766E] text-white text-xs sm:text-sm font-semibold hover:bg-[#0D655E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-32 md:pb-12">
        {/* Store Identity & Contextual Metadata */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#181715]">
              {storeState.settings.storeName}
            </h1>
            <p className="text-xs sm:text-sm text-[#64615B] mt-0.5">
              {storeState.settings.ownerName} · {sectionSubtitle}
            </p>
          </div>
        </div>

        {activeTab === 'counter' && (
          <CounterPOS
            products={storeState.products}
            sukis={storeState.sukis}
            todaySalesTotal={todaySalesStats.total}
            todayOrderCount={todaySalesStats.count}
            onCompleteSale={handleCompleteSale}
            onOpenAddProduct={handleOpenAddProduct}
          />
        )}

        {activeTab === 'stocks' && (
          <InventoryManager
            products={storeState.products}
            onOpenAdd={handleOpenAddProduct}
            onOpenEdit={handleOpenEditProduct}
            onAdjustStock={handleAdjustStock}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerView
            transactions={storeState.transactions}
            sukis={storeState.sukis}
            onVoidTransaction={handleVoidTransaction}
            onAddSuki={handleAddSuki}
            onRecordUtangPayment={handleRecordUtangPayment}
            onRecordManualUtang={handleRecordManualUtang}
          />
        )}

        {activeTab === 'summary' && (
          <SummaryView
            storeState={storeState}
            onUpdateSettings={handleUpdateSettings}
            onImportState={(imported) => setStoreState(imported)}
            onResetStarter={() => setStoreState(createStarterStoreState())}
            onClearEmpty={() => setStoreState(createEmptyStoreState())}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Thumb-Zone Ergonomics) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E6E4DF] pb-safe"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-4 h-[60px]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-[#0F766E]' : 'text-[#64615B] hover:text-[#181715]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Add / Edit Product Bottom Sheet Modal */}
      <ProductFormModal
        open={productModalOpen}
        onClose={() => {
          setProductModalOpen(false);
          setEditingProduct(null);
        }}
        editingProduct={editingProduct}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
      />
    </div>
  );
}
