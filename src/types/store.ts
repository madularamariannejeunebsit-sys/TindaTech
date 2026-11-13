export type Category =
  | 'Beverages'
  | 'Sachets'
  | 'Snacks'
  | 'Canned & Instant'
  | 'Rice & Cooking'
  | 'Personal Care'
  | 'Load & Services'
  | 'Others';

export const STORE_CATEGORIES: Category[] = [
  'Beverages',
  'Sachets',
  'Snacks',
  'Canned & Instant',
  'Rice & Cooking',
  'Personal Care',
  'Load & Services',
  'Others',
];

export type TabKey = 'counter' | 'stocks' | 'ledger' | 'summary';

export interface Product {
  id: string;
  name: string;
  category: Category;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  unit: string;
  price: number;
  cost: number;
  quantity: number;
}

export interface SaleLineItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'utang';

export interface SaleTransaction {
  id: string;
  createdAt: string;
  items: SaleLineItem[];
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  changeDue: number;
  sukiId?: string;
  sukiName?: string;
  note?: string;
}

export interface UtangEntry {
  id: string;
  createdAt: string;
  type: 'charge' | 'payment';
  amount: number;
  note: string;
  transactionId?: string;
}

export interface SukiCustomer {
  id: string;
  name: string;
  phone?: string;
  addressNote?: string;
  balance: number;
  updatedAt: string;
  entries: UtangEntry[];
}

export interface StoreSettings {
  storeName: string;
  ownerName: string;
  dailyGoal: number;
}

export interface StoreState {
  settings: StoreSettings;
  products: Product[];
  transactions: SaleTransaction[];
  sukis: SukiCustomer[];
}
