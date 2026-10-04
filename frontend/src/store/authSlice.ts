import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppDispatch } from "./store";
import axiosClient from "../components/axiosData/axiosClient";

export type AppUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  // Free-text role name (e.g. TENANT_ADMIN, MANAGER, CASHIER, or any custom role name).
  role: string;
  phoneNumber?: string;
  active: boolean;
  superAdmin: boolean;
  tenantName?: string;
  tenantSlug?: string;
  permissions: string[];
};

export type AuthResponse = {
  token: string;
  user: AppUser;
};

type AuthState = {
  user: AppUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;      // login loading
  bootLoading: boolean;  // refresh-on-load loading
  error: string | null;
};

const initialState: AuthState = {
  user: null,
  token: sessionStorage.getItem("token"),
  isAuthenticated: false, // do NOT assume auth true until refresh confirms
  loading: false,
  bootLoading: true,      // app start pe refresh call chalega
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    authStart(state) {
      state.loading = true;
      state.error = null;
    },
    bootStart(state) {
      state.bootLoading = true;
      state.error = null;
    },
    authSuccess(state, action: PayloadAction<AuthResponse>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.loading = false;
      state.bootLoading = false;
      state.error = null;

      // only token in sessionStorage
      sessionStorage.setItem("token", action.payload.token);
    },
    authFail(state, action: PayloadAction<string>) {
      state.loading = false;
      state.bootLoading = false;
      state.error = action.payload;
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;

      sessionStorage.removeItem("token");
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.bootLoading = false;
      state.error = null;
      sessionStorage.removeItem("token");
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
});

export const {
  authStart,
  bootStart,
  authSuccess,
  authFail,
  logout,
  clearAuthError,
} = authSlice.actions;

export default authSlice.reducer;

/**
 * App refresh bootstrap:
 * - If token exists in sessionStorage => call /v1/auth/refresh
 * - If success => update redux user + replace token
 * - If fail => logout
 */
export const bootstrapAuth = () => async (dispatch: AppDispatch) => {
  dispatch(bootStart());

  const token = sessionStorage.getItem("token");

  // If a mid-session request was rejected (deactivated account, suspended company,
  // expired token, etc.), axiosClient's interceptor stashes why before redirecting
  // here on a full page reload — surface that instead of a silent, unexplained
  // bounce back to the login screen.
  const sessionEndReason = sessionStorage.getItem("sessionEndReason");
  if (sessionEndReason) {
    sessionStorage.removeItem("sessionEndReason");
  }

  if (!token) {
    dispatch(authFail(sessionEndReason || "")); // no token => not logged in
    return;
  }

  try {
    // token goes in header automatically via axios interceptor
    const res = await axiosClient.post("/auth/refresh", {});
    dispatch(authSuccess(res.data)); // expects { token, user }
  } catch (e: any) {
    const msg = e?.response?.data?.error || "Session expired, please login again";
    dispatch(authFail(msg));
  }
};
