package com.pos.app.Repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.ModifierGroup;

@Repository
public interface ModifierGroupRepository extends JpaRepository<ModifierGroup, Long> {
    List<ModifierGroup> findAllByOrderByNameAsc();
}
