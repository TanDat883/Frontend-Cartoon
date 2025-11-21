import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/export';

const ExportService = {
    // Xuất báo cáo doanh thu
    exportRevenueReport: (from, to) => {
        return axiosInstance.get(`${API_BASE_URL}/dashboard`, {
            params: { from, to },
            responseType: 'blob' // Đảm bảo nhận về file
        });
    }
};

export default ExportService;