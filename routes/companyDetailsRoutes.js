// companyDetailsRoutes.js
import express from "express";
import { authenticateToken, checkAdminRole } from "../middleware/authMiddleware.js";
import CompanyDetails from "../models/companyDetailsModel.js";
import { Order } from "../models/orderModel.js";
import { Company } from "../models/companyModel.js";
import Task from "../models/taskModel.js"; // Import the Task model
import mongoose from "mongoose";
import nodemailer from "nodemailer"; // Import Nodemailer for email functionality

const router = express.Router();

// Configure Nodemailer transporter (example setup)
const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email service
  auth: {
    user: process.env.EMAIL_USER, // Set these in your .env file
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async (options) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      ...options,
    });
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error; // Re-throw to handle in the calling function
  }
};

// Submit Company Details (Employee)
router.post("/submit-company-details", authenticateToken, async (req, res) => {
  try {
    console.log("Connected database:", mongoose.connection.db.databaseName); // Debug log
    console.log("Request body:", req.body);
    const { companyId, orderId, ...details } = req.body;
    const employeeId = req.user.id;

    // Validate companyId exists (treat _id as string to match database)
    console.log("Received companyId:", companyId);
    let company = await Company.findOne({ _id: companyId }); // Use findOne with string _id
    console.log("Query result with string _id:", company);

    // Fallback to raw query if Mongoose fails
    if (!company) {
      console.log("Mongoose findOne failed, trying raw query...");
      const rawCompany = await mongoose.connection.db.collection("companies").findOne({ _id: companyId }); // Use string _id
      console.log("Raw query result:", rawCompany);
      if (!rawCompany) {
        console.log("Company not found in raw query for _id:", companyId);
        return res.status(404).json({ message: "Company not found" });
      } else {
        // Map raw data to schema-expected fields manually
        company = new Company({
          _id: rawCompany._id,
          businessName: rawCompany["Business Name"],
          originUrl: rawCompany["Origin URL"],
          companyUrl: rawCompany["Company URL"],
          address: rawCompany.Address,
          State: rawCompany.State,
          City: rawCompany.City,
          phone: rawCompany.Phone,
          category: rawCompany.category || rawCompany.Categories,
          subcategory: rawCompany.subcategory,
          Country: rawCompany.Country,
        });
      }
    }

    // Validate orderId exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Validate at least 2 fields are filled
    const filledFields = Object.values(details).filter(
      (value) => value && value.trim() !== ""
    ).length;
    if (filledFields < 2) {
      return res
        .status(400)
        .json({ message: "At least 2 fields are required to submit." });
    }

    const companyDetails = new CompanyDetails({
      companyId: company._id, // Use the matched _id (string)
      employeeId,
      orderId,
      formData: details,
    });

    await companyDetails.save();
    res
      .status(201)
      .json({ message: "Company details submitted for approval.", companyDetails });
  } catch (error) {
    console.error("Error submitting company details:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to submit company details", error: error.message });
  }
});
// Get Pending Company Details for Admin Approval
router.get("/pending-approvals", authenticateToken, async (req, res) => {
  try {
    const pendingApprovals = await CompanyDetails.find({ status: "pending" })
      .populate({
        path: "companyId",
        model: "Company",
        select: "_id" // Only fetch _id initially
      })
      .populate({
        path: "employeeId",
        model: "User",
        select: "name email"
      })
      .select("companyId employeeId submittedDate formData orderId");

    // Debug: Log the raw data to check population
    console.log("Raw pending approvals:", JSON.stringify(pendingApprovals, null, 2));

    // Transform data with separate query for raw "Business Name"
    const transformedApprovals = await Promise.all(pendingApprovals.map(async (approval) => {
      const company = approval.companyId || { _id: approval.companyId };
      let businessName = `Unknown (ID: ${company._id})`;

      // Fetch the raw document to get "Business Name"
      if (company._id) {
        const rawCompany = await mongoose.connection.db.collection("companies").findOne({ _id: new mongoose.Types.ObjectId(company._id) });
        businessName = rawCompany && rawCompany["Business Name"] ? rawCompany["Business Name"] : businessName;
      }

      return {
        _id: approval._id,
        companyId: {
          _id: company._id,
          businessName: businessName
        },
        employeeId: {
          _id: approval.employeeId._id,
          name: approval.employeeId.name || "Unknown",
          email: approval.employeeId.email || "N/A"
        },
        submittedDate: approval.submittedDate,
        formData: approval.formData,
        orderId: approval.orderId
      };
    }));

    // Debug: Log transformed data
    console.log("Transformed pending approvals:", JSON.stringify(transformedApprovals, null, 2));

    res.status(200).json(transformedApprovals);
  } catch (error) {
    console.error("Error fetching pending approvals:", error.message);
    res.status(500).json({ message: "Failed to fetch pending approvals", error: error.message });
  }
});

