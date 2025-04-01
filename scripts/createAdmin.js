// scripts/createAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  googleId: String,
  password: String,
  role: String,
  createdAt: Date,
  savedFilters: Object,
  __v: Number,
});

const User = mongoose.model("User", userSchema);

const createAdmin = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/DataSellingProject", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const existingAdmin = await User.findOne({ email: "admin@examplemail.com" });
    if (existingAdmin) {
      console.log("Admin user already exists");
      return;
    }

    // Hash the password
    const password = "Admin@123"; // Changed to admin@123
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const adminUser = new User({
      _id: new mongoose.Types.ObjectId("67e105b4d6e2a733a4a22539"),
      name: "Admin User",
      email: "admin@example.com",
      password: hashedPassword,
      role: "admin",
      createdAt: new Date("2025-03-24T08:00:00.000Z"),
      savedFilters: {
        subcategories: [],
        subSubcategories: [],
        country: null,
        State: null,
        City: null,
        _id: new mongoose.Types.ObjectId("67e105b4d6e2a733a4a2253a"),
      },
      __v: 0,
    });

    await adminUser.save();
    console.log("Admin user created successfully");
    console.log(`Admin password: ${password}`);
  } catch (err) {
    console.error("Error creating admin user:", err);
  } finally {
    await mongoose.connection.close();
  }
};

createAdmin();