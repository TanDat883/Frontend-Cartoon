import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/pricing';

const PricingService = {
    // fetch all price lists with pagination and optional keyword filtering
     getAllPriceList: async (page, size, keyword = "") => {
        try {
            const response = await axiosInstance.get(`${API_BASE_URL}/all-price-lists`, {
                params: { page: page - 1, size, keyword },
            });
            const total = Number(response.headers["x-total-count"] ?? 0);
            return { items: response.data, total };
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    // create price list
    createPriceList: async (priceListData) => {
        try {
            const response = await axiosInstance.post(`${API_BASE_URL}/create-price-list`, priceListData);
            return response.data;
        } catch (error) {
            console.error('Error creating price list:', error);
            throw error;
        }
    },
    // update price list
    updatePriceList: async (priceListId, priceListData) => {
        try {
            const response = await axiosInstance.put(`${API_BASE_URL}/update-price-list/${priceListId}`, priceListData);
            return response.data;
        } catch (error) {
            console.error('Error updating price list:', error);
            throw error;
        }
    },
    // update end date of price list
    updatePriceListEndDate: async (priceListId, newEndDate, carryForwardMissing = false) => {
        try {
            const body = { newEndDate, carryForwardMissing };
            const res = await axiosInstance.patch(`${API_BASE_URL}/price-lists/${priceListId}/extend`, body);
            return res.data;
        } catch (error) {
            console.error('Error updating price list end date:', error);
            throw error;
        }
    },
    // create items for price list
    addPriceItem: async (priceItemData) => {
        try {
            const response = await axiosInstance.post(`${API_BASE_URL}/price-items`, priceItemData);
            return response.data;
        } catch (error) {
            console.error('Error creating price list items:', error);
            throw error;
        }
    },
    // get items by price list id
    getPriceListItems: async (priceListId) => {
        try {
            const response = await axiosInstance.get(`${API_BASE_URL}/price-items/${priceListId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching price list items:', error);
            throw error;
        }
    },

};

export default PricingService;
