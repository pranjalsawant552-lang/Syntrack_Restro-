import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import settingsReducer from "./settingsSlice";
import brandingReducer from "./brandingSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
    branding: brandingReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
