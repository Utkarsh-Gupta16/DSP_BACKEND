import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  employeeId: {
    type: String,
    required: true,
  },
  companyCount: {
    type: Number,
    required: true,
  },
  startIndex: {
    type: Number,
    required: true,
    default: 0, // Default to 0 for the first task
  },
  endIndex: {
    type: Number,
    required: true, // Will be calculated based on startIndex and companyCount
  },
  assignedDate: {
    type: Date,
    default: Date.now, // Default to current date when assigned
  },
  submitTillDate: {
    type: Date, // Next day after assigned date
  },
  companyData: {
    type: [Object],
    default: [],
  },
  status: {
    type: String,
    enum: ["pending", "in_progress", "completed"],
    default: "pending",
  },
  completedDate: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Pre-save middleware to calculate endIndex
taskSchema.pre("save", function(next) {
  if (this.isModified("startIndex") || this.isModified("companyCount")) {
    this.endIndex = this.startIndex + this.companyCount - 1;
  }
  next();
});

const Task = mongoose.model("Task", taskSchema);

export default Task;