// import React, { useEffect, useMemo, useState } from "react";
// import {
//   Alert,
//   Box,
//   Button,
//   Card,
//   CardActions,
//   CardContent,
//   CircularProgress,
//   Container,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   Divider,
//   IconButton,
//   InputAdornment,
//   Paper,
//   Snackbar,
//   Stack,
//   Switch,
//   TextField,
//   Typography,
//   useMediaQuery,
//   Chip,
//   FormControlLabel,
//   Tooltip,
// } from "@mui/material";
// import { useTheme } from "@mui/material/styles";
// import AddIcon from "@mui/icons-material/Add";
// import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
// import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
// import SearchIcon from "@mui/icons-material/Search";
// import RefreshIcon from "@mui/icons-material/Refresh";
// import CategoryIcon from "@mui/icons-material/Category";
// import WarningAmberIcon from "@mui/icons-material/WarningAmber";
// import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
// import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

// import type { Category } from "../utils/types";
// import { categoryApi } from "../components/category/categoryApi";

// type Toast = { open: boolean; msg: string; type: "success" | "error" | "info" };
// const normalize = (v: any) => String(v ?? "").trim();

// export default function CategoryPage() {
//   const theme = useTheme();
//   const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

//   const [rows, setRows] = useState<Category[]>([]);
//   const [loading, setLoading] = useState(false);

//   // ✅ show inactive categories too?
//   const [includeInactive, setIncludeInactive] = useState(true);

//   const [search, setSearch] = useState("");

//   const filtered = useMemo(() => {
//     const q = normalize(search).toLowerCase();
//     const base = includeInactive ? rows : rows.filter((r) => r.isActive);

//     if (!q) return base;

//     return base.filter((r) =>
//       normalize(r.categoryName).toLowerCase().includes(q)
//     );
//   }, [rows, search, includeInactive]);

//   // modal state (Add/Edit)
//   const [openForm, setOpenForm] = useState(false);
//   const [mode, setMode] = useState<"add" | "edit">("add");
//   const [formId, setFormId] = useState<number | null>(null);
//   const [formName, setFormName] = useState("");

//   // delete confirm
//   const [openDelete, setOpenDelete] = useState(false);
//   const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

//   // force delete confirm (when FK blocks)
//   const [openForceDelete, setOpenForceDelete] = useState(false);

//   const [saving, setSaving] = useState(false);

//   const [toast, setToast] = useState<Toast>({
//     open: false,
//     msg: "",
//     type: "info",
//   });

//   const showToast = (type: Toast["type"], msg: string) =>
//     setToast({ open: true, type, msg });

//   const fetchList = async (incInactive = includeInactive) => {
//     setLoading(true);
//     try {
//       const data = await categoryApi.list(incInactive);
//       setRows(Array.isArray(data) ? data : []);
//     } catch (e: any) {
//       showToast("error", e?.response?.data || e?.message || "Failed to load categories");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchList(includeInactive);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [includeInactive]);

//   const openAdd = () => {
//     setMode("add");
//     setFormId(null);
//     setFormName("");
//     setOpenForm(true);
//   };

//   const openEdit = (row: Category) => {
//     setMode("edit");
//     setFormId(row.categoryId);
//     setFormName(row.categoryName ?? "");
//     setOpenForm(true);
//   };

//   const openDeleteDialog = (row: Category) => {
//     setDeleteTarget(row);
//     setOpenDelete(true);
//   };

//   const validateName = (name: string) => {
//     const v = normalize(name);
//     if (!v) return "Category name is required";
//     if (v.length < 2) return "Minimum 2 characters";
//     if (v.length > 50) return "Maximum 50 characters";
//     return "";
//   };

//   const nameError = validateName(formName);

//   const onSubmit = async () => {
//     const err = validateName(formName);
//     if (err) return showToast("error", err);

//     setSaving(true);
//     try {
//       if (mode === "add") {
//         await categoryApi.create(formName.trim());
//         showToast("success", "Category added");
//       } else {
//         if (!formId) throw new Error("Invalid category id");
//         await categoryApi.update(formId, formName.trim());
//         showToast("success", "Category updated");
//       }
//       setOpenForm(false);
//       await fetchList(includeInactive);
//     } catch (e: any) {
//       showToast("error", e?.response?.data || e?.message || "Save failed");
//     } finally {
//       setSaving(false);
//     }
//   };

