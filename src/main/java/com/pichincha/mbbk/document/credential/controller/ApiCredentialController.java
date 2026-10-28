package com.pichincha.mbbk.document.credential.controller;

import com.pichincha.mbbk.document.credential.dto.ApiCredentialRequest;
import com.pichincha.mbbk.document.credential.dto.ApiCredentialResponse;
import com.pichincha.mbbk.document.credential.service.ApiCredentialService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/credenciales-apis")
@Tag(name = "Credenciales APIs", description = "Tokens de GitHub y Jira persistidos en PostgreSQL")
public class ApiCredentialController {

    private final ApiCredentialService service;

    public ApiCredentialController(ApiCredentialService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Listar credenciales de APIs")
    public List<ApiCredentialResponse> findAll() {
        return service.findAll();
    }

    @GetMapping("/{clave}")
    @Operation(summary = "Obtener una credencial por clave")
    public ApiCredentialResponse findByClave(@PathVariable String clave) {
        return service.findByClave(clave);
    }

    @PutMapping
    @Operation(summary = "Crear o actualizar una credencial")
    public ApiCredentialResponse upsert(@Valid @RequestBody ApiCredentialRequest request) {
        return service.upsert(request);
    }
}
