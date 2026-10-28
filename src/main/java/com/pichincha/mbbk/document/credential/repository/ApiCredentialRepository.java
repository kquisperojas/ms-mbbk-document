package com.pichincha.mbbk.document.credential.repository;

import com.pichincha.mbbk.document.credential.entity.ApiCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApiCredentialRepository extends JpaRepository<ApiCredential, UUID> {

    List<ApiCredential> findAllByOrderByProveedorAscClaveAsc();

    Optional<ApiCredential> findByClaveIgnoreCase(String clave);

    Optional<ApiCredential> findByProveedorIgnoreCaseAndClaveIgnoreCase(String proveedor, String clave);
}
