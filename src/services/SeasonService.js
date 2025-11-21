import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + "/seasons";

const SeasonService = {
  // Tạo season mới cho movie
  createSeason: async ({ movieId, seasonNumber, title, description, releaseYear, posterUrl }) => {
    const params = new URLSearchParams();
    params.append("movieId", movieId);
    params.append("seasonNumber", seasonNumber);
    if (title) params.append("title", title);
    if (description) params.append("description", description);
    if (releaseYear) params.append("releaseYear", releaseYear);
    if (posterUrl) params.append("posterUrl", posterUrl);

    const res = await axios.post(`${API_BASE_URL}/create?${params.toString()}`);
    return res.data;
  },

  // List seasons theo movie
  getSeasonsByMovie: async (movieId) => {
    const res = await axios.get(`${API_BASE_URL}/movie/${movieId}`);
    return res.data;
  },

  // Lấy một season theo (movieId, seasonNumber)
  getSeason: async (movieId, seasonNumber) => {
    const res = await axios.get(`${API_BASE_URL}/movie/${movieId}/number/${seasonNumber}`);
    return res.data;
  },

  // Cập nhật season
  updateSeason: async (movieId, seasonNumber, { title, description, releaseYear }) => {
    const params = new URLSearchParams();
    if (title) params.append("title", title);
    if (description) params.append("description", description);
    if (releaseYear) params.append("releaseYear", releaseYear);
    try {
      // Use POST with update in path to distinguish from create
      const postUrl = `${API_BASE_URL}/update/${movieId}/${seasonNumber}?${params.toString()}`;
      const res = await axios.post(postUrl);
      return res.data;
    } catch (error) {

      
      // Fallback: Try the original PUT one more time
      if (error.response?.status === 404) {

        try {
          const putUrl = `${API_BASE_URL}/movie/${movieId}/number/${seasonNumber}?${params.toString()}`;
          const res = await axios.put(putUrl);
          return res.data;
        } catch (putError) {

          throw putError;
        }
      }
      
      throw error;
    }
  },
  // Xoá season
  deleteSeason: async (movieId, seasonNumber) => {
    const res = await axios.delete(`${API_BASE_URL}/movie/${movieId}/number/${seasonNumber}`);
    return res.data;
  },
};

export default SeasonService;
