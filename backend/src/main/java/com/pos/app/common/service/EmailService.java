package com.pos.app.common.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromAddress;

    public void sendPasswordResetEmail(String toEmail, String resetLink) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject("Reset your password");
            message.setText("We received a request to reset your password.\n\n" +
                    "Click the link below to set a new password (valid for 30 minutes):\n" +
                    resetLink + "\n\n" +
                    "If you did not request this, you can safely ignore this email.");
            mailSender.send(message);
        } catch (Exception e) {
            // Do not fail the request just because SMTP isn't configured yet in dev;
            // log clearly so the flow is still testable end-to-end.
            log.warn("Failed to send password reset email to {}: {}. Reset link: {}",
                    toEmail, e.getMessage(), resetLink);
        }
    }

    public void sendUserWelcomeEmail(String toEmail, String tempPasswordNote) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject("Your account has been created");
            message.setText("An account has been created for you.\n\n" + tempPasswordNote);
            mailSender.send(message);
        } catch (Exception e) {
            log.warn("Failed to send welcome email to {}: {}", toEmail, e.getMessage());
        }
    }

    public void sendLowStockAlert(String toEmail, String tenantName, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject("[" + tenantName + "] Low stock alert");
            message.setText(body);
            mailSender.send(message);
        } catch (Exception e) {
            log.warn("Failed to send low-stock alert to {}: {}", toEmail, e.getMessage());
        }
    }
}
