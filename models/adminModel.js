import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please Enter Admin Name"],
    },
    email: {
        type: String,
        required: [true, "Please Enter Admin Email"],
        unique: true,
        validate: [validator.isEmail, "Please Enter a valid Email"],
    },
    phone: {
        type: Number,
        required: [true, "Please Enter Admin Phone Number"],
        unique: true,
    },
    password: {
        type: String,
        required: [true, "Please Enter Your Password"],
        minLength: [8, "Password should be greater than 8 characters"],
        select: false,
    },
    role: {
        type: String,
        default: "admin",
    },
    permissions: {
        type: [String],
        default: ["manage-users", "manage-data"],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Hashing password before saving
adminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        next();
    }
    this.password = await bcrypt.hash(this.password, 10);
});

// Comparing Password
adminSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generating JWT Token
adminSchema.methods.getJWTToken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET_KEY, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};

export const Admin = mongoose.model("Admin", adminSchema);