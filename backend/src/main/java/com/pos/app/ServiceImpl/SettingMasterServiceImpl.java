package com.pos.app.ServiceImpl;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.pos.app.Entity.SettingMaster;
import com.pos.app.Repository.SettingMasterRepository;
import com.pos.app.Service.ISettingMasterService;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class SettingMasterServiceImpl implements ISettingMasterService {

    private final SettingMasterRepository settingRepo;

    @Override
    public SettingMaster updateSetting(SettingMaster incoming) {
        // get first record if exists
        List<SettingMaster> settings = settingRepo.findAllOrdered();
        SettingMaster existing = settings.isEmpty() ? null : settings.get(0);

        if (existing != null) {
            existing.setCompanyName(incoming.getCompanyName());
            existing.setAddress(incoming.getAddress());
            existing.setCity(incoming.getCity());
            existing.setPhoneNumber(incoming.getPhoneNumber());
            existing.setEmail(incoming.getEmail());
            existing.setGstNumber(incoming.getGstNumber());
            // Preserve branding fields unless explicitly provided, so this general
            // settings form never accidentally wipes out the logo/app name set via
            // the dedicated Branding screen.
            if (incoming.getAppName() != null && !incoming.getAppName().isBlank()) {
                existing.setAppName(incoming.getAppName());
            }
            if (incoming.getLogoUrl() != null && !incoming.getLogoUrl().isBlank()) {
                existing.setLogoUrl(incoming.getLogoUrl());
            }
            return settingRepo.save(existing);
        }

        // if no record exists, create new
        incoming.setSettingId(null); // ✅ ensure new insert
        return settingRepo.save(incoming);
    }

    @Override
    public ResponseEntity<?> getCurrentSetting() {
        List<SettingMaster> settings = settingRepo.findAllOrdered();
        if (settings.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Setting not found");
        }
        return ResponseEntity.ok(settings.get(0));
    }
}
