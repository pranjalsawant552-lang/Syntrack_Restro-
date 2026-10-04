import React, { useMemo, useState } from "react";
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Drawer,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
} from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { BOTTOM_PRIORITY, GROUP_LABEL, GROUP_ORDER, useNavMode, visibleNavItems } from "./navConfig";

/**
 * Phones / portrait tablets. Up to 4 everyday tabs + "More", which opens EVERY other screen the user may use
 * (previously the 6th+ screens — Invoices, Settings, Reports… — were simply unreachable on a tablet).
 */
export default function MobileBottomNav() {
  const nav = useNavigate();
  const location = useLocation();
  const user = useSelector((s: RootState) => s.auth.user);
  const [mode, setMode] = useNavMode();
  const [moreOpen, setMoreOpen] = useState(false);

  const visible = useMemo(() => visibleNavItems(user, mode, location.pathname), [user, mode, location.pathname]);

  const tabs = useMemo(() => {
    const ranked = BOTTOM_PRIORITY.map((p) => visible.find((v) => v.path === p)).filter(Boolean) as typeof visible;
    // everything fits without "More" only when the user has <= 5 screens in total
    return visible.length <= 5 ? visible : ranked.slice(0, 4);
  }, [visible]);
  const overflow = visible.filter((v) => !tabs.includes(v));

  const active = tabs.find((t) => location.pathname.startsWith(t.path));
  const value = active ? active.path : overflow.length > 0 ? "__more" : false;

  if (!user || visible.length === 0) return null;

  return (
    <>
      <Paper elevation={8} sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1300 }}>
        <BottomNavigation
          showLabels
          value={value}
          onChange={(_, v) => {
            if (v === "__more") setMoreOpen(true);
            else nav(v);
          }}
        >
          {tabs.map((t) => (
            <BottomNavigationAction key={t.path} value={t.path} label={t.label} icon={t.icon} />
          ))}
          {overflow.length > 0 && <BottomNavigationAction value="__more" label="More" icon={<MoreHorizIcon />} />}
        </BottomNavigation>
      </Paper>

      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        sx={{ zIndex: 1400 }}
        slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "80vh", pb: 2 } } }}
      >
        <Box sx={{ p: 2 }}>
          {GROUP_ORDER.map((g) => {
            const items = overflow.filter((it) => it.group === g);
            if (items.length === 0) return null;
            return (
              <Box key={g} sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
                  {GROUP_LABEL[g].toUpperCase()}
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 1, mt: 0.5 }}>
                  {items.map((it) => (
                    <Box
                      key={it.path}
                      onClick={() => {
                        setMoreOpen(false);
                        nav(it.path);
                      }}
                      sx={{
                        border: "1px solid",
                        borderColor: location.pathname.startsWith(it.path) ? "primary.main" : "divider",
                        borderRadius: 2,
                        p: 1,
                        textAlign: "center",
                        cursor: "pointer",
                        "&:active": { bgcolor: "action.selected" },
                      }}
                    >
                      {it.icon}
                      <Typography variant="caption" sx={{ display: "block", fontWeight: 700, lineHeight: 1.2 }}>
                        {it.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })}
          <FormControlLabel
            control={<Switch size="small" checked={mode === "FULL"} onChange={(e) => setMode(e.target.checked ? "FULL" : "SIMPLE")} />}
            label={<Typography variant="body2" sx={{ fontWeight: 700 }}>Show all features</Typography>}
          />
        </Box>
      </Drawer>
    </>
  );
}
