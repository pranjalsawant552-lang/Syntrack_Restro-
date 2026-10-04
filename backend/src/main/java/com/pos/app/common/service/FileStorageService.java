package com.pos.app.common.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final String UPLOAD_ROOT = "uploads" + File.separator + "logos";

    /**
     * Saves the given multipart file under uploads/logos and returns the public URL
     * path (e.g. "/uploads/logos/acme_ab12cd34.png") that WebConfig serves statically.
     */
    public String saveLogo(String tenantSlugOrKey, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file provided");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Only image files are allowed for the logo");
        }
        if (file.getSize() > 3 * 1024 * 1024) {
            throw new IllegalArgumentException("Logo must be smaller than 3MB");
        }

        Path dir = Paths.get(UPLOAD_ROOT);
        Files.createDirectories(dir);

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "logo";
        String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf('.')) : "";
        String safeKey = tenantSlugOrKey == null ? "logo" : tenantSlugOrKey.replaceAll("[^a-zA-Z0-9_-]", "_");
        String fileName = safeKey + "_" + UUID.randomUUID().toString().substring(0, 8) + ext;

        Path target = dir.resolve(fileName);
        Files.copy(file.getInputStream(), target);

        return "/uploads/logos/" + fileName;
    }
}
