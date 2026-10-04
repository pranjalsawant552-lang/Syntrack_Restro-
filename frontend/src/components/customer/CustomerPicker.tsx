import React, { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Customer } from "../../utils/types";
import { customerApi, type CreateCustomerDTO } from "./customerApi";

const normalize = (v: any) => String(v ?? "").trim();
const onlyDigits = (s: string) => normalize(s).replace(/\D/g, "");

type Props = {
  value: Customer | null;
  onChange: (c: Customer | null) => void;

  customers: Customer[];
  setCustomers: (list: Customer[]) => void;
};

export default function CustomerPicker({ value, onChange, customers, setCustomers }: Props) {
  const [input, setInput] = useState("");

  // add modal
  const [openAdd, setOpenAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(input).toLowerCase();
    if (!q) return customers;

    const dig = onlyDigits(q);
    return (customers ?? []).filter((c) => {
      const nm = normalize(c.customerName).toLowerCase();
      const ph = onlyDigits(c.phone || "");
      return nm.includes(q) || (!!dig && ph.includes(dig));
    });
  }, [customers, input]);

  const shouldOfferAdd = useMemo(() => {
    const q = normalize(input);
    if (q.length < 3) return false;
    const qLower = q.toLowerCase();
    const dig = onlyDigits(q);

    const found = (filtered ?? []).some((c) => {
      const nm = normalize(c.customerName).toLowerCase();
      const ph = onlyDigits(c.phone || "");
      return nm === qLower || (!!dig && ph === dig);
    });

    return !found;
  }, [filtered, input]);

  const openAddFromInput = () => {
    const q = normalize(input);
    setNewName(q);
    setNewPhone("");
    setNewEmail("");
    setNewAddress("");
    setOpenAdd(true);
  };

  const createCustomer = async () => {
    const payload: CreateCustomerDTO = {
      customerName: normalize(newName), // ✅ mandatory
      phone: normalize(newPhone) || undefined,
      email: normalize(newEmail) || undefined,
      address: normalize(newAddress) || undefined,
    };

    if (!payload.customerName) {
      alert("Customer name is required");
      return;
    }

    try {
      const created = await customerApi.create(payload);
      const next = [created, ...(customers ?? [])];
      setCustomers(next);
      onChange(created);
      setOpenAdd(false);
      setInput("");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Failed to create customer");
    }
  };

  return (
    <Box>
      <Autocomplete
        options={filtered}
        value={value}
        onChange={(_, v) => onChange(v)}
        inputValue={input}
        onInputChange={(_, v) => setInput(v)}
        getOptionLabel={(c) => `${c.customerName}${c.phone ? ` • ${c.phone}` : ""}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Customer (name / mobile)"
            placeholder="Type name or mobile"
            helperText="Select customer • Not found? Add new"
          />
        )}
        noOptionsText={
          <Box>
            <Typography variant="body2" color="text.secondary">
              No customers found.
            </Typography>
            {shouldOfferAdd && (
              <Button size="small" sx={{ mt: 1 }} variant="contained" onClick={openAddFromInput}>
                + Add "{normalize(input)}"
              </Button>
            )}
          </Box>
        }
      />

      {shouldOfferAdd && filtered.length > 0 && (
        <Button size="small" sx={{ mt: 1 }} variant="outlined" onClick={openAddFromInput}>
          + Add new customer "{normalize(input)}"
        </Button>
      )}

      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>Add Customer</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <TextField label="Name (mandatory)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <TextField label="Mobile (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            <TextField label="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <TextField
              label="Address (optional)"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" sx={{ borderRadius: 999, fontWeight: 900 }} onClick={createCustomer}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
