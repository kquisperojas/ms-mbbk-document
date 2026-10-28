package com.pichincha.mbbk.document.docs;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Catálogo MS", description = "Inventario de microservicios del canal MBBK")
public class ChannelCatalogController {

    private final DocumentationEngine engine;
    private final ObjectMapper objectMapper;

    public ChannelCatalogController(DocumentationEngine engine, ObjectMapper objectMapper) {
        this.engine = engine;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/catalog")
    @Operation(summary = "Catálogo de microservicios de experiencia y soporte")
    public JsonNode catalog() {
        try {
            return objectMapper.readTree(engine.catalogFile().toFile());
        } catch (IOException ex) {
            throw new DocumentationException(500, "No se pudo leer data/catalog.json");
        }
    }
}
