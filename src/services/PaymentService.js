import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/payment';

const PaymentService = {
    // Create a new payment
    createPayment: async (paymentData) => {
        try {
            const response = await axiosInstance.post(`${API_BASE_URL}/create`, paymentData);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    // Get payment status by payment code
    getPaymentStatus: async (paymentCode) => {
        try {
            const response = await axiosInstance.get(`${API_BASE_URL}/${paymentCode}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    // Webhook to handle payment notifications
    handleWebhook: async (webhookData) => {
        try {
            const response = await axiosInstance.post(`${API_BASE_URL}/webhook`, webhookData);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    // Cancel a payment (if applicable)
    cancelPayment: async (paymentCode) => {
        try {
            const response = await axiosInstance.put(`${API_BASE_URL}/cancel/${paymentCode}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    // Get all payments (for admin purposes)
    // getAllPayments: async (page, size, keyword = "") => {
    //     try {
    //         const response = await axiosInstance.get(API_BASE_URL, {
    //             params: { page: page - 1, size, keyword },
    //         });
    //         const total = Number(response.headers["x-total-count"] ?? 0);
    //         return { items: response.data, total };
    //     } catch (error) {
    //         throw error.response ? error.response.data : error;
    //     }
    // },
    getAllPayments(page, size, keyword, status, range = {}) {
        const params = new URLSearchParams({
            page: String(page - 1),
            size: String(size),
        });
        if (keyword) params.append("keyword", keyword);
        if (status) params.append("status", status);
        if (range.startDate) params.append("startDate", range.startDate); // YYYY-MM-DD
        if (range.endDate) params.append("endDate", range.endDate);   // YYYY-MM-DD

        return axiosInstance.get(`/payment?${params.toString()}`)
            .then(res => ({
                items: res.data,
                total: Number(res.headers["x-total-count"] || 0),
            }));
    },
    // Get payment by ID
    getPaymentById: async (paymentId) => {
        try {
            const response = await axiosInstance.get(`${API_BASE_URL}/info/${paymentId}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    // Get payment detail by ID
    getPaymentDetailById: async (paymentId) => {
        try {
            const response = await axiosInstance.get(`${API_BASE_URL}/details/${paymentId}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    requestRefund: async (refundData) => {
        try {
            const response = await axiosInstance.post(`${API_BASE_URL}/refund-request`, refundData);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    approveRefund: async (paymentCode) => {
        try {
            const response = await axiosInstance.put(`${API_BASE_URL}/refund/${paymentCode}/approve`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    rejectRefund: async (paymentCode) => {
        try {
            const response = await axiosInstance.put(`${API_BASE_URL}/refund/${paymentCode}/reject`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
};

export default PaymentService;
