import React from "react";
import { Box, CssBaseline, useMediaQuery } from "@mui/material";
import { type Theme } from "@mui/material/styles";


import MobileBottomNav from "./MobileBottomNav";
import TopBar from "./TopBar";
import SideNav from "./SideNav";
import KotAutoPrinter from "../kot/KotAutoPrinter";

const drawerWidth = 200;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery((t: Theme) => t.breakpoints.down("md"));

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <CssBaseline />
      <KotAutoPrinter />

      <TopBar drawerWidth={drawerWidth} />

      {!isMobile && <SideNav drawerWidth={drawerWidth} />}

      <Box
        component="main"
        sx={{
          flex: 1,
         pt: { xs: 6, md: 7 },
          px: { xs: 1, sm: 1, md: 1 },
          pb: isMobile ? 10 : 3, // space for bottom nav on mobile
          background: "#f7f7f7",
        }}
      >
        {children}
      </Box>

      {/* Mobile bottom nav */}
      {isMobile && <MobileBottomNav />}
    </Box>
  );
}
