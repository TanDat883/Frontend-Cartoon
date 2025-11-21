// src/api/axiosInstance.js
import axios from "axios";
import AuthService from "../services/AuthService";

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("idToken");

  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  // ✅ Add X-User-Id header for backend authorization
  try {
    const myUserStr = localStorage.getItem("my_user");
    if (myUserStr) {
      const myUser = JSON.parse(myUserStr);
      const userId = myUser?.my_user?.userId || myUser?.userId;
      if (userId) {
        config.headers["X-User-Id"] = userId;
      }
    }
  } catch (error) {
    console.error("Error extracting userId for X-User-Id header:", error);
  }

  // ❗ Chỉ set Content-Type nếu KHÔNG phải FormData
  if (!(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

// ✅ Thêm response interceptor để xử lý lỗi 401 và auto refresh token
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Nếu gặp lỗi 401 và chưa retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        console.log("🔄 Attempting to refresh token...");
        
        // Thử refresh token
        const newAuth = await AuthService.refresh();
        
        if (newAuth?.idToken) {
          // Cập nhật token mới
          localStorage.setItem('idToken', newAuth.idToken);
          localStorage.setItem('my_user', JSON.stringify(newAuth));
          
          // Retry request với token mới
          originalRequest.headers['Authorization'] = `Bearer ${newAuth.idToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        console.warn("🔒 Token refresh failed - redirecting to login");
        
        // Xóa token cũ
        localStorage.removeItem('idToken');
        localStorage.removeItem('my_user');
        localStorage.removeItem('phoneNumber');
        localStorage.removeItem('userAttributes');
        
        // Redirect về login page
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
