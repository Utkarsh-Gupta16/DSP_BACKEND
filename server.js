import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import passport from "passport";
import session from "express-session";
import GoogleStrategy from "passport-google-oauth20";
import fileUpload from "express-fileupload";

import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import dataRoutes from "./routes/dataRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import countRoutes from "./routes/countRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminEmailRoutes from "./routes/adminEmailRoutes.js";
import companyDetailsRoutes from "./routes/companyDetailsRoutes.js";
import demoRoutes from "./routes/demoRoutes.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url} from origin: ${req.headers.origin}`);
  next();
});


// Hardcode all frontend URLs
const allowedOrigins = [
  "https://dataselling.netlify.app",
  "https://datasellingproject.netlify.app",
  "http://localhost:3000",
];

// Configure CORS with the hardcoded origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if the incoming origin is in the allowed list

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log blocked origins for debugging
    console.log(`Blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true, // Allow credentials (e.g., cookies, authorization headers)
}));

// Middleware to set Access-Control-Allow-Origin dynamically
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

// Handle preflight requests
app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(fileUpload());
app.use(
  session({
    secret: process.env.JWT_SECRET_KEY || "fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.NODE_ENV === "production"
        ? "https://dsp-backend.onrender.com/api/users/google/callback"
        : "https://dsp-backend.onrender.com/api/users/google/callback",
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
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/companies", dataRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/categories", categoryRoutes);
app.use(countRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/company-details", companyDetailsRoutes);
app.use("/api/admin/email", adminEmailRoutes);
app.use("/api/demo", demoRoutes);
app.use("/api/company-details", companyDetailsRoutes);
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ Connected to MongoDB - ${mongoose.connection.db.databaseName}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

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
