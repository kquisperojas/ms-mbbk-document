package com.pichincha.mbbk.document.jira;

import com.pichincha.mbbk.document.jira.dto.JiraConfigResponse;
import com.pichincha.mbbk.document.jira.dto.JiraInitiativesResponse;
import com.pichincha.mbbk.document.jira.dto.JiraIssueResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Jira", description = "Épicas solucionadas del tablero 179")
public class JiraController {

    private final JiraService service;

    public JiraController(JiraService service) {
        this.service = service;
    }

    @GetMapping("/config")
    @Operation(summary = "Configuración Jira del portal")
    public JiraConfigResponse config() {
        return service.config();
    }

    @GetMapping("/initiatives")
    @Operation(summary = "Listar épicas asignadas y solucionadas del tablero")
    public JiraInitiativesResponse initiatives(@RequestParam(defaultValue = "assigned") String scope) {
        return service.listInitiatives(scope);
    }

    @GetMapping("/initiatives/{key}")
    @Operation(summary = "Obtener una épica de Jira por clave")
    public JiraIssueResponse initiative(@PathVariable String key) {
        return service.getIssue(key);
    }
}
