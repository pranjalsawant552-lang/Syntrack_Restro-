package com.pos.app.Service;

import org.springframework.http.ResponseEntity;
import com.pos.app.Entity.SettingMaster;

public interface ISettingMasterService {
    SettingMaster updateSetting(SettingMaster settingMaster);
    ResponseEntity<?> getCurrentSetting();
}
