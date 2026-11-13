import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Category, Product, STORE_CATEGORIES } from '../types/store';
import { ModalSheet } from './ModalSheet';
import { formatPesoExact } from '../utils/storage';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  onSave: (data: Omit<Product, 'id' | 'updatedAt'>, existingId?: string) => void;
  onDelete?: (id: string) => void;
}

const COMMON_UNITS = ['pc', 'sachet', 'pack', 'bottle', 'can', 'kg', 'bar', 'pouch', 'load'];

export function ProductFormModal({
  open,
  onClose,
  editingProduct,
  onSave,
  onDelete,
}: ProductFormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Sachets');
  const [unit, setUnit] = useState('pc');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setConfirmDelete(false);
    if (editingProduct) {
      setName(editingProduct.name);
      setCategory(editingProduct.category);
      setUnit(editingProduct.unit);
      setPrice(String(editingProduct.price));
      setCost(String(editingProduct.cost));
      setStock(String(editingProduct.stock));
      setLowStockThreshold(String(editingProduct.lowStockThreshold));
    } else {
      setName('');
      setCategory('Sachets');
      setUnit('pc');
      setPrice('');
      setCost('');
      setStock('12');
      setLowStockThreshold('5');
    }
  }, [open, editingProduct]);

  const parsedPrice = parseFloat(price);
  const parsedCost = parseFloat(cost);
  const estimatedMargin =
    Number.isFinite(parsedPrice) && Number.isFinite(parsedCost)
      ? parsedPrice - parsedCost
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a product name.');
      return;
    }
    const numPrice = parseFloat(price);
    const numCost = cost.trim() === '' ? 0 : parseFloat(cost);
    const numStock = parseInt(stock, 10);
    const numThreshold = parseInt(lowStockThreshold, 10);

    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      setError('Selling price must be greater than ₱0.');
      return;
    }
    if (!Number.isFinite(numCost) || numCost < 0) {
      setError('Cost price cannot be negative.');
      return;
    }
    if (!Number.isFinite(numStock) || numStock < 0) {
      setError('Stock quantity must be 0 or higher.');
      return;
    }

    onSave(
      {
        name: trimmedName,
        category,
        unit: unit.trim() || 'pc',
        price: Math.round(numPrice * 100) / 100,
        cost: Math.round(numCost * 100) / 100,
        stock: numStock,
        lowStockThreshold: Number.isFinite(numThreshold) && numThreshold >= 0 ? numThreshold : 5,
      },
      editingProduct?.id
    );
    onClose();
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={editingProduct ? 'Edit Product' : 'Add New Product'}
      subtitle={
        editingProduct
          ? 'Update price, puhunan cost, or stock count'
          : 'Add a paninda item to your TindaTech catalog'
      }
      footer={
        <div className="flex items-center gap-3">
          {editingProduct && onDelete && (
            <>
              {confirmDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(editingProduct.id);
                    onClose();
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#BE123C] text-white text-sm font-semibold hover:bg-[#9F1239] transition-colors whitespace-nowrap shrink-0"
                >
                  Confirm Delete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete product"
                  className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-[#E6E4DF] text-[#BE123C] hover:bg-[#FFF1F2] transition-colors flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E6E4DF] bg-white text-[#181715] text-sm font-medium hover:bg-[#F3F1EC] transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-form"
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D655E] transition-colors whitespace-nowrap"
          >
            {editingProduct ? 'Save Changes' : 'Save Product'}
          </button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C] text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="prod-name" className="block text-sm font-medium text-[#181715] mb-1.5">
            Product Name
          </label>
          <input
            id="prod-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Kopiko Brown Twin Pack"
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] bg-white text-[#181715] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-cat" className="block text-sm font-medium text-[#181715] mb-1.5">
              Category
            </label>
            <select
              id="prod-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#DEDBD4] bg-white text-[#181715] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            >
              {STORE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prod-unit" className="block text-sm font-medium text-[#181715] mb-1.5">
              Unit
            </label>
            <select
              id="prod-unit"
              value={COMMON_UNITS.includes(unit) ? unit : 'pc'}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#DEDBD4] bg-white text-[#181715] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            >
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-price" className="block text-sm font-medium text-[#181715] mb-1.5">
              Selling Price (Presyo)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#64615B] font-mono">
                ₱
              </span>
              <input
                id="prod-price"
                type="number"
                step="0.25"
                min="0"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] pl-8 pr-3 rounded-xl border border-[#DEDBD4] bg-white text-[#181715] text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="prod-cost" className="block text-sm font-medium text-[#181715] mb-1.5">
              Cost Price (Puhunan)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#64615B] font-mono">
                ₱
              </span>
              <input
                id="prod-cost"
                type="number"
                step="0.25"
                min="0"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] pl-8 pr-3 rounded-xl border border-[#DEDBD4] bg-white text-[#181715] text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>
          </div>
        </div>

        {estimatedMargin !== null && (
          <div className="px-3.5 py-2.5 rounded-xl bg-[#F3F1EC] flex items-center justify-between text-xs">
            <span className="text-[#64615B]">Estimated profit per {unit}</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                estimatedMargin >= 0 ? 'text-[#0F766E]' : 'text-[#BE123C]'
              }`}
            >
              {estimatedMargin >= 0 ? '+' : ''}
              {formatPesoExact(estimatedMargin)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-stock" className="block text-sm font-medium text-[#181715] mb-1.5">
              Current Stock
            </label>
            <input
              id="prod-stock"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] bg-white text-[#181715] text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>

          <div>
            <label htmlFor="prod-alert" className="block text-sm font-medium text-[#181715] mb-1.5">
              Low Stock Alert At
            </label>
            <input
              id="prod-alert"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DEDBD4] bg-white text-[#181715] text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>
        </div>
      </form>
    </ModalSheet>
  );
}
