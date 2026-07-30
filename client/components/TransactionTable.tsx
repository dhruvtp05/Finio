"use client";

import { format } from "date-fns";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { TransactionDto } from "@/lib/types";
import { FINIO_CATEGORIES } from "@/lib/categories";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

function formatDisplayAmount(amount: number) {
  if (amount > 0) return currency.format(-amount);
  if (amount < 0) return `+${currency.format(Math.abs(amount))}`;
  return currency.format(0);
}

function displayCategory(txn: TransactionDto) {
  return txn.userCategory || txn.suggestedCategory || txn.category?.[0] || "Other";
}

function noteSnippet(note?: string) {
  if (!note) return null;
  return note.length > 40 ? `${note.slice(0, 40)}…` : note;
}

export default function TransactionTable({
  transactions,
  onRecategorize,
  onDelete,
  onSplit,
  onUpdateMeta,
  onUploadReceipt,
}: {
  transactions: TransactionDto[];
  onRecategorize?: (id: string, category: string) => void;
  onDelete?: (id: string) => void;
  onSplit?: (id: string, parts: Array<{ amount: number; category: string; name?: string }>) => void;
  onUpdateMeta?: (id: string, meta: { note?: string; tags?: string[]; isCreditCardPayment?: boolean }) => void;
  onUploadReceipt?: (id: string, dataUrl: string, mime: string) => void;
}) {
  const [splitId, setSplitId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [partA, setPartA] = useState("");
  const [catA, setCatA] = useState<string>(FINIO_CATEGORIES[0]);
  const [catB, setCatB] = useState<string>(FINIO_CATEGORIES[1] || FINIO_CATEGORIES[0]);
  const [editNote, setEditNote] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCc, setEditCc] = useState(false);

  const startSplit = (txn: TransactionDto) => {
    setEditId(null);
    setSplitId(txn._id);
    const half = (Math.abs(txn.amount) / 2).toFixed(2);
    setPartA(half);
    setCatA(displayCategory(txn));
    setCatB(FINIO_CATEGORIES.find((c) => c !== displayCategory(txn)) || "Other");
  };

  const startEdit = (txn: TransactionDto) => {
    setSplitId(null);
    setEditId(txn._id);
    setEditNote(txn.note || "");
    setEditTags((txn.tags || []).join(", "));
    setEditCc(Boolean(txn.isCreditCardPayment));
  };

  const submitSplit = (txn: TransactionDto) => {
    if (!onSplit) return;
    const total = Math.abs(txn.amount);
    const a = Number(partA);
    if (!(a > 0) || a >= total) return;
    const b = Math.round((total - a) * 100) / 100;
    onSplit(txn._id, [
      { amount: a, category: catA },
      { amount: b, category: catB },
    ]);
    setSplitId(null);
  };

  const submitMeta = (txn: TransactionDto) => {
    if (!onUpdateMeta) return;
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onUpdateMeta(txn._id, {
      note: editNote,
      tags,
      isCreditCardPayment: editCc,
    });
    setEditId(null);
  };

  const handleReceipt = (txn: TransactionDto, file: File | null) => {
    if (!file || !onUploadReceipt) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Receipt must be under 4MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      onUploadReceipt(txn._id, dataUrl, file.type || "image/jpeg");
    };
    reader.onerror = () => toast.error("Failed to read receipt file");
    reader.readAsDataURL(file);
  };

  const showActions = Boolean(onDelete || onSplit || onUpdateMeta || onUploadReceipt);
  const colSpan = showActions ? 5 : 4;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Merchant</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Amount</th>
            {showActions && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const expense = txn.amount > 0;
            const category = displayCategory(txn);
            const isSplitting = splitId === txn._id;
            const isEditing = editId === txn._id;
            const snippet = noteSnippet(txn.note);

            return (
              <Fragment key={txn._id}>
                <tr className="border-t border-slate-100 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{format(new Date(txn.date), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    <div className="flex flex-wrap items-center gap-1">
                      <span>{txn.merchantName || txn.name || "—"}</span>
                      {txn.source === "manual" && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-800">
                          Manual
                        </span>
                      )}
                      {txn.categoryLocked && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                          Locked
                        </span>
                      )}
                      {txn.isCreditCardPayment && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          CC payment
                        </span>
                      )}
                      {txn.hasReceipt && (
                        txn.receiptUrl ? (
                          <a
                            href={`${apiBase}${txn.receiptUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 hover:underline dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            Receipt
                          </a>
                        ) : (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Receipt
                          </span>
                        )
                      )}
                    </div>
                    {(txn.tags?.length || snippet) && (
                      <div className="mt-1 space-y-0.5 font-normal">
                        {txn.tags && txn.tags.length > 0 && (
                          <p className="flex flex-wrap gap-1">
                            {txn.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              >
                                #{tag}
                              </span>
                            ))}
                          </p>
                        )}
                        {snippet && (
                          <p className="text-xs text-slate-400">{snippet}</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {onRecategorize ? (
                      <select
                        className="finio-input max-w-[200px]"
                        value={category}
                        onChange={(e) => onRecategorize(txn._id, e.target.value)}
                      >
                        {FINIO_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{category}</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${expense ? "text-red-600" : "text-emerald-600"}`}>
                    {formatDisplayAmount(txn.amount)}
                  </td>
                  {showActions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {(onUpdateMeta || onUploadReceipt) && !isEditing && (
                          <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => startEdit(txn)}>
                            Edit
                          </button>
                        )}
                        {onSplit && !isSplitting && (
                          <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => startSplit(txn)}>
                            Split
                          </button>
                        )}
                        {onDelete && txn.source === "manual" && (
                          <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => onDelete(txn._id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {(isEditing || isSplitting) && (
                  <tr className="border-t border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40">
                    <td colSpan={colSpan} className="px-4 py-3">
                      {isEditing && (onUpdateMeta || onUploadReceipt) && (
                        <div className="space-y-3">
                          {onUpdateMeta && (
                            <>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-xs text-slate-500">Note</label>
                                  <input
                                    className="finio-input w-full"
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    placeholder="Optional note"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-slate-500">Tags (comma-separated)</label>
                                  <input
                                    className="finio-input w-full"
                                    value={editTags}
                                    onChange={(e) => setEditTags(e.target.value)}
                                    placeholder="groceries, trip"
                                  />
                                </div>
                              </div>
                              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={editCc}
                                  onChange={(e) => setEditCc(e.target.checked)}
                                />
                                Credit card payment (exclude from spend totals)
                              </label>
                            </>
                          )}
                          {onUploadReceipt && (
                            <div>
                              <label className="mb-1 block text-xs text-slate-500">Receipt</label>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-medium dark:file:bg-slate-700"
                                onChange={(e) => handleReceipt(txn, e.target.files?.[0] || null)}
                              />
                            </div>
                          )}
                          <div className="flex gap-2">
                            {onUpdateMeta && (
                              <button type="button" className="finio-btn-primary text-xs" onClick={() => submitMeta(txn)}>
                                Save
                              </button>
                            )}
                            <button type="button" className="finio-btn-secondary text-xs" onClick={() => setEditId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {isSplitting && onSplit && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">Split into 2 parts (must sum to {currency.format(Math.abs(txn.amount))})</p>
                          <div className="flex flex-wrap gap-2">
                            <input
                              className="finio-input w-24"
                              type="number"
                              step="0.01"
                              value={partA}
                              onChange={(e) => setPartA(e.target.value)}
                              placeholder="Part 1"
                            />
                            <select className="finio-input" value={catA} onChange={(e) => setCatA(e.target.value)}>
                              {FINIO_CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="self-center text-xs text-slate-500">
                              Rest: {currency.format(Math.max(0, Math.abs(txn.amount) - Number(partA || 0)))}
                            </span>
                            <select className="finio-input" value={catB} onChange={(e) => setCatB(e.target.value)}>
                              {FINIO_CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" className="finio-btn-primary text-xs" onClick={() => submitSplit(txn)}>
                              Confirm split
                            </button>
                            <button type="button" className="finio-btn-secondary text-xs" onClick={() => setSplitId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {transactions.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-500">No transactions found.</p>
      )}
    </div>
  );
}
