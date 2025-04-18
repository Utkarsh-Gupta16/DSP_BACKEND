import jwt from "jsonwebtoken";

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

const checkAdminRole = (req, res, next) => {
  if (req.user.role !== "admin") {
    console.log("Unauthorized access attempt by non-admin user:", req.user.id);
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export { authenticateToken, checkAdminRole }; // Export both functions