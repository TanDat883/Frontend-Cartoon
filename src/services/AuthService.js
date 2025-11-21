import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/auth';
const storageKey = 'my_user';

const AuthService = {
    // Local storage helpers - sử dụng my_user thay vì auth_data
  setAuth: (data) => localStorage.setItem(storageKey, JSON.stringify(data)),
  getAuth: () => {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  },
  clearAuth: () => {
    localStorage.removeItem(storageKey);
    // Cleanup auth_data cũ nếu tồn tại
    localStorage.removeItem('auth_data');
  },
    post: async (url, data) => {
        try {
            const response = await axios.post(`${API_BASE_URL}${url}`, data);
            console.log("e", response.data);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    //change password
    changePassword: async ({username,currentPassword,newPassword }) => {
        return await AuthService.post('/change-password', {username,currentPassword,newPassword });
    },

     // REFRESH: lấy access/id token mới từ refreshToken (gọi backend /auth/refresh)
  refresh: async () => {
    const auth = AuthService.getAuth();
    if (!auth?.refeshToken && !auth?.refreshToken) {
      throw new Error("Missing refresh token");
    }
    
    // Sử dụng refeshToken từ BE (có typo) hoặc refreshToken
    const refreshToken = auth.refeshToken || auth.refreshToken;
    
    const payload = {
      username: auth?.username || auth?.my_user?.phoneNumber || auth?.userAttributes?.phone_number,
      refreshToken: refreshToken,
    };
    
    const data = await AuthService.post("/refresh", payload);
    
    // Gộp token mới vào auth cũ (refreshToken giữ nguyên)
    const merged = { 
      ...auth, 
      ...data,
      // Giữ lại refreshToken gốc vì BE không trả về refreshToken mới
      refeshToken: refreshToken,
      refreshToken: refreshToken
    };
    
    AuthService.setAuth(merged);
    return merged;
  },
};

export default AuthService;


