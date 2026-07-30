import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICategoryRule {
  userId: Types.ObjectId;
  pattern: string;
  match: "contains" | "exact";
  category: string;
  enabled: boolean;
}

export interface ICategoryRuleDocument extends ICategoryRule, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryRuleSchema = new Schema<ICategoryRuleDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pattern: { type: String, required: true, trim: true },
    match: { type: String, enum: ["contains", "exact"], default: "contains" },
    category: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CategoryRuleSchema.index({ userId: 1, pattern: 1 }, { unique: true });

const CategoryRule: Model<ICategoryRuleDocument> =
  (mongoose.models.CategoryRule as Model<ICategoryRuleDocument>) ||
  mongoose.model<ICategoryRuleDocument>("CategoryRule", CategoryRuleSchema);

export default CategoryRule;
