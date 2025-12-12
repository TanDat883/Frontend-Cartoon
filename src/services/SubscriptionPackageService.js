import axios from "axios";
import axiosInstance from "../api/axiosInstance";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL + '/subscription-packages';

// ⚠️ Cache để tránh gọi API nhiều lần
let packagesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 phút

const SubscriptionPackageService = {

    // get all packages
    getAll: async (page, size, keyword = "") => {
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

    //get all packages vs promotions
    getAllPackages: async () => {
        try {
            // ✅ Check cache first
            const now = Date.now();
            if (packagesCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
                console.log('[SubscriptionPackageService] ✅ Using cached packages');
                return packagesCache;
            }

            console.log('[SubscriptionPackageService] 🔄 Fetching packages from API...');
            const startTime = Date.now();

            const response = await axiosInstance.get(`${API_BASE_URL}/all`, {
                timeout: 10000, // 10s timeout
            });

            const fetchTime = Date.now() - startTime;
            console.log(`[SubscriptionPackageService] ✅ API responded in ${fetchTime}ms`);

            if (response.status !== 200) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Sort by price
            const sortedData = response.data.sort((a, b) => (a.amount || 0) - (b.amount || 0));

            // ✅ Cache the result
            packagesCache = sortedData;
            cacheTimestamp = now;

            return sortedData;
        } catch (error) {
            console.error('[SubscriptionPackageService] ❌ Error:', error);
            throw error.response ? error.response.data : error;
        }
    },

    // Clear cache manually (call after create/update/delete)
    clearCache: () => {
        console.log('[SubscriptionPackageService] 🧹 Clearing cache');
        packagesCache = null;
        cacheTimestamp = null;
    },

    //get package by id
    getPackageById: async (id) => {
        try {
            const response = await axiosInstance.get(`${API_BASE_URL}/${id}`);
            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
    //create package
    createPackage: async (payload, imageFile) => {
        const fd = new FormData();
        // Part "data" phải có content-type application/json
        fd.append(
            "data",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
        );
        if (imageFile) {
            fd.append("image", imageFile); // browser sẽ tự set type image/*
        }

        const res = await axiosInstance.post(`${API_BASE_URL}`, fd, {
            headers: { "Content-Type": "multipart/form-data" }, // có thể bỏ, axios tự set boundary
        });

        // Clear cache after create
        SubscriptionPackageService.clearCache();

        return res.data;
    },
    //update package
    updatePackage: async (packageId, payload, imageFile) => {
        const fd = new FormData();
        fd.append(
            "data",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
        );
        if (imageFile) {
            fd.append("image", imageFile);
        }

        const res = await axiosInstance.put(`${API_BASE_URL}/${packageId}`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        // Clear cache after update
        SubscriptionPackageService.clearCache();

        return res.data;
    },
    //check if package has active subscriptions
    checkActiveSubscriptions: async (packageId) => {
        try {
            const response = await axiosInstance.get(`${API_BASE_URL}/${packageId}/has-active-subscriptions`);
            return response.data;
        } catch (error) {
            console.error("Error checking active subscriptions:", error);
            return false;
        }
    },

    //delete package
    deletePackage: async (id) => {
        try {
            const response = await axiosInstance.delete(`${API_BASE_URL}/${id}`);

            SubscriptionPackageService.clearCache();

            return response.data;
        } catch (error) {
            throw error.response ? error.response.data : error;
        }
    },
};

export default SubscriptionPackageService;
