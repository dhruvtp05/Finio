import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plaidTransactionId: { type: String, unique: true },
    name: String,
    amount: Number,
    category: [String],
    date: Date,
    merchantName: String,
    pending: Boolean,
  },
  { timestamps: true }
);

const Transaction =
  (mongoose.models.Transaction as mongoose.Model<any>) || mongoose.model("Transaction", TransactionSchema);

export default Transaction;
