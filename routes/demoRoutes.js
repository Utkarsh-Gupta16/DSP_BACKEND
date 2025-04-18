import express from "express";
import DemoRequest from "../models/DemoRequestModel.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { sendDemoConfirmationEmail, sendMeetingLinkEmail } from "../utils/demoEmails.js";

const router = express.Router();

// Create a demo request and send confirmation email
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, email, date, message } = req.body;

    if (!name || !email || !date) {
      return res.status(400).json({ message: "Name, email, and date are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const demoRequest = new DemoRequest({ name, email, date: parsedDate, message });
    await demoRequest.save();

    try {
      const dateStr = parsedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const timeStr = parsedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      await sendDemoConfirmationEmail(email, name, dateStr, timeStr);
    } catch (emailError) {
      console.error("Failed to send confirmation email, but request saved:", emailError.message);
      return res.status(201).json({
        message: "Demo request submitted successfully, but confirmation email could not be sent",
      });
    }

    res.status(201).json({ message: "Demo request submitted successfully" });
  } catch (error) {
    console.error("Error submitting demo request:", error.message);
    res.status(500).json({ message: "Failed to submit demo request", error: error.message });
  }
});

// Get demo requests assigned to an employee
router.get("/employee", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "employee") {
      return res.status(403).json({ message: "Access denied. Employee only." });
    }
    const demoRequests = await DemoRequest.find({ assignedTo: user.id }).sort({ date: 1 });
    res.status(200).json(demoRequests);
  } catch (error) {
    console.error("Error fetching employee demo requests:", error.message);
    res.status(500).json({ message: "Failed to fetch demo requests", error: error.message });
  }
});

// Get all demo requests (for admin)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }
    const demoRequests = await DemoRequest.find().sort({ date: 1 }).populate("assignedTo", "name email");
    res.status(200).json(demoRequests);
  } catch (error) {
    console.error("Error fetching demo requests:", error.message);
    res.status(500).json({ message: "Failed to fetch demo requests", error: error.message });
  }
});

// Send meeting link
router.post("/send-meeting-link/:id", authenticateToken, async (req, res) => {
  try {
    const { meetingLink } = req.body;
    const demoRequest = await DemoRequest.findById(req.params.id);
    if (!demoRequest) {
      return res.status(404).json({ message: "Demo request not found" });
    }
    if (demoRequest.status === "completed" || demoRequest.status === "cancelled") {
      return res.status(400).json({ message: "Cannot send meeting link for completed or cancelled requests" });
    }
    demoRequest.meetingLink = meetingLink;
    demoRequest.status = "completed";
    await demoRequest.save();

    const dateStr = new Date(demoRequest.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const timeStr = new Date(demoRequest.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    await sendMeetingLinkEmail(demoRequest.email, demoRequest.name, dateStr, timeStr, meetingLink);

    res.status(200).json({ message: "Meeting link sent successfully" });
  } catch (error) {
    console.error("Error sending meeting link:", error.message);
    res.status(500).json({ message: "Failed to send meeting link", error: error.message });
  }
});

// Cancel demo request
router.put("/cancel/:id", authenticateToken, async (req, res) => {
  try {
    const demoRequest = await DemoRequest.findById(req.params.id);
    if (!demoRequest) {
      return res.status(404).json({ message: "Demo request not found" });
    }
    if (demoRequest.status === "cancelled") {
      return res.status(400).json({ message: "Demo request already cancelled" });
    }
    demoRequest.status = "cancelled";
    await demoRequest.save();

    // Send cancellation email
    const dateStr = new Date(demoRequest.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const timeStr = new Date(demoRequest.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    try {
      await sendDemoConfirmationEmail(demoRequest.email, demoRequest.name, dateStr, timeStr, true, "Sorry we cannot complete your demo in the given slot due to some constraints. We would be happy to schedule your new demo with a different time slot.");
    } catch (emailError) {
      console.error("Failed to send cancellation email:", emailError.message);
    }

    res.status(200).json({ message: "Demo request cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling demo request:", error.message);
    res.status(500).json({ message: "Failed to cancel demo request", error: error.message });
  }
});

// Assign demo request to employee
router.put("/assign/:id", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ message: "Assigned employee ID is required" });
    }

    const demoRequest = await DemoRequest.findById(req.params.id);
    if (!demoRequest) {
      return res.status(404).json({ message: "Demo request not found" });
    }
    if (demoRequest.status === "completed" || demoRequest.status === "cancelled") {
      return res.status(400).json({ message: "Cannot assign completed or cancelled requests" });
    }

    demoRequest.assignedTo = assignedTo;
    demoRequest.status = "assigned";
    await demoRequest.save();

    res.status(200).json({ message: "Demo request assigned successfully" });
  } catch (error) {
    console.error("Error assigning demo request:", error.message);
    res.status(500).json({ message: "Failed to assign demo request", error: error.message });
  }
});

export default router;