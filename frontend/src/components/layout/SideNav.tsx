import React from "react";
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography, Box, Switch, FormControlLabel, Divider } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { GROUP_LABEL, GROUP_ORDER, NAV_ITEMS, useNavMode, visibleNavItems, type NavItem } from "./navConfig";

export default function SideNav({ drawerWidth }: { drawerWidth: number }) {
  const nav = useNavigate();
  const location = useLocation();
  const user = useSelector((s: RootState) => s.auth.user);
  const [mode, setMode] = useNavMode();

  const visible = visibleNavItems(user, mode, location.pathname);
  const hiddenCount = NAV_ITEMS.filter((it) => it.advanced && !visible.includes(it)).length;
  const selectedPath = visible
    .filter((it) => location.pathname.startsWith(it.path))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

  const renderItem = (it: NavItem) => (
    <ListItemButton key={it.path} dense selected={it.path === selectedPath} onClick={() => nav(it.path)}>
      <ListItemIcon sx={{ minWidth: 40 }}>{it.icon}</ListItemIcon>
      <ListItemText primary={it.label} slotProps={{ primary: { sx: { fontWeight: it.path === selectedPath ? 800 : 500 } } }} />
    </ListItemButton>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box" } }}
    >
      <Toolbar />
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {GROUP_ORDER.map((g) => {
          const items = visible.filter((it) => it.group === g);
          if (items.length === 0) return null;
          return (
            <Box key={g} sx={{ pb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, px: 2, pt: 1.25, pb: 0.25, display: "block", letterSpacing: 0.5 }}>
                {GROUP_LABEL[g].toUpperCase()}
              </Typography>
              <List disablePadding>{items.map(renderItem)}</List>
            </Box>
          );
        })}
      </Box>

      <Divider />
      <Box sx={{ px: 2, py: 1 }}>
        <FormControlLabel
          control={<Switch size="small" checked={mode === "FULL"} onChange={(e) => setMode(e.target.checked ? "FULL" : "SIMPLE")} />}
          label={
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Show all features
            </Typography>
          }
        />
        {mode === "SIMPLE" && hiddenCount > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", ml: 0.5 }}>
            {hiddenCount} advanced screen{hiddenCount === 1 ? "" : "s"} hidden (stock, recipes, vendors…)
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}
