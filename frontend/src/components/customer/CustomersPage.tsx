import React, { useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, LinearProgress, Paper, Stack, TablePagination, TextField, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import type { Customer } from "../../utils/types";
import { customerApi, type CreateCustomerDTO } from "./customerApi";
import { downloadAuthenticatedFile } from "../../utils/downloadFile";
import { usePaginatedList } from "../../hooks/usePaginatedList";


const normalize = (v: any) => String(v ?? "").trim();

export default function CustomersPage() {
  // The server returns one page at a time (25 customers) and does the searching, so this screen stays fast with
  // thousands of customers. Typing waits ~350 ms, then asks the server.
  const list = usePaginatedList<Customer>(
    ({ page, size, search, filters }) =>
      customerApi.searchPaged({ page, size, search, active: filters.active as boolean | undefined }),
    { initialSize: 25 }
  );
  const activeFilter: "ALL" | "ACTIVE" | "INACTIVE" =
    list.filters.active === true ? "ACTIVE" : list.filters.active === false ? "INACTIVE" : "ALL";

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addr, setAddr] = useState("");

  const openAdd = () => {
    setEdit(null);
    setName("");
    setPhone("");
    setEmail("");
    setAddr("");
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEdit(c);
    setName(c.customerName || "");
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setAddr(c.address || "");
    setOpen(true);
  };

  const save = async () => {
    const payload: CreateCustomerDTO = {
      customerName: normalize(name),
      phone: normalize(phone) || undefined,
      email: normalize(email) || undefined,
      address: normalize(addr) || undefined,
    };
    if (!payload.customerName) return alert("Customer name is required");

    try {
      if (edit) await customerApi.update(edit.customerId, payload);
      else await customerApi.create(payload);

      setOpen(false);
      list.reload();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Save failed");
    }
  };

  const toggleActive = async (c: Customer) => {
    const next = !(typeof c.isActive === "boolean" ? c.isActive : true);
    try {
      await customerApi.toggleActive(c.customerId, next);
      list.reload();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Failed");
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Customers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Name mandatory • phone/email/address optional
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => downloadAuthenticatedFile("/customer/export", "customers.csv")}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              Export CSV
            </Button>
            <Button variant="contained" onClick={openAdd} sx={{ borderRadius: 2, fontWeight: 900 }}>
              + Add Customer
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <TextField fullWidth label="Search (name / phone / email)" value={list.searchInput} onChange={(e) => list.setSearchInput(e.target.value)} />
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((k) => (
            <Chip
              key={k}
              label={k === "ALL" ? "All" : k === "ACTIVE" ? "Active" : "Inactive"}
              color={activeFilter === k ? "primary" : "default"}
              onClick={() => list.setFilter("active", k === "ALL" ? undefined : k === "ACTIVE")}
              sx={{ fontWeight: 700 }}
            />
          ))}
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center", ml: 1 }}>
            {list.totalElements} customer{list.totalElements === 1 ? "" : "s"}
          </Typography>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {list.loading && <LinearProgress sx={{ mb: 1 }} />}
        {list.error ? (
          <Typography color="error">{list.error}</Typography>
        ) : !list.loading && list.rows.length === 0 ? (
          <Typography color="text.secondary">No customers</Typography>
        ) : (
          <Stack spacing={1}>
            {list.rows.map((c) => {
              const active = typeof c.isActive === "boolean" ? c.isActive : true;
              return (
                <Paper key={c.customerId} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 900 }} noWrap>
                          {c.customerName}
                        </Typography>
                        <Chip size="small" label={active ? "ACTIVE" : "INACTIVE"} color={active ? "success" : "default"} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {c.phone ? `📞 ${c.phone}` : ""} {c.email ? ` • ✉️ ${c.email}` : ""} {c.address ? ` • 📍 ${c.address}` : ""}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" size="small" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button variant="outlined" size="small" onClick={() => toggleActive(c)}>
                        {active ? "Deactivate" : "Activate"}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}

        <TablePagination
          component="div"
          count={list.totalElements}
          page={list.page}
          onPageChange={(_, p) => list.setPage(p)}
          rowsPerPage={list.size}
          onRowsPerPageChange={(e) => {
            list.setSize(parseInt(e.target.value, 10));
            list.setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>{edit ? "Edit Customer" : "Add Customer"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <TextField label="Name *" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Mobile" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Address" value={addr} onChange={(e) => setAddr(e.target.value)} multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} sx={{ borderRadius: 999, fontWeight: 900 }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
