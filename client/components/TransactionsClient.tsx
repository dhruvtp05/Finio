"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import TransactionTable from "@/components/TransactionTable";
import api from "@/lib/api";
import { TransactionDto, TransactionFiltersDto } from "@/lib/types";
import { FINIO_CATEGORIES } from "@/lib/categories";
import { toast } from "sonner";

export default function TransactionsClient() {
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [filters, setFilters] = useState<TransactionFiltersDto>({ months: [], categories: [] });
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualCategory, setManualCategory] = useState<string>("Other");
  const [manualType, setManualType] = useState<"expense" | "income">("expense");
  const [manualNote, setManualNote] = useState("");

  const loadFilters = useCallback(async () => {
    const [filtersRes, categoriesRes] = await Promise.all([
      api.get<TransactionFiltersDto>("/api/transactions/filters"),
      api.get<{ categories: string[] }>("/api/categories"),
    ]);
    setFilters(filtersRes.data);
    setAllCategories(categoriesRes.data.categories);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (month) params.set("month", month);
      if (category) params.set("category", category);
      if (search) params.set("search", search);

      const res = await api.get<{
        transactions: TransactionDto[];
        totalPages: number;
      }>(`/api/transactions?${params.toString()}`);

      setTransactions(res.data.transactions || []);
      setTotalPages(res.data.totalPages || 0);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [page, month, category, search]);

  useEffect(() => {
    loadFilters().catch(() => undefined);
  }, [loadFilters]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const exportCsv = async () => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (category) params.set("category", category);
    if (search) params.set("search", search);

    const res = await api.get(`/api/transactions/export?${params.toString()}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "finio-transactions.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const recategorize = async (id: string, newCategory: string) => {
    try {
      await api.patch(`/api/transactions/${id}/category`, { category: newCategory, locked: true });
      toast.success("Category locked for syncs");
      load();
    } catch {
      toast.error("Failed to update category");
    }
  };

  const deleteTxn = async (id: string) => {
    try {
      await api.delete(`/api/transactions/${id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Could not delete (manual entries only)");
    }
  };

  const splitTxn = async (id: string, parts: Array<{ amount: number; category: string; name?: string }>) => {
    try {
      await api.post(`/api/transactions/${id}/split`, { parts });
      toast.success("Transaction split");
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || "Split failed");
    }
  };

  const addManual = async () => {
    try {
      await api.post("/api/transactions", {
        name: manualName,
        merchantName: manualName,
        amount: Number(manualAmount),
        date: manualDate,
        category: manualCategory,
        type: manualType,
        note: manualNote || undefined,
      });
      toast.success("Transaction added");
      setShowAdd(false);
      setManualName("");
      setManualAmount("");
      setManualNote("");
      loadFilters();
      load();
    } catch {
      toast.error("Failed to add transaction");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Navbar />

      <div className="finio-card mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Month</label>
            <select className="finio-input" value={month} onChange={(e) => { setPage(1); setMonth(e.target.value); }}>
              <option value="">All months</option>
              {filters.months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Category</label>
            <select className="finio-input" value={category} onChange={(e) => { setPage(1); setCategory(e.target.value); }}>
              <option value="">All categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Search merchant</label>
            <input
              className="finio-input w-full"
              placeholder="Starbucks, Uber..."
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            />
          </div>
          <button type="button" onClick={() => setShowAdd((v) => !v)} className="finio-btn-primary">
            {showAdd ? "Cancel" : "+ Add manual"}
          </button>
          <button type="button" onClick={exportCsv} className="finio-btn-secondary">
            Export CSV
          </button>
        </div>

        {showAdd && (
          <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60 sm:grid-cols-2 lg:grid-cols-3">
            <input className="finio-input" placeholder="Merchant / name" value={manualName} onChange={(e) => setManualName(e.target.value)} />
            <input className="finio-input" type="number" step="0.01" placeholder="Amount" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
            <input className="finio-input" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
            <select className="finio-input" value={manualType} onChange={(e) => setManualType(e.target.value as "expense" | "income")}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select className="finio-input" value={manualCategory} onChange={(e) => setManualCategory(e.target.value)}>
              {FINIO_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input className="finio-input" placeholder="Note (optional)" value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
            <button type="button" onClick={addManual} className="finio-btn-primary sm:col-span-2 lg:col-span-3">
              Save transaction
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading transactions...</p>
      ) : (
        <>
          <TransactionTable
            transactions={transactions}
            onRecategorize={recategorize}
            onDelete={deleteTxn}
            onSplit={splitTxn}
          />
          <div className="mt-4 flex items-center justify-between">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="finio-btn-secondary">
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {Math.max(totalPages, 1)}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="finio-btn-secondary">
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