//   // ✅ toggle active/inactive
//   const onToggle = async (row: Category) => {
//     setSaving(true);
//     try {
//       await categoryApi.toggleStatus(row.categoryId, !row.isActive);
//       showToast("success", !row.isActive ? "Category activated" : "Category deactivated");
//       await fetchList(includeInactive);
//     } catch (e: any) {
//       showToast("error", e?.response?.data || e?.message || "Status update failed");
//     } finally {
//       setSaving(false);
//     }
//   };

//   // ✅ Normal delete first
//   const onConfirmDelete = async () => {
//     if (!deleteTarget) return;
//     setSaving(true);

//     try {
//       await categoryApi.remove(deleteTarget.categoryId);
//       showToast("success", "Category deleted");
//       setOpenDelete(false);
//       setDeleteTarget(null);
//       await fetchList(includeInactive);
//     } catch (e: any) {
//       const status = e?.response?.status;
//       const msg = e?.response?.data || e?.message || "Delete failed";

//       setOpenDelete(false);

//       // FK constraint => give force delete option
//       if (status === 409 || status === 500 || String(msg).toLowerCase().includes("foreign key")) {
//         showToast("info", "Category has products. Use Force Delete if you want.");
//         setOpenForceDelete(true);
//       } else {
//         showToast("error", msg);
//         setDeleteTarget(null);
//       }
//     } finally {
//       setSaving(false);
//     }
//   };

//   // ✅ Force delete
//   const onConfirmForceDelete = async () => {
//     if (!deleteTarget) return;
//     setSaving(true);

//     try {
//       await categoryApi.forceRemove(deleteTarget.categoryId);
//       showToast("success", "Force deleted category + products");
//       setOpenForceDelete(false);
//       setDeleteTarget(null);
//       await fetchList(includeInactive);
//     } catch (e: any) {
//       showToast("error", e?.response?.data || e?.message || "Force delete failed");
//     } finally {
//       setSaving(false);
//     }
//   };

//   const totalActive = useMemo(() => rows.filter((r) => r.isActive).length, [rows]);
//   const totalInactive = useMemo(() => rows.filter((r) => !r.isActive).length, [rows]);

//   return (
//     <Container maxWidth="lg" sx={{ py: 2 }}>
//       <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
//         {/* Header */}
//         <Stack
//           direction={{ xs: "column", sm: "row" }}
//           spacing={1.5}
//           alignItems={{ xs: "stretch", sm: "center" }}
//           justifyContent="space-between"
//         >
//           <Stack direction="row" spacing={1} alignItems="center">
//             <CategoryIcon />
//             <Box>
//               <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
//                 Category
//               </Typography>
//               <Typography variant="body2" color="text.secondary">
//                 Manage categories (Active/Inactive + Force Delete)
//               </Typography>
//             </Box>
//           </Stack>

//           <Stack direction="row" spacing={1} justifyContent="flex-end">
//             <Tooltip title="Refresh">
//               <span>
//                 <IconButton onClick={() => fetchList(includeInactive)} disabled={loading} aria-label="refresh">
//                   <RefreshIcon />
//                 </IconButton>
//               </span>
//             </Tooltip>

//             <Button
//               onClick={openAdd}
//               variant="contained"
//               startIcon={<AddIcon />}
//               sx={{ borderRadius: 999 }}
//             >
//               Add
//             </Button>
//           </Stack>
//         </Stack>

//         <Divider sx={{ my: 2 }} />

//         {/* Controls */}
//         <Stack
//           direction={{ xs: "column", sm: "row" }}
//           spacing={1.5}
//           alignItems={{ xs: "stretch", sm: "center" }}
//           justifyContent="space-between"
//         >
//           <TextField
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             placeholder="Search category..."
//             size="small"
//             fullWidth={isMobile}
//             sx={{ maxWidth: { xs: "100%", sm: 420 } }}
//             InputProps={{
//               startAdornment: (
//                 <InputAdornment position="start">
//                   <SearchIcon fontSize="small" />
//                 </InputAdornment>
//               ),
//             }}
//           />

