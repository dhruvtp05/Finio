import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ITransaction {
  userId: Types.ObjectId;
  plaidTransactionId?: string;
  name?: string;
  amount: number;
  category?: string[];
  userCategory?: string;
  suggestedCategory?: string;
  date: Date;
  merchantName?: string;
  pending?: boolean;
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
    date: { type: Date, required: true, index: true },
    merchantName: String,
    pending: Boolean,
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, date: -1 });

const Transaction: Model<ITransactionDocument> =
  (mongoose.models.Transaction as Model<ITransactionDocument>) ||
  mongoose.model<ITransactionDocument>("Transaction", TransactionSchema);

export default Transaction;
