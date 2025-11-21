import axios from "axios";
import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/movies';

const MovieService = {

    //get all movies
    getAllMovies: async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/all`);
            return (response.data || []).sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    // BE mới có endpoint detail
    getMovieDetail: async (movieId) => {
        try{
            const res = await axios.get(`${API_BASE_URL}/${movieId}/detail`);
            return res.data;
            }catch(error){
               throw error.response ? error.response.data : error;
            }
    },

    // Get movie detail by slug
    getMovieDetailBySlug: async (slug) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/slug/${slug}/detail`);
            return res.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    // Get movie by slug (basic info)
    getMovieBySlug: async (slug) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/slug/${slug}`);
            return res.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },


    //get movie by id
    getMovieById: async (id) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/${id}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    //add new movie
        createMovie: async (movieData) => {
            try {
                const token = localStorage.getItem("idToken");
                const response = await axios.post(`${API_BASE_URL}/create`, movieData,{
                    headers: {
                      
                        'Authorization': `Bearer ${token}`
                    }
                });
                return response.data;
            } catch (error) {
                throw error.response ? error.response.data : error;
            }
        },


    //xóa nhìu movie
        deleteMovies: async (ids) => {
            try {
                const token = localStorage.getItem("idToken");
                const response = await axios.post(`${API_BASE_URL}/delete`, ids, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                });
                return response.data;
            } catch (error) {
                throw error.response ? error.response.data : error;
            }
        },



    //update movie
    updateMovie: async (movieId,movieData) => {
        try {
            const response = await axios.put(`${API_BASE_URL}/${movieId}/update`, movieData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    //tìm phim theo genres
    getMoviesByGenre: async (genre) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/genre/${genre}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    //tìm phim theo title gần đúng
    searchMovies: async (title) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/search`, { params: { title } });
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    
    //lọc phim theo năm va tháng
    filterMoviesByYearAndMonth: async (year, month) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/filter`, { params: { year, month } });
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    //tìm phim theo quốc gia
    getMoviesByCountry: async (country) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/country/${encodeURIComponent(country)}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    //tìm phim theo movieType
    getMoviesByType: async (type) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/type/${encodeURIComponent(type)}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    //tìm phim theo topic
    getMovieByTopic: async (topic) => {
        try{
            const response = await axios.get(`${API_BASE_URL}/topic/${encodeURIComponent(topic)}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    //tăng view count
    incrementViewCount: async (movieId) => {
        try {
            const response = await axios.put(`${API_BASE_URL}/${movieId}/increment-view`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    //top 10 phim nổi bật
    getPopularMovies: async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/popular`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    // lưu rating của bộ phim
    saveMovieRating: async (movieId, rating, userId) => {
    try {
        const response = await axios.post(
        `${API_BASE_URL}/${movieId}/rate`,
        null, // body rỗng, vì BE nhận @RequestParam
        {
            params: { rating },           // ✅ truyền ?rating=5
            headers: { userId },          // ✅ truyền userId đúng header name
        }
        );
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : error;
    }
    },
    //getall đánh giá của 1 bộ phim
    getAllMovieRatings: async (movieId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/${movieId}/ratings`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },

    //logic phát hành phim
        publish: async (movieId, target, { trailerVideo, episode1Video } = {}) => {
        const token = localStorage.getItem("idToken");
        const form = new FormData();
        if (trailerVideo)  form.append("trailerVideo", trailerVideo);
        if (episode1Video) form.append("episode1Video", episode1Video);

        const res = await axios.post(
            `${API_BASE_URL}/${movieId}/publish`,
            form,
            { params: { target }, headers: { Authorization: `Bearer ${token}` } }
        );
        return res.data;
        },


    getRecommendations: async (movieId, limit = 6) => {
        const res = await axios.get(`${API_BASE_URL}/${movieId}/recommendations`, {
            params: { limit }
        });
        return res.data;
        },

          // ✅ BE trả 200 nếu được, 403/404 nếu không.
        canWatch: async (movieId, userId) => {
            try {
            // console.log("Making VIP check with:", { movieId, userId }); // Debug log
            
            // Headers: chỉ gửi userId nếu có (FREE movies không cần)
            const headers = {};
            if (userId) {
                headers.userId = userId;
            }
            
            const res = await axiosInstance.get(`${API_BASE_URL}/${movieId}/watch`, { headers });
            // console.log("VIP check success:", res.data); // Debug log
            
            return { 
                allowed: res.data.allowed || true, 
                data: res.data 
            };
            } catch (err) {
            // console.log("VIP check error:", err.response); // Debug log
            const status = err?.response?.status;
            
            // BE trả JSON error: { message: "...", status: 403, ... }
            let message = "Không được phép xem.";
            if (err?.response?.data) {
                const errorData = err.response.data;
                if (typeof errorData === 'object' && errorData.message) {
                    message = errorData.message;
                } else if (typeof errorData === 'string') {
                    message = errorData;
                }
            }
            
            return { 
                allowed: false, 
                status, 
                message 
            };
            }
        },
}

export default MovieService;