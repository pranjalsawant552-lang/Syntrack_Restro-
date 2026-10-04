import React, { useState } from "react";
import { Box, Typography } from "@mui/material";

/** The Syntrack Restro mark (public/logo.svg). Hotels can still upload their own logo under Settings -> Branding. */
const DEFAULT_LOGO = "/logo.svg";

type BrandLogoProps = {
  logoUrl?: string;
  appName?: string;
  /** Show the wordmark next to the badge. Set false for tight spaces (e.g. mobile). */
  showName?: boolean;
  size?: number;
  onClick?: () => void;
};

/**
 * Branded logo mark used in the top navigation. Renders the tenant's uploaded
 * logo when available; falls back to the Syntrack Restro logo if no custom logo
 * is set, or if the configured image fails to load (avoids the broken-image icon).
 */
export default function BrandLogo({
  logoUrl,
  appName = "Syntrack Restro",
  showName = true,
  size = 34,
  onClick,
}: BrandLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isDefaultMark = !logoUrl || logoUrl === "/logo.svg" || logoUrl === "/logo.png" || imgFailed;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.1,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <Box
        component="img"
        src={isDefaultMark ? DEFAULT_LOGO : logoUrl}
        alt={`${appName} logo`}
        onError={() => setImgFailed(true)}
        sx={{
          width: size,
          height: size,
          borderRadius: isDefaultMark ? `${Math.round(size * 0.23)}px` : "10px",
          objectFit: isDefaultMark ? "contain" : "cover",
          // the default badge is blue like the top bar, so give it a thin light edge to stand out
          boxShadow: isDefaultMark
            ? "0 0 0 1.5px rgba(255,255,255,0.85), 0 2px 8px rgba(0,0,0,0.25)"
            : "0 2px 8px rgba(0, 0, 0, 0.25)",
          flexShrink: 0,
        }}
      />

      {showName && (
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: size * 0.44,
            lineHeight: 1,
            letterSpacing: "-0.3px",
            whiteSpace: "nowrap",
            color: "inherit",
          }}
        >
          {appName}
        </Typography>
      )}
    </Box>
  );
}
