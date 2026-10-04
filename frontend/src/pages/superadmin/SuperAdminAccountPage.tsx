import React from "react";
import { Container, Typography } from "@mui/material";
import SuperAdminShell from "../../components/layout/SuperAdminShell";
import ChangePasswordCard from "../../components/common/ChangePasswordCard";

export default function SuperAdminAccountPage() {
  return (
    <SuperAdminShell>
      <Container maxWidth="sm" disableGutters>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
          My Account
        </Typography>
        <ChangePasswordCard endpoint="/superadmin/account/change-password" />
      </Container>
    </SuperAdminShell>
  );
}
