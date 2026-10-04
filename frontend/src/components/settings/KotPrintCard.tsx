import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import {
  loadKotPrintSettings,
  printTestKot,
  saveKotPrintSettings,
  type KotPrintSettings,
} from "../../utils/kotPrint";

/**
 * "Print KOTs on this device" -- for hotels that have only ONE device (the counter) and no kitchen screen.
 * Saved on THIS device only, so a counter PC/tablet can print while a waiter's phone (same hotel login) does not.
 */
export default function KotPrintCard() {
  const [s, setS] = useState<KotPrintSettings>(() => loadKotPrintSettings());
  const update = (patch: Partial<KotPrintSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveKotPrintSettings(next);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 900 }}>
        Kitchen printing (KOT)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Only one device at the counter and no kitchen screen? Turn this on and every "Send to kitchen" prints a KOT slip
        on the thermal printer. Leave it off on devices that use the Kitchen display. This setting is remembered on this
        device only.
      </Typography>

      <Stack spacing={2}>
        <FormControlLabel
          control={<Switch checked={s.mode === "AUTO"} onChange={(e) => update({ mode: e.target.checked ? "AUTO" : "OFF" })} />}
          label={<b>Auto-print KOT on this device</b>}
        />

        {s.mode === "AUTO" && (
          <>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select size="small" label="Paper width" value={s.paperMm} onChange={(e) => update({ paperMm: Number(e.target.value) === 58 ? 58 : 80 })} sx={{ minWidth: 160 }}>
                <MenuItem value={80}>80 mm</MenuItem>
                <MenuItem value={58}>58 mm</MenuItem>
              </TextField>
              <TextField select size="small" label="Copies per KOT" value={s.copies} onChange={(e) => update({ copies: Number(e.target.value) })} sx={{ minWidth: 160 }}>
                {[1, 2, 3].map((n) => (
                  <MenuItem key={n} value={n}>{n}</MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Header on slip (optional)" value={s.shopName} onChange={(e) => update({ shopName: e.target.value })} fullWidth />
            </Stack>

            <Box>
              <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => printTestKot(s)}>
                Print test KOT
              </Button>
            </Box>

            <Alert severity="info">
              <b>No print popup each time:</b> set the thermal printer as this computer's default printer, then start
              Chrome/Edge with <code>--kiosk-printing</code> (add it to the shortcut's Target). KOTs then print instantly
              without a dialog. Keep this app open on the counter device — tickets print as soon as they are created,
              including customer QR orders once a waiter accepts them.
            </Alert>
          </>
        )}
      </Stack>
    </Paper>
  );
}
