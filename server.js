import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import passport from "passport";
import session from "express-session";
import GoogleStrategy from "passport-google-oauth20";
import fileUpload from "express-fileupload";

// Import Routes
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import dataRoutes from "./routes/dataRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import countRoutes from "./routes/countRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

// Load Environment Variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: "https://dataselling.netlify.app", credentials: true }));
app.use(express.json({ limit: "10mb" })); // Increase payload size limit
app.use(fileUpload());
app.use(
  session({
    secret: process.env.JWT_SECRET_KEY || "fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" }, // Enable secure cookies in production
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.NODE_ENV === "production"
        ? "https://dsp-backend.onrender.com/api/users/google/callback"
        : "http://localhost:5000/api/users/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, emails, displayName } = profile;
        let user = await User.findOne({ googleId: id });
        if (!user) {
          user = new User({
            googleId: id,
            email: emails[0].value,
            name: displayName,
            role: "user",
          });
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/companies", dataRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/categories", categoryRoutes);
app.use(countRoutes);
app.use("/api/payment", paymentRoutes);

// Fallback Route for Unmatched Paths
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// Start the Server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
  }
};

startServer();
