import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface INetWorthSnapshot {
  userId: Types.ObjectId;
  date: Date;
  netWorth: number;
  assets: number;
  liabilities: number;
}

export interface INetWorthSnapshotDocument extends INetWorthSnapshot, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NetWorthSnapshotSchema = new Schema<INetWorthSnapshotDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    netWorth: { type: Number, required: true },
    assets: { type: Number, required: true },
    liabilities: { type: Number, required: true },
  },
  { timestamps: true }
);

NetWorthSnapshotSchema.index({ userId: 1, date: 1 }, { unique: true });

const NetWorthSnapshot: Model<INetWorthSnapshotDocument> =
  (mongoose.models.NetWorthSnapshot as Model<INetWorthSnapshotDocument>) ||
  mongoose.model<INetWorthSnapshotDocument>("NetWorthSnapshot", NetWorthSnapshotSchema);

export default NetWorthSnapshot;
