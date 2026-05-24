// Central API client for GasTracker backend
// Change BASE_URL when deploying to production VPS

const BASE_URL = 'http://localhost:3000/api/v1';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(
  method: string,
  path: string,
  body?: object,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ─── Auth ────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: User }>('POST', '/auth/login', { email, password }),

  register: (body: RegisterBody) =>
    request<Omit<User, 'password'>>('POST', '/auth/register', body),
};

// ─── Stations ───────────────────────────────────────────────────
export const stationsApi = {
  myStations: () => request<Station[]>('GET', '/stations/my-stations'),
  create: (body: Partial<Station>) => request<Station>('POST', '/stations', body),
  updatePrice: (id: string, pricePerKg: number) =>
    request<Station>('PUT', `/stations/${id}/price`, { pricePerKg }),
};

// ─── Entries ────────────────────────────────────────────────────
export const entriesApi = {
  create: (body: CreateEntryBody) => request<Entry>('POST', '/entries', body),
  byStation: (stationId: string, from?: string, to?: string) => {
    const q = from && to ? `?from=${from}&to=${to}` : '';
    return request<Entry[]>('GET', `/entries/station/${stationId}${q}`);
  },
  summary: (stationId: string, date: string) =>
    request<DailySummary>('GET', `/entries/station/${stationId}/summary?date=${date}`),
  sync: (entries: CreateEntryBody[]) =>
    request<Entry[]>('POST', '/entries/sync', { entries }),
};

// ─── Stock ──────────────────────────────────────────────────────
export const stockApi = {
  recordDelivery: (body: CreateStockBody) =>
    request<StockMovement>('POST', '/stock/delivery', body),
  byStation: (stationId: string) =>
    request<StockMovement[]>('GET', `/stock/station/${stationId}`),
};

// ─── Expenses ───────────────────────────────────────────────────
export const expensesApi = {
  create: (body: CreateExpenseBody) => request<Expense>('POST', '/expenses', body),
  byStation: (stationId: string, from?: string, to?: string) => {
    const q = from && to ? `?from=${from}&to=${to}` : '';
    return request<Expense[]>('GET', `/expenses/station/${stationId}${q}`);
  },
};

// ─── Reports ────────────────────────────────────────────────────
export const reportsApi = {
  daily: (stationId: string, date: string) =>
    request<DailyReport>('GET', `/reports/station/${stationId}/daily?date=${date}`),
  weekly: (stationId: string, from: string, to: string) =>
    request<WeeklyReport>('GET', `/reports/station/${stationId}/weekly?from=${from}&to=${to}`),
};

// ─── Types ──────────────────────────────────────────────────────
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'owner' | 'manager' | 'attendant' | 'super_admin';
  stationId?: string;
}

export interface RegisterBody {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
  stationId?: string;
}

export interface Station {
  id: string;
  name: string;
  address?: string;
  city?: string;
  pricePerKg: number;
  ownerUserId: string;
}

export interface CreateEntryBody {
  stationId: string;
  entryDate: string;
  openingMeter: number;
  closingMeter: number;
  pricePerKg: number;
  cashReceived: number;
  posReceived: number;
  notes?: string;
  localId?: string;
}

export interface Entry {
  id: string;
  stationId: string;
  entryDate: string;
  openingMeter: number;
  closingMeter: number;
  totalSalesKg: number;
  expectedRevenue: number;
  cashReceived: number;
  posReceived: number;
  totalRemitted: number;
  variance: number;
  notes?: string;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  totalSalesKg: number;
  expectedRevenue: number;
  totalRemitted: number;
  totalVariance: number;
  cashReceived: number;
  posReceived: number;
  entryCount: number;
}

export interface CreateStockBody {
  stationId: string;
  movementDate: string;
  quantityKg: number;
  supplierName?: string;
  invoiceNumber?: string;
  costPerKg?: number;
  totalCost?: number;
  notes?: string;
}

export interface StockMovement {
  id: string;
  stationId: string;
  type: string;
  movementDate: string;
  quantityKg: number;
  supplierName?: string;
  invoiceNumber?: string;
  totalCost?: number;
}

export interface CreateExpenseBody {
  stationId: string;
  expenseDate: string;
  description: string;
  category: string;
  amount: number;
  notes?: string;
}

export interface Expense {
  id: string;
  stationId: string;
  expenseDate: string;
  description: string;
  category: string;
  amount: number;
}

export interface DailyReport {
  date: string;
  sales: DailySummary;
  expenses: { items: Expense[]; total: number };
  netProfit: number;
}

export interface WeeklyReport {
  period: { from: string; to: string };
  summary: {
    totalSalesKg: number;
    totalRevenue: number;
    totalRemitted: number;
    totalVariance: number;
    totalExpenses: number;
    netProfit: number;
    totalStockDelivered: number;
  };
}

// ─── Staff ──────────────────────────────────────────────────────
export const staffApi = {
  getByStation: (stationId: string) =>
    request<StaffMember[]>('GET', `/staff/station/${stationId}`),

  create: (body: CreateStaffBody) =>
    request<StaffMember>('POST', '/staff', body),

  toggleActive: (userId: string, stationId: string) =>
    request<{ isActive: boolean }>('PUT', `/staff/${userId}/toggle-active`, { stationId }),

  resetPassword: (userId: string, stationId: string, newPassword: string) =>
    request<{ message: string }>('PUT', `/staff/${userId}/reset-password`, { stationId, newPassword }),

  delete: (userId: string, stationId: string) =>
    request<{ message: string }>('DELETE', `/staff/${userId}`, { stationId }),
};

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'manager' | 'attendant';
  stationId: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface CreateStaffBody {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'manager' | 'attendant';
  stationId: string;
  password: string;
}