//           <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
//             <FormControlLabel
//               control={
//                 <Switch
//                   checked={includeInactive}
//                   onChange={(e) => setIncludeInactive(e.target.checked)}
//                 />
//               }
//               label="Show Inactive"
//             />

//             <Chip size="small" color="success" label={`Active: ${totalActive}`} />
//             <Chip size="small" label={`Inactive: ${totalInactive}`} />
//             <Chip size="small" variant="outlined" label={`Showing: ${filtered.length}`} />
//           </Stack>
//         </Stack>

//         <Box sx={{ mt: 2 }}>
//           {loading ? (
//             <Stack alignItems="center" sx={{ py: 6 }}>
//               <CircularProgress />
//               <Typography sx={{ mt: 2 }} color="text.secondary">
//                 Loading categories...
//               </Typography>
//             </Stack>
//           ) : filtered.length === 0 ? (
//             <Box sx={{ py: 6, textAlign: "center" }}>
//               <Typography sx={{ fontWeight: 800 }}>No categories found</Typography>
//               <Typography color="text.secondary" sx={{ mt: 0.5 }}>
//                 Click “Add” to create your first category.
//               </Typography>
//             </Box>
//           ) : (
//             <Box
//               sx={{
//                 display: "grid",
//                 gap: 1.5,
//                 gridTemplateColumns: {
//                   xs: "1fr",
//                   sm: "repeat(2, 1fr)",
//                   md: "repeat(3, 1fr)",
//                   lg: "repeat(4, 1fr)",
//                 },
//               }}
//             >
//               {filtered.map((row) => (
//                 <Card
//                   key={row.categoryId}
//                   variant="outlined"
//                   sx={{
//                     borderRadius: 3,
//                     opacity: row.isActive ? 1 : 0.7,
//                     borderColor: row.isActive ? "divider" : "rgba(255,193,7,0.6)",
//                   }}
//                 >
//                   <CardContent sx={{ pb: 1 }}>
//                     <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
//                       <Box>
//                         <Typography variant="caption" color="text.secondary">
//                           ID: {row.categoryId}
//                         </Typography>
//                         <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 0.5 }}>
//                           {row.categoryName}
//                         </Typography>
//                       </Box>

//                       <Chip
//                         size="small"
//                         color={row.isActive ? "success" : "warning"}
//                         variant={row.isActive ? "filled" : "outlined"}
//                         label={row.isActive ? "ACTIVE" : "INACTIVE"}
//                       />
//                     </Stack>
//                   </CardContent>

//                   <CardActions sx={{ justifyContent: "space-between", pt: 0 }}>
//                     <Stack direction="row" spacing={1}>
//                       <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(row)}>
//                         Edit
//                       </Button>

//                       <Button
//                         size="small"
//                         color="error"
//                         startIcon={<DeleteOutlineIcon />}
//                         onClick={() => openDeleteDialog(row)}
//                       >
//                         Delete
//                       </Button>
//                     </Stack>

//                     <Tooltip title={row.isActive ? "Deactivate category" : "Activate category"}>
//                       <span>
//                         <IconButton
//                           onClick={() => onToggle(row)}
//                           disabled={saving}
//                           color={row.isActive ? "warning" : "success"}
//                         >
//                           <PowerSettingsNewIcon />
//                         </IconButton>
//                       </span>
//                     </Tooltip>
//                   </CardActions>
//                 </Card>
//               ))}
//             </Box>
//           )}
//         </Box>
//       </Paper>

//       {/* Add/Edit Dialog */}
//       <Dialog
//         open={openForm}
//         onClose={() => (saving ? null : setOpenForm(false))}
//         fullWidth
//         maxWidth="sm"
//       >
//         <DialogTitle sx={{ fontWeight: 900 }}>
//           {mode === "add" ? "Add Category" : "Edit Category"}
//         </DialogTitle>

//         <DialogContent dividers>
//           <Stack spacing={1.5}>
//             {mode === "edit" && (
//               <TextField
//                 label="Category ID"
//                 value={formId ?? ""}
//                 InputProps={{ readOnly: true }}
//                 size="small"
//               />
//             )}