// Approve or Reject Company Details (Admin)
router.put("/approve-company-details/:id", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value. Use 'approved' or 'rejected'." });
    }

    const companyDetails = await CompanyDetails.findById(id).populate("employeeId", "name email");
    if (!companyDetails) {
      return res.status(404).json({ message: "Company details not found" });
    }

    if (status === "rejected") {
      // Delete the rejected company details
      await CompanyDetails.findByIdAndDelete(id);
      // Notify the employee by sending an email (Task model not used directly)
      const employeeEmail = companyDetails.employeeId.email || "no-email@example.com"; // Fallback email
      const employeeName = companyDetails.employeeId.name || "Employee";
      await sendEmail({
        to: employeeEmail,
        subject: "Company Data Rejected - Please Resubmit",
        text: `Dear ${employeeName},\n\nThe company data for an associated company (ID: ${companyDetails.companyId}) has been rejected. Please resubmit the form.\n\nBest regards,\nAdmin Team`,
      });
      return res.status(200).json({ message: "Company details rejected and deleted successfully." });
    } else if (status === "approved" && companyDetails.status !== "approved") {
      companyDetails.status = "approved";
      companyDetails.approvedBy = req.user.id;
      companyDetails.approvedAt = Date.now();

      // Update the associated Order's approvedCompanies count
      const orderUpdate = await Order.findByIdAndUpdate(
        companyDetails.orderId,
        { $inc: { approvedCompanies: 1 } },
        { new: true, runValidators: true }
      );
      if (!orderUpdate) {
        return res.status(404).json({ message: "Associated order not found" });
      }

      // Update the companies collection with the companyDetails ID
      await Company.findByIdAndUpdate(
        companyDetails.companyId,
        { companyDetails: id },
        { new: true, runValidators: true }
      );
      await companyDetails.save();
    }

    res.status(200).json({ message: `Company details ${status}.`, companyDetails });
  } catch (error) {
    console.error("Error approving/rejecting company details:", error.message, error.stack);
    res.status(500).json({ message: "Failed to approve/reject company details", error: error.message });
  }
});

router.get("/rejected-companies", authenticateToken, async (req, res) => {
  try {
    const { employeeId, taskId } = req.query;
    const query = { employeeId, status: "rejected", pendingRefill: true };
    if (taskId) query.taskId = taskId;
    const rejectedCompanies = await CompanyDetails.find(query).populate("companyId").lean();
    res.status(200).json(rejectedCompanies);
  } catch (error) {
    console.error("Error fetching rejected companies:", error.message);
    res.status(500).json({ message: "Failed to fetch rejected companies", error: error.message });
  }
});

router.patch("/rejected-companies/:id/resubmit", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCompany = await CompanyDetails.findByIdAndUpdate(
      id,
      { status: "pending", pendingRefill: true, submittedDate: new Date() },
      { new: true }
    ).populate("companyId").lean();
    res.status(200).json(updatedCompany);
  } catch (error) {
    console.error("Error resubmitting company:", error.message);
    res.status(500).json({ message: "Failed to resubmit company", error: error.message });
  }
});

// Get Employee History
router.get("/employee-history", authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const history = await CompanyDetails.find({ employeeId })
      .populate({
        path: "companyId",
        model: "Company",
        select: "businessName _id"
      })
      .select("companyId submittedDate status approvedAt formData");

    // Transform the data to include businessName
    const transformedHistory = history.map((record) => {
      const companyIdStr = record.companyId?._id.toString();
      const businessName = record.companyId?.businessName || `Unknown (ID: ${record.companyId?._id || 'N/A'})`;
      return {
        ...record.toObject(),
        companyId: {
          ...record.companyId?.toObject(),
          businessName,
        },
      };
    });

    res.status(200).json(transformedHistory);
  } catch (error) {
    console.error("Error fetching employee history:", error.message);
    res.status(500).json({ message: "Failed to fetch history", error: error.message });
  }
});

// Get Employee History with Companies
router.get("/employee-history-with-companies", authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const history = await CompanyDetails.find({ employeeId })
      .populate({
        path: "companyId",
        model: "Company",
        select: "_id" // Only fetch _id initially
      })
      .select("companyId submittedDate status approvedAt formData");

    // Transform data with separate query for raw "Business Name"
    const transformedHistory = await Promise.all(history.map(async (record) => {
      const company = record.companyId || { _id: record.companyId };
      let businessName = `Unknown (ID: ${company._id})`;

      // Fetch the raw document to get "Business Name"
      if (company._id) {
        const rawCompany = await mongoose.connection.db.collection("companies").findOne({ _id: new mongoose.Types.ObjectId(company._id) });
        businessName = rawCompany && rawCompany["Business Name"] ? rawCompany["Business Name"] : businessName;
      }

      return {
        _id: record._id,
        company: {
          _id: company._id,
          "Business Name": businessName
        },
        submittedDate: record.submittedDate,
        status: record.status,
        approvedAt: record.approvedAt,
        formData: record.formData
      };
    }));

    res.status(200).json(transformedHistory);
  } catch (error) {
    console.error("Error fetching employee history with companies:", error.message);
    res.status(500).json({ message: "Failed to fetch history", error: error.message });
  }
});

router.get("/submitted-companies", authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const submittedCompanies = await CompanyDetails.find({ employeeId }).select("companyId");
    res.status(200).json(submittedCompanies);
  } catch (error) {
    console.error("Error fetching submitted companies:", error.message);
    res.status(500).json({ message: "Failed to fetch submitted companies", error: error.message });
  }
});

// New route to fetch company with details
router.get("/company/:id", authenticateToken, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate("companyDetails", "formData status approvedAt");
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.status(200).json(company);
  } catch (error) {
    console.error("Error fetching company:", error.message);
    res
      .status(500)
      .json({ message: "Failed to fetch company", error: error.message });
  }
});

export default router;
