package com.pichincha.mbbk.document.catalog.repository;

import com.pichincha.mbbk.document.catalog.entity.Squad;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SquadRepository extends JpaRepository<Squad, UUID> {

    List<Squad> findAllByOrderByNombreAsc();

    Optional<Squad> findByNombreIgnoreCase(String nombre);
}
