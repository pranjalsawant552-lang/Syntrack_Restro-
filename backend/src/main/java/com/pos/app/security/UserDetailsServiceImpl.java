package com.pos.app.security;

import com.pos.app.Entity.User;
import com.pos.app.Repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;

/**
 * Loads a TENANT user. Must only be called after TenantContext has been set for the
 * current thread (the routing datasource needs it to hit the right physical DB).
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Autowired
    public UserDetailsServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User appUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        if (!appUser.isActive()) {
            throw new DisabledException("This account has been deactivated");
        }

        Collection<SimpleGrantedAuthority> authorities = new ArrayList<>();
        String role = appUser.getRole();
        if (role != null) {
            authorities.add(new SimpleGrantedAuthority(role.startsWith("ROLE_") ? role : "ROLE_" + role));
        }
        if ("TENANT_ADMIN".equals(role)) {
            for (String code : com.pos.app.Enum.Permission.ALL_CODES) {
                authorities.add(new SimpleGrantedAuthority("PERM_" + code));
            }
        }
        if (appUser.getRoleRef() != null && appUser.getRoleRef().getPermissions() != null) {
            for (String perm : appUser.getRoleRef().getPermissions()) {
                authorities.add(new SimpleGrantedAuthority("PERM_" + perm));
            }
        }

        return new AppUserDetails(
                appUser.getEmail(),
                appUser.getPassword(),
                appUser.isActive(),
                authorities.isEmpty() ? Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER")) : authorities,
                appUser.getTokenVersion(),
                appUser.getId()
        );
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
