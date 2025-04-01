import mongoose from "mongoose";
import validator from "validator"; 

const employeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please Enter Employee Name"],
    },
    email: {
        type: String,
        required: [true, "Please Enter Employee Email"],
        unique: true,
        validate: [validator.isEmail, "Please Enter a valid Email"],
    },
    companyName: {
        type: String,
        required: [true, "Please Enter Your Company Name"],
        maxLength: [30, "Name cannot exceed 30 characters"],
        minLength: [4, "Name should have more than 4 characters"],
    },
    phone: {
        type: Number,
        required: [true, "Please Enter Employee Phone Number"],
        unique: true,
    },
    position: {
        type: String,
        required: [true, "Please Enter Employee Position"],
    },
    department: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const Employee = mongoose.model("Employee", employeeSchema);