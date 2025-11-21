import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/promotion-details';

const PromotionDetailService = {
  
  // lay tat ca package thuoc khuyen mai
  getPromotionPackages: async (id) => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/packages?promotionLineId=${id}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  // ap dung package vao promotion
  createPromotionPackage: async (data) => {
    try {
      const response = await axiosInstance.post(`${API_BASE_URL}/packages`, data);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  // xoa package khoi promotion
  deletePromotionPackage: async (id, packages) => {
    try {
      const response = await axiosInstance.delete(
        `${API_BASE_URL}/packages`,
        {
          params: {
            promotionId: id,
            packageId: packages,
          },
          paramsSerializer: (params) => {
            // ép axios serialize array thành ?packageId=a&packageId=b
            return new URLSearchParams(params).toString();
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  // cap nhat package trong promotion
  updatePromotionPackage: async (id, packages, newPercent) => {
    const pkgs = Array.isArray(packages) ? packages : [packages];

    return axiosInstance.put(
      `${API_BASE_URL}/packages`,
      null,                                 
      {
        params: {
          promotionId: id,
          packageId: pkgs,            
          newPercent: newPercent,
        },
        paramsSerializer: (params) => {
          const usp = new URLSearchParams();
          usp.append('promotionId', params.promotionId);
          (params.packageId || []).forEach((p) => usp.append('packageId', p));
          usp.append('newPercent', String(params.newPercent));
          return usp.toString();
        },
      }
    ).then(res => res.data);
  },

  // ap dung ma khuyen mai cho order
  applyVoucherCode: async (data) => {
    try {
      const response = await axiosInstance.post(`${API_BASE_URL}/vouchers/apply`, data);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  // lay thong tin vouchercode
  getVoucherInfo: async (voucherCode) => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/voucher?voucherCode=${voucherCode}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  // tao voucher
  createPromotionVoucher: async (data) => {
    try {
      const response = await axiosInstance.post(`${API_BASE_URL}/vouchers`, data);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  // lay thong tin tat ca voucher theo promotion
  getPromotionVouchers: async (promotionLineId) => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/vouchers?promotionLineId=${promotionLineId}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  // xoa voucher
  deletePromotionVoucher: async (id, voucherCode) => {
    try {
      const response = await axiosInstance.delete(`${API_BASE_URL}/vouchers?promotionId=${id}&voucherCode=${voucherCode}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  // cap nhat voucher
  updatePromotionVoucher: async (id, voucherCode, data) => {
    try {
      const response = await axiosInstance.put(`${API_BASE_URL}/vouchers?promotionId=${id}&voucherCode=${voucherCode}`, data);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};
export default PromotionDetailService;