//             <TextField
//               label="Category Name"
//               value={formName}
//               onChange={(e) => setFormName(e.target.value)}
//               size="small"
//               autoFocus
//               error={!!nameError}
//               helperText={nameError || " "}
//               inputProps={{ maxLength: 50 }}
//               onKeyDown={(e) => {
//                 if (e.key === "Enter") onSubmit();
//               }}
//             />
//           </Stack>
//         </DialogContent>

//         <DialogActions sx={{ p: 2 }}>
//           <Button onClick={() => setOpenForm(false)} disabled={saving}>
//             Cancel
//           </Button>
//           <Button
//             onClick={onSubmit}
//             variant="contained"
//             disabled={saving || !!nameError}
//             startIcon={saving ? <CircularProgress size={18} /> : undefined}
//           >
//             {mode === "add" ? "Save" : "Update"}
//           </Button>
//         </DialogActions>
//       </Dialog>

//       {/* Normal Delete Confirm */}
//       <Dialog
//         open={openDelete}
//         onClose={() => (saving ? null : setOpenDelete(false))}
//         fullWidth
//         maxWidth="xs"
//       >
//         <DialogTitle sx={{ fontWeight: 900, display: "flex", gap: 1, alignItems: "center" }}>
//           <Inventory2OutlinedIcon fontSize="small" />
//           Delete Category
//         </DialogTitle>

//         <DialogContent dividers>
//           <Typography>
//             Are you sure you want to delete <b>{deleteTarget?.categoryName}</b>?
//           </Typography>
//           <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
//             If products exist under this category, delete may fail and you will get Force Delete option.
//           </Typography>
//         </DialogContent>

//         <DialogActions sx={{ p: 2 }}>
//           <Button onClick={() => setOpenDelete(false)} disabled={saving}>
//             Cancel
//           </Button>
//           <Button
//             color="error"
//             variant="contained"
//             onClick={onConfirmDelete}
//             disabled={saving}
//             startIcon={saving ? <CircularProgress size={18} /> : <DeleteOutlineIcon />}
//           >
//             Delete
//           </Button>
//         </DialogActions>
//       </Dialog>

//       {/* Force Delete Confirm */}
//       <Dialog
//         open={openForceDelete}
//         onClose={() => (saving ? null : setOpenForceDelete(false))}
//         fullWidth
//         maxWidth="xs"
//       >
//         <DialogTitle sx={{ fontWeight: 900, display: "flex", gap: 1, alignItems: "center" }}>
//           <WarningAmberIcon color="warning" />
//           Force Delete
//         </DialogTitle>

//         <DialogContent dividers>
//           <Typography sx={{ fontWeight: 900 }}>
//             This will delete the category AND all products inside it.
//           </Typography>
//           <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
//             Category: <b>{deleteTarget?.categoryName}</b>
//           </Typography>

//           <Alert severity="warning" sx={{ mt: 2 }}>
//             This action cannot be undone.
//           </Alert>
//         </DialogContent>

//         <DialogActions sx={{ p: 2 }}>
//           <Button onClick={() => setOpenForceDelete(false)} disabled={saving}>
//             Cancel
//           </Button>
//           <Button
//             color="error"
//             variant="contained"
//             onClick={onConfirmForceDelete}
//             disabled={saving}
//             startIcon={saving ? <CircularProgress size={18} /> : <DeleteOutlineIcon />}
//           >
//             Force Delete
//           </Button>
//         </DialogActions>
//       </Dialog>

//       {/* Toast */}
//       <Snackbar
//         open={toast.open}
//         autoHideDuration={2500}
//         onClose={() => setToast((p) => ({ ...p, open: false }))}
//         anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
//       >
//         <Alert
//           severity={toast.type}
//           onClose={() => setToast((p) => ({ ...p, open: false }))}
//           variant="filled"
//           sx={{ width: "100%" }}
//         >
//           {toast.msg}
//         </Alert>
//       </Snackbar>
//     </Container>
//   );
// }

// ✅ src/pages/CategoryPage.tsx  (Complete updated with Active/Inactive + Force delete)
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CategoryIcon from "@mui/icons-material/Category";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";

import type { Category } from "../utils/types";
import { categoryApi } from "../components/category/categoryApi";

