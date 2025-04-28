import express from "express";
import { User } from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import passport from "passport";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    console.log("No token provided in request");
    return res.status(401).json({ message: "No token provided" });
  }

  if (!process.env.JWT_SECRET_KEY) {
    console.log("JWT_SECRET_KEY is not defined in environment variables");
    return res.status(500).json({ message: "JWT_SECRET_KEY is not defined" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      console.log("Token verification failed:", err.message);
      return res.status(403).json({ message: "Invalid or expired token", error: err.message });
    }
    console.log("Token verified, decoded user:", decoded);
    req.user = decoded;
    next();
  });
};

// User Registration
router.post("/register", async (req, res) => {
    console.log("Raw request body:", req.body); // Log the raw request body
    const { name, email, companyName, phone, password, role } = req.body;
    console.log("Destructured request:", { name, email, companyName, phone, role }); // Log destructured values
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log("User already exists:", email);
        return res.status(400).json({ message: "User already exists" });
      }
  
      const user = new User({ name, email, companyName, phone, password, role }); // Pass role to User constructor
      await user.save();
      const token = user.getJWTToken();
      console.log("User registered successfully:", user.email, "Role:", user.role, "Token:", token);
  
      res.status(201).json({
        message: "User registered successfully",
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (error) {
      console.error("Register error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

// User Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login request received:", { email });

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      console.log("User not found:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log("Password mismatch for user:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log("JWT_SECRET_KEY in login:", process.env.JWT_SECRET_KEY);
    const token = user.getJWTToken();
    console.log("User logged in successfully:", user.email, "Token:", token);

    res.status(200).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Google OAuth Routes
router.get(
  "/google",
  (req, res, next) => {
    console.log("Initiating Google OAuth flow");
    console.log("Environment:", process.env.NODE_ENV);
    console.log("Redirect URI:", process.env.NODE_ENV === "production" ? "http://localhost:5000/api/auth/google/callback" : "http://localhost:5000/api/auth/google/callback");
    console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  (req, res, next) => {
    console.log("Google OAuth callback received");
    console.log("Query parameters:", req.query);
    next();
  },
  passport.authenticate("google", { session: false, failureRedirect: "https://dataselling.netlify.app/login?error=auth-failed" }),
  (req, res) => {
    console.log("Google OAuth callback successful");
    const user = req.user;
    const token = user.getJWTToken();
    console.log("User:", user.email, "Token:", token);

    const redirectUrl = `https://dataselling.netlify.app/auth/callback?token=${token}&userId=${user._id}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&role=${user.role}`;
    console.log("Redirecting to:", redirectUrl);
    res.redirect(redirectUrl);
  },
  (err, req, res, next) => {
    console.error("Google OAuth callback error:", err.message);
    res.redirect("https://dataselling.netlify.app/login?error=auth-failed");
  }
);

// Google Verify Route
router.post("/google/verify", async (req, res) => {
  try {
    console.log("Google verify request received:", req.body);
    const { token } = req.body;
    if (!token) {
      console.log("No token provided in Google verify request");
      return res.status(400).json({ message: "No token provided" });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    console.log("Verifying with GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    console.log("Google token payload:", payload);

    const googleId = payload["sub"];
    const email = payload["email"];
    const name = payload["name"];

    let user = await User.findOne({ googleId });
    if (!user) {
      user = new User({ googleId, email, name, role: "user" });
      await user.save();
      console.log("New user created via Google auth:", user.email);
    } else {
      console.log("Existing user found via Google auth:", user.email);
    }

    const jwtToken = user.getJWTToken();
    console.log("JWT token generated for Google user:", user.email, "Token:", jwtToken);

    res.json({
      token: jwtToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Google verify error:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    res.status(400).json({ message: "Invalid Google token", error: error.message });
  }
});

// Forgot Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Forgot password request received for email:", email);

    if (!email) {
      console.log("Email not provided in forgot password request");
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(404).json({ message: "User with this email does not exist" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour expiry

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = resetTokenExpiry;
    await user.save();
    console.log("Reset token generated for user:", user.email, "Token:", resetToken);

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const message = `
      Hello ${user.name || "User"},

      You have requested to reset your password. Click the link below to proceed:
      ${resetUrl}

      This link will expire in 1 hour. If you did not request this, please ignore this email.

      Best regards,
      DataSellingProject Team
    `;

    try {
      await sendEmail({
        to: email,
        subject: "Password Reset Request - DataSellingProject",
        text: message,
      });
      console.log("Password reset email sent to:", email);
      res.status(200).json({ message: "A password reset link has been sent to your email." });
    } catch (emailError) {
      console.error("Error sending reset email:", emailError.message);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(500).json({ message: "Failed to send reset email. Please try again later." });
    }
  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ message: "Server error during forgot password request", error: error.message });
  }
});

// Reset Password - Validate Token
router.get("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    console.log("Validating reset token:", token);

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      console.log("Invalid or expired reset token:", token);
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    console.log("Reset token validated for user:", user.email);
    res.status(200).json({ message: "Token is valid" });
  } catch (error) {
    console.error("Reset password token validation error:", error.message);
    res.status(500).json({ message: "Failed to validate reset token", error: error.message });
  }
});

// Reset Password - Update Password
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    console.log("Reset password request received for token:", token);

    if (!password) {
      console.log("New password not provided in reset password request");
      return res.status(400).json({ message: "New password is required" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      console.log("Invalid or expired reset token:", token);
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    console.log("Password reset successfully for user:", user.email);

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ message: "Failed to reset password", error: error.message });
  }
});

export default router;