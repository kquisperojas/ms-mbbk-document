package com.pichincha.mbbk.document.squad.controller;

import com.pichincha.mbbk.document.squad.dto.TeamMemberRequest;
import com.pichincha.mbbk.document.squad.dto.TeamMemberResponse;
import com.pichincha.mbbk.document.squad.service.TeamMemberService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/squad/members")
@Tag(name = "Squad", description = "Miembros del SQUAD Canales Digitales")
public class TeamMemberController {

    private final TeamMemberService service;

    public TeamMemberController(TeamMemberService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Listar miembros del squad")
    public List<TeamMemberResponse> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener un miembro del squad")
    public TeamMemberResponse findById(@PathVariable UUID id) {
        return service.findById(id);
    }

    @PostMapping
    @Operation(summary = "Crear miembro del squad")
    public ResponseEntity<TeamMemberResponse> create(@Valid @RequestBody TeamMemberRequest request) {
        TeamMemberResponse created = service.create(request);
        return ResponseEntity
                .created(ServletUriComponentsBuilder.fromCurrentRequest()
                        .path("/{id}").buildAndExpand(created.id()).toUri())
                .body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar miembro del squad")
    public TeamMemberResponse update(@PathVariable UUID id, @Valid @RequestBody TeamMemberRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Eliminar miembro del squad")
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
