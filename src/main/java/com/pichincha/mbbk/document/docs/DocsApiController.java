package com.pichincha.mbbk.document.docs;

import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Informes", description = "Índice y administración de informes HTML")
public class DocsApiController {

    private final DocumentationEngine engine;

    public DocsApiController(DocumentationEngine engine) {
        this.engine = engine;
    }

    @GetMapping("/docs")
    @Operation(summary = "Listar informes generados")
    public JsonNode index() {
        return engine.run("index", Map.of());
    }

    @GetMapping("/docs/{key}")
    @Operation(summary = "Obtener modelo o HTML de un informe")
    public JsonNode load(@PathVariable String key) {
        return engine.run("load", Map.of("key", key));
    }

    @PutMapping("/docs/{key}")
    @Operation(summary = "Guardar informe")
    public JsonNode save(@PathVariable String key, @RequestBody JsonNode body) {
        return engine.run("save", Map.of("key", key, "body", body));
    }

    @DeleteMapping("/docs/{key}")
    @Operation(summary = "Eliminar informe (pasa a papelera)")
    public JsonNode delete(@PathVariable String key) {
        return engine.run("delete", Map.of("key", key));
    }

    @PostMapping(value = "/docs/{key}/tests", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Regenerar solo la sección Pruebas")
    public JsonNode tests(
            @PathVariable String key,
            @RequestParam(value = "tests", required = false) List<MultipartFile> tests,
            @RequestParam(value = "featureBranch", required = false) String featureBranch,
            @RequestParam(value = "ramaFeature", required = false) String ramaFeature) throws Exception {
        Path tmp = Files.createTempDirectory("mbbk-tests-");
        try {
            List<String> files = MultipartJobs.save(tmp, tests);
            if (files.isEmpty()) {
                throw new DocumentationException(400, "Adjunta el Excel o CSV de casos de prueba.");
            }
            String branch = featureBranch == null || featureBranch.isBlank() ? ramaFeature : featureBranch;
            if (branch == null || branch.isBlank()) {
                throw new DocumentationException(400, "Indica el link de la rama feature de la solución.");
            }
            Map<String, Object> job = new LinkedHashMap<>();
            job.put("key", key);
            job.put("tests", files);
            job.put("featureBranch", branch.trim());
            return engine.run("tests", job);
        } finally {
            deleteRecursive(tmp);
        }
    }

    private static void deleteRecursive(Path root) {
        try {
            if (!Files.exists(root)) {
                return;
            }
            try (var stream = Files.walk(root)) {
                stream.sorted((a, b) -> b.getNameCount() - a.getNameCount()).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (Exception ignored) {
                        // temp
                    }
                });
            }
        } catch (Exception ignored) {
            // temp
        }
    }
}
