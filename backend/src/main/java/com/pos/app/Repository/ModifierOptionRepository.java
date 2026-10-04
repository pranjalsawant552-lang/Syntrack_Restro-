package com.pos.app.Repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.ModifierOption;

@Repository
public interface ModifierOptionRepository extends JpaRepository<ModifierOption, Long> {
    List<ModifierOption> findByGroupIdInOrderBySortOrderAscOptionIdAsc(Collection<Long> groupIds);

    List<ModifierOption> findByGroupIdOrderBySortOrderAscOptionIdAsc(Long groupId);

    @Modifying
    @Query("delete from ModifierOption o where o.groupId = :groupId")
    void deleteAllByGroupId(@Param("groupId") Long groupId);
}
