import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IGoal {
  userId: Types.ObjectId;
  title: string;
  targetAmount: number;
  deadline: Date;
}

export interface IGoalDocument extends IGoal, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GoalSchema = new Schema<IGoalDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true, min: 1 },
    deadline: { type: Date, required: true },
  },
  { timestamps: true }
);

const Goal: Model<IGoalDocument> =
  (mongoose.models.Goal as Model<IGoalDocument>) || mongoose.model<IGoalDocument>("Goal", GoalSchema);

export default Goal;
