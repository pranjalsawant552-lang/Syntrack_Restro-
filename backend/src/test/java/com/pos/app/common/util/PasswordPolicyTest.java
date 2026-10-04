package com.pos.app.common.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PasswordPolicyTest {

    @Test
    void rejectsShortPasswords() {
        assertNotNull(PasswordPolicy.validate("Ab1"));
        assertFalse(PasswordPolicy.isValid("Ab1"));
    }

    @Test
    void rejectsMissingUppercase() {
        assertNotNull(PasswordPolicy.validate("lowercase1"));
    }

    @Test
    void rejectsMissingLowercase() {
        assertNotNull(PasswordPolicy.validate("UPPERCASE1"));
    }

    @Test
    void rejectsMissingDigit() {
        assertNotNull(PasswordPolicy.validate("NoDigitsHere"));
    }

    @Test
    void acceptsStrongPassword() {
        assertNull(PasswordPolicy.validate("Str0ngPass"));
        assertTrue(PasswordPolicy.isValid("Str0ngPass"));
    }

    @Test
    void rejectsNullOrEmpty() {
        assertNotNull(PasswordPolicy.validate(null));
        assertNotNull(PasswordPolicy.validate(""));
    }
}
