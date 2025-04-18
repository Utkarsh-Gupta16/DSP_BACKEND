import mongoose from "mongoose";

     const demoRequestSchema = new mongoose.Schema({
       name: {
         type: String,
         required: true,
       },
       email: {
         type: String,
         required: true,
       },
       date: {
         type: Date,
         required: true,
       },
       message: {
         type: String,
       },
       timezone: {
         type: String, // e.g., "America/New_York"
       },
       assignedTo: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "User",
       },
       status: {
         type: String,
         enum: ["pending", "assigned", "completed", "cancelled"],
         default: "pending",
       },
       meetingLink: {
         type: String,
       },
       createdAt: {
         type: Date,
         default: Date.now,
       },
     });

     export default mongoose.model("DemoRequest", demoRequestSchema);