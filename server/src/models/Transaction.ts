import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ITransaction {
  userId: Types.ObjectId;
  plaidTransactionId?: string;
  name?: string;
  amount: number;
  category?: string[];
  userCategory?: string;
  suggestedCategory?: string;
  /** When true, user category is preserved across Plaid syncs */
  categoryLocked?: boolean;
  date: Date;
  merchantName?: string;
  pending?: boolean;
  /** plaid = synced; manual = user-created */
  source?: "plaid" | "manual";
  note?: string;
  tags?: string[];
  /** Credit card bill payment — exclude from spend to avoid double-count */
  isCreditCardPayment?: boolean;
  /** Relative path under uploads/ or data URL for small receipts */
  receiptPath?: string;
  receiptMime?: string;
  /** Split parent or replaced txn — skip in totals */
  excludedFromTotals?: boolean;
  splitFromId?: Types.ObjectId;
}

export interface ITransactionDocument extends ITransaction, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransactionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plaidTransactionId: { type: String, unique: true, sparse: true },
    name: String,
    amount: { type: Number, required: true },
    category: [String],
    userCategory: String,
    suggestedCategory: String,
    categoryLocked: { type: Boolean, default: false },
    date: { type: Date, required: true, index: true },
    merchantName: String,
    pending: Boolean,
    source: { type: String, enum: ["plaid", "manual"], default: "plaid" },
    note: String,
    tags: { type: [String], default: [] },
    isCreditCardPayment: { type: Boolean, default: false },
    receiptPath: String,
    receiptMime: String,
    excludedFromTotals: { type: Boolean, default: false },
    splitFromId: { type: Schema.Types.ObjectId, ref: "Transaction" },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, date: -1 });

const Transaction: Model<ITransactionDocument> =
  (mongoose.models.Transaction as Model<ITransactionDocument>) ||
  mongoose.model<ITransactionDocument>("Transaction", TransactionSchema);

export default Transaction;
