import axios from "axios";

const API = axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("idToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ✅ Add response interceptor for better error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export const sendMessageToServer = async (message, currentMovieId, conversationId) => {
  try {
    const payload = { message, currentMovieId, conversationId };
    const { data } = await API.post("/api/ai/chat", payload);
    return data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error("Backend server không chạy. Hãy chạy BE trước.");
    } else if (error.response?.status === 500) {
      throw new Error("Lỗi server: " + (error.response?.data?.message || "Internal Server Error"));
    } else if (error.response?.status === 429) {
      throw new Error("OpenAI API rate limit exceeded. Vui lòng thử lại sau.");
    } else if (error.response?.status === 401) {
      throw new Error("OpenAI API key không hợp lệ hoặc hết quota.");
    } else {
      throw new Error("Lỗi kết nối: " + error.message);
    }
  }
};

export const fetchWelcome = async (conversationId) => {
  try {
    const { data } = await API.get("/api/ai/welcome", { params: { conversationId } });
    return data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error("Backend server không chạy. Hãy chạy BE trước.");
    } else if (error.response?.status === 500) {
      throw new Error("Lỗi server: " + (error.response?.data?.message || "Internal Server Error"));
    } else if (error.response?.status === 429) {
      throw new Error("OpenAI API rate limit exceeded. Vui lòng thử lại sau.");
    } else if (error.response?.status === 401) {
      throw new Error("OpenAI API key không hợp lệ hoặc hết quota.");
    } else {
      throw new Error("Lỗi kết nối: " + error.message);
    }
  }
};
