import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { brandingApi, type Branding } from "../components/branding/brandingApi";

type BrandingState = {
  appName: string;
  logoUrl: string;
  loaded: boolean;
};

const DEFAULT_BRANDING: Branding = { appName: "Syntrack Restro", logoUrl: "/logo.svg" };

const initialState: BrandingState = {
  appName: DEFAULT_BRANDING.appName,
  logoUrl: DEFAULT_BRANDING.logoUrl,
  loaded: false,
};

// Called once the user is authenticated (their own tenant's branding).
export const fetchMyBranding = createAsyncThunk("branding/fetchMine", async () => {
  try {
    return await brandingApi.getMine();
  } catch {
    return DEFAULT_BRANDING;
  }
});

// Called on the login screen, optionally scoped to a company slug the user typed.
export const fetchPublicBranding = createAsyncThunk(
  "branding/fetchPublic",
  async (slug: string | undefined) => {
    try {
      return await brandingApi.getPublic(slug);
    } catch {
      return DEFAULT_BRANDING;
    }
  }
);

const brandingSlice = createSlice({
  name: "branding",
  initialState,
  reducers: {
    setBranding(state, action: { payload: Branding }) {
      state.appName = action.payload.appName || DEFAULT_BRANDING.appName;
      state.logoUrl = action.payload.logoUrl || DEFAULT_BRANDING.logoUrl;
      state.loaded = true;
    },
    resetBranding(state) {
      state.appName = DEFAULT_BRANDING.appName;
      state.logoUrl = DEFAULT_BRANDING.logoUrl;
      state.loaded = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyBranding.fulfilled, (state, action) => {
        state.appName = action.payload.appName || DEFAULT_BRANDING.appName;
        state.logoUrl = action.payload.logoUrl || DEFAULT_BRANDING.logoUrl;
        state.loaded = true;
      })
      .addCase(fetchPublicBranding.fulfilled, (state, action) => {
        state.appName = action.payload.appName || DEFAULT_BRANDING.appName;
        state.logoUrl = action.payload.logoUrl || DEFAULT_BRANDING.logoUrl;
        state.loaded = true;
      });
  },
});

export const { setBranding, resetBranding } = brandingSlice.actions;

export const selectBranding = (s: RootState) => s.branding;

export default brandingSlice.reducer;
