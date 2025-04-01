import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please Enter Your Name"],
    maxLength: [30, "Name cannot exceed 30 characters"],
    minLength: [4, "Name should have more than 4 characters"],
  },
  email: {
    type: String,
    required: [true, "Please Enter Your Email"],
    unique: true,
    validate: [validator.isEmail, "Please Enter a valid Email"],
  },
  companyName: {
    type: String,
    maxLength: [30, "Company name cannot exceed 30 characters"],
    minLength: [4, "Company name should have more than 4 characters"],
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    validate: {
      validator: function (v) {
        return !v || validator.isMobilePhone(v);
      },
      message: "Please Enter a valid Phone Number",
    },
  },
  password: {
    type: String,
    minLength: [8, "Password should be greater than 8 characters"],
    select: false,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpire: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  savedFilters: {
    type: {
      subcategories: {
        type: [String],
        default: [],
      },
      subSubcategories: {
        type: [String],
        default: [],
      },
      country: {
        type: {
          value: String,
          label: String,
        },
        default: null,
      },
      State: {
        type: {
          value: String,
          label: String,
        },
        default: null,
      },
      City: {
        type: {
          value: String,
          label: String,
        },
        default: null,
      },
    },
    default: () => ({
      subcategories: [],
      subSubcategories: [],
      country: null,
      State: null,
      City: null,
    }),
  },
});

userSchema.index({ role: 1 });

userSchema.path("password").validate(function (value) {
  if (!value) return true;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
  return passwordRegex.test(value);
}, "Password must include uppercase, lowercase, number, and special character.");

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

export const User = mongoose.model("User", userSchema);