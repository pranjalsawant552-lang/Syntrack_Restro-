import axios from "axios";

//export const base_url = "http://localhost:8084/v1";
export const base_url = "/v1";

const axiosClient = axios.create({
  baseURL: base_url,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Optional token attach (if you use JWT in sessionStorage)
axiosClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the session has genuinely expired / token invalid / account deactivated mid-session,
// bounce to login instead of leaving the user stuck on a page full of failed requests.
// This is 401-only: a 403 means "you're logged in fine, but not allowed to do this
// specific thing" (an @PreAuthorize permission check failed) and must NOT log the
// user out -- it should just show an error where they are, so a Cashier who lacks
// one permission doesn't lose their in-progress work and get booted to /login.
// Login/refresh/forgot-password calls handle their own 401s inline, so they're excluded.
axiosClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || "";
    const isAuthEndpoint = url.startsWith("/auth/");

    if (status === 401 && !isAuthEndpoint) {
      const hadToken = !!sessionStorage.getItem("token");
      if (hadToken) {
        // Surface *why* the session ended (deactivated account, suspended company,
        // expired token, etc.) on the login screen instead of silently bouncing —
        // this matters a lot in multi-tenant setups where a Super Admin action
        // elsewhere can end a session the user didn't initiate.
        const serverMessage: string | undefined = error?.response?.data?.message;
        sessionStorage.removeItem("token");
        sessionStorage.setItem(
          "sessionEndReason",
          serverMessage || "Your session has ended. Please log in again."
        );
        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign("/login");
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
