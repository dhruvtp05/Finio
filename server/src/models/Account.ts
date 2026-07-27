import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAccount {
  userId: Types.ObjectId;
  plaidAccountId: string;
  name: string;
  officialName?: string;
  type: string;
  subtype?: string;
  mask?: string;
  currentBalance: number;
  availableBalance?: number;
  isoCurrencyCode?: string;
  lastSyncedAt: Date;
}

export interface IAccountDocument extends IAccount, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccountDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plaidAccountId: { type: String, required: true },
    name: { type: String, required: true },
    officialName: String,
    type: { type: String, required: true },
    subtype: String,
    mask: String,
    currentBalance: { type: Number, required: true, default: 0 },
    availableBalance: Number,
    isoCurrencyCode: { type: String, default: "USD" },
    lastSyncedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

AccountSchema.index({ userId: 1, plaidAccountId: 1 }, { unique: true });

const Account: Model<IAccountDocument> =
  (mongoose.models.Account as Model<IAccountDocument>) ||
  mongoose.model<IAccountDocument>("Account", AccountSchema);

export default Account;
