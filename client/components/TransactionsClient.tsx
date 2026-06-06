"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import TransactionTable from "@/components/TransactionTable";
import api from "@/lib/api";
import { TransactionDto, TransactionFiltersDto } from "@/lib/types";
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
      await api.patch(`/api/transactions/${id}/category`, { category: newCategory });
      toast.success("Category updated");
      load();
    } catch {
      toast.error("Failed to update category");
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
          <button type="button" onClick={exportCsv} className="finio-btn-secondary">
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading transactions...</p>
      ) : (
        <>
          <TransactionTable transactions={transactions} onRecategorize={recategorize} />
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
