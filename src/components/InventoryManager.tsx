import React, { useMemo, useState } from 'react';
import { Search, Plus, Pencil, AlertTriangle, PackagePlus } from 'lucide-react';
import { Product, STORE_CATEGORIES } from '../types/store';
import { formatPeso, formatPesoExact } from '../utils/storage';

interface InventoryManagerProps {
  products: Product[];
  onOpenAdd: () => void;
  onOpenEdit: (product: Product) => void;
  onAdjustStock: (productId: string, delta: number) => void;
}

type StockFilter = 'all' | 'low' | 'out';

export function InventoryManager({
  products,
  onOpenAdd,
  onOpenEdit,
  onAdjustStock,
}: InventoryManagerProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  const stats = useMemo(() => {
    const totalSkus = products.length;
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const totalRetailValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
    const lowStockCount = products.filter(
      (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
    ).length;
    const outOfStockCount = products.filter((p) => p.stock === 0).length;
    return { totalSkus, totalUnits, totalRetailValue, lowStockCount, outOfStockCount };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
        if (stockFilter === 'low' && !(p.stock > 0 && p.stock <= p.lowStockThreshold)) {
          return false;
        }
        if (stockFilter === 'out' && p.stock !== 0) return false;
        if (!q) return true;
        return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Surface out of stock and low stock first when viewing all
        const aScore = a.stock === 0 ? 0 : a.stock <= a.lowStockThreshold ? 1 : 2;
        const bScore = b.stock === 0 ? 0 : b.stock <= b.lowStockThreshold ? 1 : 2;
        if (aScore !== bScore) return aScore - bScore;
        return a.name.localeCompare(b.name);
      });
  }, [products, search, categoryFilter, stockFilter]);

  return (
    <div className="space-y-4">
      {/* Top Inventory KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E6E4DF] rounded-2xl p-4">
          <p className="text-xs text-[#64615B]">Products (SKUs)</p>
          <p className="text-2xl font-mono font-bold tabular-nums text-[#181715] mt-1">
            {stats.totalSkus}
          </p>
          <p className="text-xs text-[#64615B] mt-0.5 tabular-nums">
            {stats.totalUnits} total units
          </p>
        </div>

        <div className="bg-white border border-[#E6E4DF] rounded-2xl p-4">
          <p className="text-xs text-[#64615B]">Stock Retail Value</p>
          <p className="text-2xl font-mono font-bold tabular-nums text-[#181715] mt-1">
            {formatPeso(stats.totalRetailValue)}
          </p>
          <p className="text-xs text-[#64615B] mt-0.5">Estimated shelf value</p>
        </div>

        <button
          type="button"
          onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          className={`text-left bg-white border rounded-2xl p-4 transition-colors ${
            stockFilter === 'low' ? 'border-[#B45309] ring-1 ring-[#B45309]/25' : 'border-[#E6E4DF]'
          }`}
        >
          <p className="text-xs text-[#64615B]">Low Stock Alerts</p>
          <p className="text-2xl font-mono font-bold tabular-nums text-[#B45309] mt-1">
            {stats.lowStockCount}
          </p>
          <p className="text-xs text-[#64615B] mt-0.5">Tap to filter low items</p>
        </button>

        <button
          type="button"
          onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
          className={`text-left bg-white border rounded-2xl p-4 transition-colors ${
            stockFilter === 'out' ? 'border-[#BE123C] ring-1 ring-[#BE123C]/25' : 'border-[#E6E4DF]'
          }`}
        >
          <p className="text-xs text-[#64615B]">Out of Stock</p>
          <p className="text-2xl font-mono font-bold tabular-nums text-[#BE123C] mt-1">
            {stats.outOfStockCount}
          </p>
          <p className="text-xs text-[#64615B] mt-0.5">Tap to filter empty items</p>
        </button>
      </div>

      {/* Toolbar: Search + Status Segmented + Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#64615B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find product to edit price or restock..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-[#E6E4DF] bg-white text-sm text-[#181715] placeholder:text-[#9E9A91] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-[#EDEAE3] rounded-xl">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'low', label: 'Low' },
                { key: 'out', label: 'Out' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStockFilter(opt.key)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  stockFilter === opt.key
                    ? 'bg-white text-[#181715] shadow-xs'
                    : 'text-[#64615B] hover:text-[#181715]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenAdd}
            className="min-h-[44px] px-4 rounded-xl bg-[#0F766E] text-white text-xs sm:text-sm font-semibold hover:bg-[#0D655E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Category Filter Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {['All', ...STORE_CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              categoryFilter === cat
                ? 'bg-[#181715] text-white'
                : 'bg-white border border-[#E6E4DF] text-[#64615B] hover:text-[#181715]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product List */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-[#E6E4DF] rounded-2xl p-8 text-center">
          <PackagePlus className="w-8 h-8 text-[#9E9A91] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#181715]">No products match this view</p>
          <p className="text-xs text-[#64615B] mt-1">
            Clear filters or add a new paninda item.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E6E4DF] rounded-2xl divide-y divide-[#ECEAE4] overflow-hidden">
          {filteredProducts.map((product) => {
            const profitPerUnit = product.price - product.cost;
            const isOut = product.stock === 0;
            const isLow = !isOut && product.stock <= product.lowStockThreshold;

            return (
              <div
                key={product.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-semibold text-[#181715] truncate">
                      {product.name}
                    </h3>
                  </div>

                  {/* Unboxed clean metadata */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64615B]">
                    <span>{product.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#181715] font-semibold">
                      {formatPesoExact(product.price)} / {product.unit}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Cost {formatPesoExact(product.cost)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-mono tabular-nums font-medium ${
                        profitPerUnit >= 0 ? 'text-[#0F766E]' : 'text-[#BE123C]'
                      }`}
                    >
                      +{formatPesoExact(profitPerUnit)} profit
                    </span>
                  </div>
                </div>

                {/* Stock Count & Quick Restock Controls */}
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  <div className="text-left sm:text-right mr-2">
                    {isOut ? (
                      <span className="text-xs font-semibold text-[#BE123C] inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Out of stock (0)
                      </span>
                    ) : isLow ? (
                      <span className="text-xs font-semibold text-[#B45309] font-mono tabular-nums inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Low: {product.stock} {product.unit}
                      </span>
                    ) : (
                      <span className="text-sm font-mono font-bold tabular-nums text-[#181715]">
                        {product.stock}{' '}
                        <span className="text-xs font-sans font-normal text-[#64615B]">
                          {product.unit}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAdjustStock(product.id, -1)}
                      disabled={product.stock <= 0}
                      aria-label={`Decrease stock of ${product.name}`}
                      className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl border border-[#E6E4DF] bg-white hover:bg-[#F3F1EC] disabled:opacity-40 text-xs font-mono font-semibold text-[#181715] transition-colors"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdjustStock(product.id, 1)}
                      aria-label={`Add 1 stock to ${product.name}`}
                      className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl border border-[#E6E4DF] bg-white hover:bg-[#F3F1EC] text-xs font-mono font-semibold text-[#181715] transition-colors"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdjustStock(product.id, 10)}
                      aria-label={`Restock 10 units of ${product.name}`}
                      className="min-h-[40px] px-3 rounded-xl bg-[#F3F1EC] hover:bg-[#E7E4DC] text-xs font-mono font-semibold text-[#0F766E] transition-colors whitespace-nowrap"
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEdit(product)}
                      aria-label={`Edit ${product.name}`}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-[#E6E4DF] bg-white hover:bg-[#F3F1EC] flex items-center justify-center text-[#64615B] hover:text-[#181715] transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
