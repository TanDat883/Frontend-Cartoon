import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/data-analyzer';

const DataAnalyzerService = {
  // ======= REVENUE ANALYTICS =======
  // Lấy doanh thu theo ngày của 1 tháng
  getRevenueByDay: (year, month) => {
    return axiosInstance.get(`${API_BASE_URL}/revenue/day`, {
      params: { year, month }
    });
  },

  // Lấy doanh thu theo 12 tháng của 1 năm
  getRevenueByMonth: (year) => {
    return axiosInstance.get(`${API_BASE_URL}/revenue/month`, {
      params: { year }
    });
  },

  // Lấy doanh thu theo nhiều năm (from → to)
  getRevenueByYear: (from, to) => {
    return axiosInstance.get(`${API_BASE_URL}/revenue/year`, {
      params: { from, to }
    });
  },

  // tổng quan doanh thu
  getSummary: () => {
    return axiosInstance.get(`${API_BASE_URL}/revenue/summary`);
  },

  // thống kê nhanh
  getQuickStats: () => {
    return axiosInstance.get(`${API_BASE_URL}/revenue/quick-stats`);
  },

  // 5 giao dich gần nhất - dùng lại của đạt
  getRecentTransactionsLegacy: () => {
    return axiosInstance.get(`${API_BASE_URL}/revenue/recent-transactions`);
  },

    // ===== MỚI (RANGE APIs) =====
  getRevenueByRange: (startDate, endDate, groupBy = 'DAY') =>
    axiosInstance.get(`${API_BASE_URL}/revenue/range`, { params: { startDate, endDate, groupBy } }),

  getRevenueSummaryByRange: (startDate, endDate) =>
    axiosInstance.get(`${API_BASE_URL}/revenue/range/summary`, { params: { startDate, endDate } }),

  // Recent transactions có phân trang + (optional) range filter
    getRecentTransactionsPaged: (page = 1, size = 10, startDate, endDate) =>
    axiosInstance.get(`${API_BASE_URL}/revenue/recent-transactions/paged`, {
      params: { page, size, startDate, endDate }
    }),

  // ======= MOVIE ANALYTICS =======
  // Tổng quan thống kê phim
  getMovieSummary: (year, month) => {
    return axiosInstance.get(`${API_BASE_URL}/movies/summary`, {
      params: { year, month }
    });
  },

  // Phim mới theo ngày trong tháng
  getNewMoviesByDay: (year, month) => {
    return axiosInstance.get(`${API_BASE_URL}/movies/new/day`, {
      params: { year, month }
    });
  },

  // Phim mới theo tháng trong năm
  getNewMoviesByMonth: (year) => {
    return axiosInstance.get(`${API_BASE_URL}/movies/new/month`, {
      params: { year }
    });
  },

  // Thống kê theo thể loại
  getCountByGenre: (top = 10) => {
    return axiosInstance.get(`${API_BASE_URL}/movies/genre`, {
      params: { top }
    });
  },

  // Thống kê theo quốc gia
  getCountByCountry: (top = 10) => {
    return axiosInstance.get(`${API_BASE_URL}/movies/country`, {
      params: { top }
    });
  },

  // Thống kê theo trạng thái
  getStatusBreakdown: () => {
    return axiosInstance.get(`${API_BASE_URL}/movies/status`);
  },

  // Thống kê theo loại phim
  getTypeBreakdown: () => {
    return axiosInstance.get(`${API_BASE_URL}/movies/type`);
  },

  // Phân bố năm phát hành
  getReleaseYearDistribution: (from, to) => {
    return axiosInstance.get(`${API_BASE_URL}/movies/release-year`, {
      params: { from, to }
    });
  },

  // Số tập mỗi season của một phim
  getEpisodesPerSeason: (movieId) => {
    return axiosInstance.get(`${API_BASE_URL}/movies/${movieId}/episodes-per-season`);
  },

  // Top phim theo lượt xem
  getTopByViews: (limit = 10) => {
    return axiosInstance.get(`${API_BASE_URL}/movies/top/views`, {
      params: { limit }
    });
  },

  // Top phim theo rating
  getTopByRating: (limit = 10, minRatings = 5) => {
    return axiosInstance.get(`${API_BASE_URL}/movies/top/rating`, {
      params: { limit, minRatings }
    });
  },

  // ===== MOVIES RANGE =====
  getNewMoviesByRange: (startDate, endDate, groupBy = 'DAY') =>
    axiosInstance.get(`${API_BASE_URL}/movies/new/range`, { params: { startDate, endDate, groupBy } }),

  getMovieSummaryByRange: (startDate, endDate) =>
    axiosInstance.get(`${API_BASE_URL}/movies/range/summary`, { params: { startDate, endDate } }),

  // ======= EXPORT EXCEL (BACKEND) =======
  // Tải Excel theo year/month (giống file mẫu)
  downloadDashboardExcelYM: (year, month) =>
    axiosInstance.get(`${API_BASE_URL}/export/dashboard.xlsx`, {
      params: { year, month },
      responseType: 'blob'
    }),

  // Tải Excel theo khoảng ngày + groupBy (có thể truyền thông tin công ty + CTKM)
  downloadDashboardExcelRange: (startDate, endDate, groupBy = 'DAY', brand = {}, includePromotions = false, topVoucherLimit = 10) =>
    axiosInstance.get(`${API_BASE_URL}/export/dashboard-range.xlsx`, {
      params: { 
        startDate, 
        endDate, 
        groupBy, 
        companyName: brand.companyName,
        companyAddress: brand.companyAddress,
        includePromotions: includePromotions,
        topVoucherLimit: topVoucherLimit
      },
      responseType: 'blob'
    }),

  // Tải Excel báo cáo phim từ backend endpoint
  downloadMoviesExcelRange: (startDate, endDate, groupBy = 'DAY', brand = {}) =>
    axiosInstance.get(`${process.env.REACT_APP_API_BASE_URL}/export/export/movies.xlsx`, {
      params: { 
        startDate, 
        endDate, 
        groupBy, 
        companyName: brand.companyName,
        companyAddress: brand.companyAddress
      },
      responseType: 'blob'
    }),

  // ======= PROMOTIONS ANALYTICS =======
  // 1) Tổng quan khuyến mãi trong khoảng ngày
  getPromotionSummary: (startDate, endDate) => {
    // Đảm bảo có default dates nếu không truyền vào
    const defaultStartDate = startDate || '2024-01-01';
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
    return axiosInstance.get(`${API_BASE_URL}/promotions/summary`, { 
      params: { startDate: defaultStartDate, endDate: defaultEndDate } 
    });
  },

  // 2) BXH voucher (top N)
  getVoucherLeaderboard: (startDate, endDate, limit = 10) => {
    // Đảm bảo có default dates nếu không truyền vào
    const defaultStartDate = startDate || '2024-01-01';
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
    return axiosInstance.get(`${API_BASE_URL}/promotions/vouchers/leaderboard`, { 
      params: { startDate: defaultStartDate, endDate: defaultEndDate, limit } 
    });
  },

  // 3) Stats theo promotion line (có thể lọc theo promotionId)
  getPromotionLineStats: (startDate, endDate, promotionId = null) => {
    // Đảm bảo có default dates nếu không truyền vào
    const defaultStartDate = startDate || '2024-01-01';
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
    const params = { startDate: defaultStartDate, endDate: defaultEndDate };
    if (promotionId) params.promotionId = promotionId;
    return axiosInstance.get(`${API_BASE_URL}/promotions/lines`, { params });
  },

  // ======= CUSTOMERS ANALYTICS =======
  // ✅ FIX: Doanh số khách hàng theo khoảng ngày
  // Backend đã fix bug map key types trong DataAnalyzerServiceImpl.getCustomerSalesByRange()
  // Endpoint verified: /customers/sales
  getCustomerSales: (startDate, endDate) => {
    return axiosInstance.get(`${API_BASE_URL}/customers/sales`, {
      params: { startDate, endDate }
    });
  },

};

export default DataAnalyzerService;
