package com.pos.app.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.SettingMaster;

@Repository
public interface SettingMasterRepository extends JpaRepository<SettingMaster, Long>{

    @Query("select s from SettingMaster s order by s.settingId asc")
    List<SettingMaster> findAllOrdered();

}
