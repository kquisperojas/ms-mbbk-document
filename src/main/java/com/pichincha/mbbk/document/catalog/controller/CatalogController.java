package com.pichincha.mbbk.document.catalog.controller;

import com.pichincha.mbbk.document.catalog.dto.CatalogItemResponse;
import com.pichincha.mbbk.document.catalog.repository.RoleRepository;
import com.pichincha.mbbk.document.catalog.repository.SquadRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/catalogos")
@Tag(name = "Catálogos", description = "Valores de Rol y Squad del formulario de usuario")
public class CatalogController {

    private final RoleRepository roleRepository;
    private final SquadRepository squadRepository;

    public CatalogController(RoleRepository roleRepository, SquadRepository squadRepository) {
        this.roleRepository = roleRepository;
        this.squadRepository = squadRepository;
    }

    @GetMapping("/roles")
    @Operation(summary = "Listar roles disponibles")
    public List<CatalogItemResponse> roles() {
        return roleRepository.findAllByOrderByNombreAsc().stream().map(CatalogItemResponse::from).toList();
    }

    @GetMapping("/squads")
    @Operation(summary = "Listar squads disponibles")
    public List<CatalogItemResponse> squads() {
        return squadRepository.findAllByOrderByNombreAsc().stream().map(CatalogItemResponse::from).toList();
    }
}
