import axios from "axios";
import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/feedback';

const FeedbackService = {

    getListFeedbackByIdMovie: async (movieId, page, size) => {
        const res = await axios.get(`${API_BASE_URL}/${movieId}`, {
            params: { page, size },
            validateStatus: s => (s >= 200 && s < 300) || s === 204,
        });

        const items = Array.isArray(res.data) ? res.data : [];
        const total = Number(res.headers['x-total-count'] ?? 0);
        const totalPages = total > 0 ? Math.ceil(total / size) : (items.length === size ? page + 2 : page + 1);

        return { items, total, totalPages };
    },

    submitFeedback: async (feedbackData) => {
        const response = await axiosInstance.post(API_BASE_URL, feedbackData);
        return response.data;
    },
    // like feedback
    likeFeedback: async (feedbackId, userId) => {
        const response = await axiosInstance.post(
            `${API_BASE_URL}/like/${feedbackId}?userId=${userId}`
        );
        return response.data;
    },

    // dislike feedback
    dislikeFeedback: async (feedbackId, userId) => {
        const response = await axiosInstance.post(
            `${API_BASE_URL}/dislike/${feedbackId}?userId=${userId}`
        );
        return response.data;
    }

};

export default FeedbackService;
