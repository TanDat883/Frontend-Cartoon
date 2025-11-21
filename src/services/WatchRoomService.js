import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/watchrooms';

const WatchRoomService = {
    // Lấy danh sách phòng xem
    getWatchRooms: async () => {
        try {
            const response = await axiosInstance.get(API_BASE_URL);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    // Tạo phòng xem mới
    createWatchRoom: async (data) => {
        try {
            const response = await axiosInstance.post(API_BASE_URL, data);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    // Lấy thông tin phòng xem theo ID
    getWatchRoomById: async (roomId) => {
        try {
            // console.log(`[WatchRoomService] Fetching room ${roomId}...`);
            const startTime = Date.now();
            
            const response = await axiosInstance.get(`${API_BASE_URL}/${encodeURIComponent(roomId)}`);
            
            const duration = Date.now() - startTime;
            // console.log(`[WatchRoomService] ✅ Room fetched in ${duration}ms`);
            
            return response.data;
        } catch (error) {
            console.error(`[WatchRoomService] ❌ Error fetching room:`, error);
            
            // Handle specific error types
            if (error.code === 'ECONNABORTED') {
                throw new Error('⏱️ Request timeout - Server mất quá nhiều thời gian phản hồi');
            }
            
            if (error.response?.status === 404) {
                throw new Error('ROOM_GONE');
            }
            
            throw error.response ? error.response.data : error;
        }
    },

    joinWatchRoom: async (data) => {
        try {
            const response = await axiosInstance.post(`${API_BASE_URL}/watch-rooms/join`, data);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    // Xác thực invite code cho phòng private
    verifyInviteCode: async (roomId, inviteCode) => {
        try {
            const response = await axiosInstance.post(`${API_BASE_URL}/${encodeURIComponent(roomId)}/verify-invite`, {
                inviteCode: inviteCode
            });
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
};
export default WatchRoomService;
