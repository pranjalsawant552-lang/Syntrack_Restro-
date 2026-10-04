import { createAsyncThunk, createSlice,type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { SettingMaster } from "../utils/types";
import { settingApi } from "../components/settings/settingApi";

type SettingsState = {
  current: SettingMaster | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
};

const emptySetting: SettingMaster = {
  settingId: undefined as any,
  companyName: "",
  address: "",
  city: "",
  phoneNumber: "",
  email: "",
  gstNumber: "",
};

const initialState: SettingsState = {
  current: null,
  loading: false,
  error: null,
  lastFetchedAt: null,
};

// ✅ fetch and store in redux
export const fetchCurrentSetting = createAsyncThunk<
  SettingMaster,
  void,
  { rejectValue: string }
>("settings/fetchCurrent", async (_, { rejectWithValue }) => {
  try {
    const data = await settingApi.getCurrent();
    return data ?? emptySetting;
  } catch (e: any) {
    // if 404 -> return empty (allow create)
    if (e?.response?.status === 404) return emptySetting;
    return rejectWithValue(
      e?.response?.data?.message ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load settings"
    );
  }
});

// ✅ save to backend then store in redux
export const upsertCurrentSetting = createAsyncThunk<
  SettingMaster,
  SettingMaster,
  { rejectValue: string }
>("settings/upsertCurrent", async (payload, { rejectWithValue }) => {
  try {
    const saved = await settingApi.upsertCurrent(payload);
    return saved;
  } catch (e: any) {
    return rejectWithValue(
      e?.response?.data?.message ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to update settings"
    );
  }
});

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    // optional manual setter
    setCurrentSetting(state, action: PayloadAction<SettingMaster | null>) {
      state.current = action.payload;
      state.error = null;
    },
    clearSettingsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchCurrentSetting.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentSetting.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchCurrentSetting.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load settings";
      })

      // upsert
      .addCase(upsertCurrentSetting.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(upsertCurrentSetting.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(upsertCurrentSetting.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to update settings";
      });
  },
});

export const { setCurrentSetting, clearSettingsError } = settingsSlice.actions;

// selectors
export const selectCompanySetting = (s: RootState) => s.settings.current;
export const selectSettingsLoading = (s: RootState) => s.settings.loading;
export const selectSettingsError = (s: RootState) => s.settings.error;

export default settingsSlice.reducer;
