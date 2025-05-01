import axios from "axios";

const api = axios.create({
  baseURL: "https://dsp-backend.onrender.com/api", // Adjust based on your server URL
});

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const decoded = JSON.parse(atob(token.split(".")[1]));
    const exp = decoded.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp;
  } catch (error) {
    console.error("Error decoding token:", error);
    return true;
  }
};

api.interceptors.request.use(
  async (config) => {
    let token = localStorage.getItem("token");
    if (token && isTokenExpired(token)) {
      console.log("Token expired, refreshing...");
      try {
        const response = await axios.post("https://dsp-backend.onrender.com/api/payment/refresh-token", {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        token = response.data.token;
        localStorage.setItem("token", token);
        console.log("Token refreshed successfully");
      } catch (error) {
        console.error("Failed to refresh token:", error);
        localStorage.removeItem("token");
        window.location.href = "/login"; // Redirect to login page
        return Promise.reject(error);
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 403 && !originalRequest._retry) {
      originalRequest._retry = true;
      console.log("Received 403, attempting to refresh token...");
      try {
        const token = localStorage.getItem("token");
        const response = await axios.post("https://dsp-backend.onrender.com/api/payment/refresh-token", {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const newToken = response.data.token;
        localStorage.setItem("token", newToken);
        console.log("Token refreshed successfully, retrying request");
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Failed to refresh token on 403:", refreshError);
        localStorage.removeItem("token");
        window.location.href = "/login"; // Redirect to login page
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
