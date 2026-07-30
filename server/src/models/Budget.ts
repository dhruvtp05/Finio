import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBudget {
  userId: Types.ObjectId;
  category: string;
  label: string;
  limit: number;
  /** Unused prior-month budget adds to this month's effective limit */
  rolloverEnabled?: boolean;
}

export interface IBudgetDocument extends IBudget, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BudgetSchema = new Schema<IBudgetDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, required: true },
    label: { type: String, required: true },
    limit: { type: Number, required: true, min: 0 },
    rolloverEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BudgetSchema.index({ userId: 1, category: 1 }, { unique: true });

const Budget: Model<IBudgetDocument> =
  (mongoose.models.Budget as Model<IBudgetDocument>) || mongoose.model<IBudgetDocument>("Budget", BudgetSchema);

export default Budget;

export const DEFAULT_BUDGETS: Array<Omit<IBudget, "userId">> = [
  { category: "Food & Drink", label: "Food & Drink", limit: 500 },
  { category: "Transportation", label: "Transportation", limit: 200 },
  { category: "Entertainment", label: "Entertainment", limit: 150 },
];
