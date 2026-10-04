package com.pos.app.common.util;

import java.util.regex.Pattern;

/** Central password strength policy — used by signup/reset/change-password flows. */
public final class PasswordPolicy {

    private static final Pattern HAS_UPPER = Pattern.compile("[A-Z]");
    private static final Pattern HAS_LOWER = Pattern.compile("[a-z]");
    private static final Pattern HAS_DIGIT = Pattern.compile("[0-9]");

    private PasswordPolicy() {
    }

    /** Returns null if the password is acceptable, otherwise a human-readable reason. */
    public static String validate(String password) {
        if (password == null || password.length() < 8) {
            return "Password must be at least 8 characters long";
        }
        if (password.length() > 128) {
            return "Password is too long";
        }
        if (!HAS_UPPER.matcher(password).find()) {
            return "Password must contain at least one uppercase letter";
        }
        if (!HAS_LOWER.matcher(password).find()) {
            return "Password must contain at least one lowercase letter";
        }
        if (!HAS_DIGIT.matcher(password).find()) {
            return "Password must contain at least one number";
        }
        return null;
    }

    public static boolean isValid(String password) {
        return validate(password) == null;
    }
}
