import mongoose from "mongoose";

const assignedCompaniesSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User", // Assuming this links to the User model where employeeId is stored
  },
  totalCompaniesAssigned: {
    type: Number,
    default: 0,
    required: true,
  },
  orderIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Order",
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

assignedCompaniesSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

assignedCompaniesSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

const AssignedCompanies = mongoose.model("AssignedCompanies", assignedCompaniesSchema);

export default AssignedCompanies;