import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IUser {
  email: string;
  name?: string;
  image?: string;
  /** @deprecated use plaidAccessTokenEnc */
  plaidAccessToken?: string;
  plaidAccessTokenEnc?: string;
  plaidItemId?: string;
  plaidSyncCursor?: string;
  connectedAt?: Date;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: String,
    image: String,
    plaidAccessToken: { type: String, select: false },
    plaidAccessTokenEnc: { type: String, select: false },
    plaidItemId: { type: String, index: true },
    plaidSyncCursor: { type: String, select: false },
    connectedAt: Date,
  },
  { timestamps: true }
);

const User: Model<IUserDocument> =
  (mongoose.models.User as Model<IUserDocument>) || mongoose.model<IUserDocument>("User", UserSchema);

export default User;
