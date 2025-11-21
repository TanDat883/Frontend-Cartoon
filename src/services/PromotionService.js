import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/promotions';

const PromotionService = {

  getAllPromotions: async (page, size, keyword = "") => {
    try {
      const response = await axiosInstance.get(API_BASE_URL, {
        params: { page: page - 1, size, keyword },
      });
      const total = Number(response.headers["x-total-count"] ?? 0);
      return { items: response.data, total };
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getAllPromotionsNoPagination: async () => {
    try {
      const response = await axiosInstance.get(API_BASE_URL + '/all');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  getPromotionById: async (id) => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  createPromotion: async (data) => {
    try {
      const response = await axiosInstance.post(API_BASE_URL, data);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  updatePromotion: async (id, data) => {
    try {
      const response = await axiosInstance.put(`${API_BASE_URL}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  deletePromotion: async (id) => {
    try {
      const response = await axiosInstance.delete(`${API_BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

};
export default PromotionService;
