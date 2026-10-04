package com.pos.app.Repository;

import com.pos.app.Entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("select u from User u where " +
            "(cast(:search as string) is null or cast(:search as string) = '' or " +
            "  lower(u.firstName) like lower(concat('%', cast(:search as string), '%')) or " +
            "  lower(u.lastName) like lower(concat('%', cast(:search as string), '%')) or " +
            "  lower(u.email) like lower(concat('%', cast(:search as string), '%'))) " +
            "and (cast(:role as string) is null or cast(:role as string) = '' or u.role = cast(:role as string)) " +
            "and (:active is null or u.active = :active)")
    Page<User> search(@Param("search") String search,
                       @Param("role") String role,
                       @Param("active") Boolean active,
                       Pageable pageable);

    // Used by the low-stock alert scheduler to notify tenant admins.
    List<User> findByRoleAndActiveTrue(String role);
}
