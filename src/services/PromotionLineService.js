import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/promotion-lines';

const PromotionLineService = {
  getAllPromotionLinesByPromotionId: async (promotionId) => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/by-promotion/${promotionId}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  createPromotionLine: async (data) => {
    try {
      const response = await axiosInstance.post(API_BASE_URL, data);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  updatePromotionLine: async (promotionId, lineId, data) => {
    try {
      const response = await axiosInstance.put(`${API_BASE_URL}/${promotionId}/${lineId}`, data);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};
export default PromotionLineService;
