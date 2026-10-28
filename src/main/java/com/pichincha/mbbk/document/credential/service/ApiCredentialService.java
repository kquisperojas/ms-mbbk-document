package com.pichincha.mbbk.document.credential.service;

import com.pichincha.mbbk.document.credential.dto.ApiCredentialRequest;
import com.pichincha.mbbk.document.credential.dto.ApiCredentialResponse;
import com.pichincha.mbbk.document.credential.entity.ApiCredential;
import com.pichincha.mbbk.document.credential.exception.CredentialNotFoundException;
import com.pichincha.mbbk.document.credential.repository.ApiCredentialRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ApiCredentialService {

    private final ApiCredentialRepository repository;

    public ApiCredentialService(ApiCredentialRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ApiCredentialResponse> findAll() {
        return repository.findAllByOrderByProveedorAscClaveAsc().stream()
                .map(ApiCredentialResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ApiCredentialResponse findByClave(String clave) {
        return repository.findByClaveIgnoreCase(clave.trim())
                .map(ApiCredentialResponse::from)
                .orElseThrow(() -> new CredentialNotFoundException(clave));
    }

    @Transactional
    public ApiCredentialResponse upsert(ApiCredentialRequest request) {
        ApiCredential credential = repository
                .findByProveedorIgnoreCaseAndClaveIgnoreCase(request.proveedor().trim(), request.clave().trim())
                .orElseGet(ApiCredential::new);
        credential.setProveedor(request.proveedor().trim().toLowerCase());
        credential.setClave(request.clave().trim());
        credential.setValor(request.valor().trim());
        credential.setDescripcion(request.descripcion() == null ? null : request.descripcion().trim());
        return ApiCredentialResponse.from(repository.save(credential));
    }
}