type Toast = { open: boolean; msg: string; type: "success" | "error" | "info" };
const normalize = (v: any) => String(v ?? "").trim();

const getCateActive = (c: Category) => {
  if (typeof c.isActive === "boolean") return c.isActive;
  return true;
};

const NONE_PARENT = "none" as const;

export default function CategoryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  // show inactive toggle
  const [showInactive, setShowInactive] = useState(true);

  // modal add/edit
  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [formId, setFormId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  // ✅ NEW: sub-category support -- "none" = top-level category
  const [formParentId, setFormParentId] = useState<number | typeof NONE_PARENT>(NONE_PARENT);

  // delete confirm (force delete only)
  const [openForceDelete, setOpenForceDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "info" });
  const showToast = (type: Toast["type"], msg: string) => setToast({ open: true, type, msg });

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await categoryApi.list(showInactive);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  // ✅ NEW: build the 2-level hierarchy (top-level categories + their sub-categories)
  // from the flat list the API returns. Every existing category has
  // parentCategoryId === null/undefined, so it's automatically top-level here --
  // this view degrades to exactly the old flat grid when no sub-categories exist.
  const topLevel = useMemo(() => rows.filter((r) => !r.parentCategoryId), [rows]);

  const childrenByParent = useMemo(() => {
    const map = new Map<number, Category[]>();
    rows.forEach((r) => {
      if (r.parentCategoryId) {
        const arr = map.get(r.parentCategoryId) || [];
        arr.push(r);
        map.set(r.parentCategoryId, arr);
      }
    });
    return map;
  }, [rows]);

  const q = normalize(search).toLowerCase();
  const matchesQuery = (c: Category) => !q || normalize(c.categoryName).toLowerCase().includes(q);

  // a top-level category is visible if it matches the search itself, or if any
  // of its sub-categories do (so a matching sub-category's parent stays visible)
  const visibleTopLevel = useMemo(() => {
    return topLevel.filter((top) => {
      if (matchesQuery(top)) return true;
      const kids = childrenByParent.get(top.categoryId) || [];
      return kids.some(matchesQuery);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevel, childrenByParent, search]);

  const totalActive = useMemo(() => rows.filter((r) => getCateActive(r)).length, [rows]);
  const totalInactive = useMemo(() => rows.filter((r) => !getCateActive(r)).length, [rows]);
  const totalVisible = useMemo(() => {
    let n = 0;
    visibleTopLevel.forEach((top) => {
      n += 1;
      const kids = childrenByParent.get(top.categoryId) || [];
      n += matchesQuery(top) ? kids.length : kids.filter(matchesQuery).length;
    });
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTopLevel, childrenByParent, search]);

  const openAdd = (parent?: Category) => {
    setMode("add");
    setFormId(null);
    setFormName("");
    setFormParentId(parent ? parent.categoryId : NONE_PARENT);
    setOpenForm(true);
  };

  const openEdit = (row: Category) => {
    setMode("edit");
    setFormId(row.categoryId);
    setFormName(row.categoryName ?? "");
    setFormParentId(row.parentCategoryId ?? NONE_PARENT);
    setOpenForm(true);
  };

  // a category that already has sub-categories of its own can't become one
  // (matches the backend's 2-level rule) -- disable the parent dropdown for it
  const formHasChildren = useMemo(
    () => (formId ? rows.some((r) => r.parentCategoryId === formId) : false),
    [rows, formId]
  );

  const validateName = (name: string) => {
    const v = normalize(name);
    if (!v) return "Category name is required";
    if (v.length < 2) return "Minimum 2 characters";
    if (v.length > 50) return "Maximum 50 characters";
    return "";
  };

  const nameError = validateName(formName);

  const onSubmit = async () => {
    const err = validateName(formName);
    if (err) return showToast("error", err);

    const parentId = formParentId === NONE_PARENT ? null : formParentId;

    setSaving(true);
    try {
      if (mode === "add") {
        await categoryApi.create(formName.trim(), parentId);
        showToast("success", parentId ? "Sub-category added" : "Category added");
      } else {
        if (!formId) throw new Error("Invalid category id");
        await categoryApi.update(formId, formName.trim(), parentId);
        showToast("success", "Category updated");
      }
      setOpenForm(false);
      await fetchList();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.response?.data || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Active/Inactive Toggle (optimistic)
  const toggleCategory = async (row: Category, next: boolean) => {
    setRows((prev) => prev.map((r) => (r.categoryId === row.categoryId ? { ...r, isActive: next } : r)));

    try {
      await categoryApi.toggleStatus(row.categoryId, next);
      showToast("success", next ? "Category activated" : "Category deactivated");
    } catch (e: any) {
      // rollback
      setRows((prev) =>
        prev.map((r) => (r.categoryId === row.categoryId ? { ...r, isActive: !next } : r))
      );
      showToast("error", e?.response?.data?.message || e?.response?.data || e?.message || "Toggle failed");
    }
  };

  // ✅ Force delete only (because normal delete endpoint missing + invoice FK issues)
  const openForceDeleteDialog = (row: Category) => {
    setDeleteTarget(row);
    setOpenForceDelete(true);
  };

  const onConfirmForceDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);

    try {
      await categoryApi.forceRemove(deleteTarget.categoryId);
      showToast("success", "Category and its products were deleted successfully.");
      setOpenForceDelete(false);
      setDeleteTarget(null);
      await fetchList();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Force delete failed";

      if (status === 409) {
        // Products are linked to existing invoices: the backend deactivated
        // the category + products instead of deleting them. This is an
        // expected outcome, not a failure, so reflect that in the UI.
        showToast("info", String(msg));
        setOpenForceDelete(false);
        setDeleteTarget(null);
        await fetchList();
      } else {
        showToast("error", String(msg));
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteTargetChildCount = useMemo(
    () => (deleteTarget ? (childrenByParent.get(deleteTarget.categoryId) || []).length : 0),
    [deleteTarget, childrenByParent]
  );

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <CategoryIcon />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                Category
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Categories &amp; sub-categories, Active/Inactive + Force delete
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
            <FormControlLabel
              control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
              label="Show Inactive"
            />
            <IconButton onClick={fetchList} disabled={loading} aria-label="refresh">
              <RefreshIcon />
            </IconButton>
            <Button onClick={() => openAdd()} variant="contained" startIcon={<AddIcon />} sx={{ borderRadius: 999 }}>
              Add Category
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Search */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search category or sub-category..."
            size="small"
            fullWidth={isMobile}
            sx={{ maxWidth: { xs: "100%", sm: 420 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <Chip size="small" color="success" label={`Active: ${totalActive}`} />
            <Chip size="small" label={`Inactive: ${totalInactive}`} />
            <Chip size="small" variant="outlined" label={`Showing: ${totalVisible}`} />
          </Stack>
        </Stack>

        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Loading categories...
              </Typography>
            </Stack>
          ) : visibleTopLevel.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 800 }}>No categories found</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Click “Add Category” to create your first category.
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                },
              }}
            >
              {visibleTopLevel.map((row) => {
                const active = getCateActive(row);
                const allKids = childrenByParent.get(row.categoryId) || [];
                const kids = matchesQuery(row) ? allKids : allKids.filter(matchesQuery);

                return (
                  <Card
                    key={row.categoryId}
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      opacity: active ? 1 : 0.7,
                      borderColor: active ? "divider" : "rgba(255,193,7,0.6)",
                    }}
                  >
                    <CardContent sx={{ pb: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            ID: {row.categoryId}
                          </Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 0.5 }}>
                            {row.categoryName}
                          </Typography>
                        </Box>

                        <Chip
                          size="small"
                          color={active ? "success" : "warning"}
                          variant={active ? "filled" : "outlined"}
                          label={active ? "ACTIVE" : "INACTIVE"}
                        />
                      </Stack>
                    </CardContent>

                    <CardActions sx={{ justifyContent: "space-between", pt: 0 }}>
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(row)}>
                          Edit
                        </Button>

                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => openForceDeleteDialog(row)}
                        >
                          Delete
                        </Button>
                      </Stack>

                      <Tooltip title={active ? "Deactivate category" : "Activate category"}>
                        <span>
                          <IconButton onClick={() => toggleCategory(row, !active)} disabled={saving} size="small">
                            <Switch size="small" checked={active} sx={{ pointerEvents: "none" }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </CardActions>

                    <Divider />

                    {/* ✅ NEW: sub-categories list, nested inside the parent's card */}
                    <Box sx={{ px: 2, py: 1.2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: kids.length ? 1 : 0 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
                          SUB-CATEGORIES {allKids.length ? `(${allKids.length})` : ""}
                        </Typography>
                        <Tooltip title={`Add a sub-category under "${row.categoryName}"`}>
                          <Button
                            size="small"
                            startIcon={<CreateNewFolderOutlinedIcon fontSize="small" />}
                            onClick={() => openAdd(row)}
                            sx={{ minWidth: 0 }}
                          >
                            Add Sub
                          </Button>
                        </Tooltip>
                      </Stack>

                      {kids.length > 0 && (
                        <Stack spacing={0.6}>
                          {kids.map((child) => {
                            const childActive = getCateActive(child);
                            return (
                              <Stack
                                key={child.categoryId}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{
                                  pl: 1,
                                  pr: 0.5,
                                  py: 0.4,
                                  borderRadius: 2,
                                  bgcolor: "action.hover",
                                  opacity: childActive ? 1 : 0.65,
                                }}
                              >
                                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                                  <SubdirectoryArrowRightIcon fontSize="small" color="disabled" />
                                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                                    {child.categoryName}
                                  </Typography>
                                  {!childActive && (
                                    <Chip size="small" label="Inactive" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                                  )}
                                </Stack>

                                <Stack direction="row" spacing={0}>
                                  <Tooltip title="Edit sub-category">
                                    <IconButton size="small" onClick={() => openEdit(child)}>
                                      <EditOutlinedIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete sub-category">
                                    <IconButton size="small" color="error" onClick={() => openForceDeleteDialog(child)}>
                                      <DeleteOutlineIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </Stack>
                            );
                          })}
                        </Stack>
                      )}
                    </Box>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openForm} onClose={() => (saving ? null : setOpenForm(false))} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {mode === "add"
            ? formParentId === NONE_PARENT
              ? "Add Category"
              : "Add Sub-Category"
            : "Edit Category"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {mode === "edit" && (
              <TextField label="Category ID" value={formId ?? ""} InputProps={{ readOnly: true }} size="small" />
            )}
            <TextField
              label="Category Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              size="small"
              autoFocus
              error={!!nameError}
              helperText={nameError || " "}
              inputProps={{ maxLength: 50 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
            />

            <FormControl size="small" fullWidth disabled={formHasChildren}>
              <Typography variant="caption" sx={{ mb: 0.5 }} color="text.secondary">
                Parent Category
              </Typography>
              <Select value={formParentId} onChange={(e) => setFormParentId(e.target.value as any)}>
                <MenuItem value={NONE_PARENT}>None (top-level category)</MenuItem>
                {topLevel
                  .filter((c) => c.categoryId !== formId)
                  .map((c) => (
                    <MenuItem key={c.categoryId} value={c.categoryId}>
                      {c.categoryName}
                    </MenuItem>
                  ))}
              </Select>
              {formHasChildren && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  This category already has sub-categories, so it can't become a sub-category itself.
                </Typography>
              )}
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenForm(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            variant="contained"
            disabled={saving || !!nameError}
            startIcon={saving ? <CircularProgress size={18} /> : undefined}
          >
            {mode === "add" ? "Save" : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Force Delete Confirm */}
      <Dialog
        open={openForceDelete}
        onClose={() => (saving ? null : setOpenForceDelete(false))}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 900, display: "flex", gap: 1, alignItems: "center" }}>
          <WarningAmberIcon color="warning" />
          Force Delete
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontWeight: 800 }}>
            This will delete the category AND try to delete all products inside it
            {deleteTargetChildCount > 0 ? ` (and its ${deleteTargetChildCount} sub-categor${deleteTargetChildCount === 1 ? "y" : "ies"})` : ""}.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            If products are linked with invoices, DB will block delete. Then use deactivate instead.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Category: <b>{deleteTarget?.categoryName}</b>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenForceDelete(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={onConfirmForceDelete}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} /> : <DeleteOutlineIcon />}
          >
            Force Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.type}
          onClose={() => setToast((p) => ({ ...p, open: false }))}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
