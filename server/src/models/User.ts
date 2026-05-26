import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    name: String,
    image: String,
    plaidAccessToken: String,
    plaidItemId: String,
    connectedAt: Date,
  },
  { timestamps: true }
);

const User = (mongoose.models.User as mongoose.Model<any>) || mongoose.model("User", UserSchema);

export default User;
