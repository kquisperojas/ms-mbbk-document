package com.pichincha.mbbk.document.catalog.repository;

import com.pichincha.mbbk.document.catalog.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    List<Role> findAllByOrderByNombreAsc();

    Optional<Role> findByNombreIgnoreCase(String nombre);
}
