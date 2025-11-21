import axios from 'axios';
import AuthService from './AuthService';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/api';

// Tạo axios instance
const apiInstance = axios.create({
    baseURL: API_BASE_URL,
});

// Biến để tránh gọi refresh song song
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Request interceptor - gắn Authorization header
apiInstance.interceptors.request.use(
    (config) => {
        const auth = AuthService.getAuth();
        if (auth?.accessToken) {
            config.headers.Authorization = `Bearer ${auth.accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - xử lý refresh token khi 401
apiInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            // Không refresh cho chính endpoint refresh để tránh vòng lặp
            if (originalRequest.url?.includes('/auth/refresh')) {
                AuthService.clearAuth();
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Nếu đang refresh, đợi trong queue
                return new Promise((resolve, reject) => {
                    failedQueue.push({
                        resolve: (token) => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            resolve(apiInstance(originalRequest));
                        },
                        reject: (err) => reject(err)
                    });
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Gọi refresh token
                const refreshedAuth = await AuthService.refresh();
                
                // Cập nhật header cho request gốc
                originalRequest.headers.Authorization = `Bearer ${refreshedAuth.accessToken}`;
                
                // Xử lý queue
                processQueue(null, refreshedAuth.accessToken);
                
                // Retry request gốc
                return apiInstance(originalRequest);
                
            } catch (refreshError) {
                // Refresh thất bại
                processQueue(refreshError, null);
                AuthService.clearAuth();
                
                // Có thể redirect về login page ở đây nếu cần
                console.warn('Token refresh failed, please login again');
                
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

const ApiService = {
    post: async (url, data) => {
        try {
            const response = await apiInstance.post(url, data);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    get: async (url, config = {}) => {
        try {
            const response = await apiInstance.get(url, config);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    put: async (url, data, config = {}) => {
        try {
            const response = await apiInstance.put(url, data, config);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    delete: async (url, config = {}) => {
        try {
            const response = await apiInstance.delete(url, config);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
};

export default ApiService;