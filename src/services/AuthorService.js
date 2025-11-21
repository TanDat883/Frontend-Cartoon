import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + "/authors";

const AuthorService = {
  getAllAuthors: async () => (await axios.get(`${API_BASE_URL}/all`)).data,

  createAuthor: async (authorData) => (await axios.post(`${API_BASE_URL}/create`, authorData)).data,

  addMovieToAuthor: async (authorIds, movieId) =>
    (await axios.post(`${API_BASE_URL}/add-movie?authorId=${authorIds.join(",")}&movieId=${movieId}`)).data,

  addMovieToMultipleAuthors: async (authorIds, movieId) => {
    const params = new URLSearchParams();
    authorIds.forEach(id => params.append("authorIds", id));
    params.append("movieId", movieId);
    return (await axios.post(`${API_BASE_URL}/add-movie`, null, { params })).data;
  },

  getAuthorsByMovieId: async (movieId) =>
    (await axios.get(`${API_BASE_URL}/movie/${movieId}`)).data,

  // NEW:
  searchByNameRole: async (name, role) =>
    (await axios.get(`${API_BASE_URL}/search`, { params: { name, role } })).data,

  updateAuthor: async (authorId, { name, role }) =>
    (await axios.put(`${API_BASE_URL}/${authorId}`, null, { params: { name, role } })).data,

  deleteAuthor: async (authorId) =>
    (await axios.delete(`${API_BASE_URL}/${authorId}`)).data,

  deleteAuthors: async (ids) =>
    (await axios.post(`${API_BASE_URL}/delete`, ids)).data,
};

export default AuthorService;
