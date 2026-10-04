import { useEffect } from 'react'
import './App.css'
import AppRoutes from './routes/AppRoutes'
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store/store';
import { bootstrapAuth } from './store/authSlice';
import { fetchMyBranding, fetchPublicBranding, selectBranding } from './store/brandingSlice';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, bootLoading } = useSelector((s: RootState) => s.auth);
  const branding = useSelector(selectBranding);

  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  // Load branding: the tenant's own once logged in, otherwise a generic default
  // (the login screen fetches company-specific branding itself once a slug is typed).
  useEffect(() => {
    if (bootLoading) return;
    if (isAuthenticated) {
      dispatch(fetchMyBranding());
    } else {
      dispatch(fetchPublicBranding(undefined));
    }
  }, [dispatch, isAuthenticated, bootLoading]);

  // Apply branding globally: browser tab title + favicon.
  useEffect(() => {
    // Customer QR pages (/t/...) show the restaurant's own name, not the vendor's default.
    if (!window.location.pathname.startsWith("/t/")) {
      document.title = branding.appName || "Syntrack Restro";
    }
    if (branding.logoUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.logoUrl;
    }
  }, [branding.appName, branding.logoUrl]);

  return (
    <>
      <AppRoutes />
    </>
  )
}

export default App
