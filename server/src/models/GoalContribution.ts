import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IGoalContribution {
  userId: Types.ObjectId;
  goalId: Types.ObjectId;
  amount: number;
  date: Date;
  note?: string;
}

export interface IGoalContributionDocument extends IGoalContribution, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GoalContributionSchema = new Schema<IGoalContributionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: "Goal", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true },
    note: String,
  },
  { timestamps: true }
);

const GoalContribution: Model<IGoalContributionDocument> =
  (mongoose.models.GoalContribution as Model<IGoalContributionDocument>) ||
  mongoose.model<IGoalContributionDocument>("GoalContribution", GoalContributionSchema);

export default GoalContribution;
