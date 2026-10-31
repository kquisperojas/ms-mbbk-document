package com.pichincha.mbbk.document.docs;

import com.fasterxml.jackson.databind.JsonNode;
import com.pichincha.mbbk.document.docs.comment.ApproveRequest;
import com.pichincha.mbbk.document.docs.comment.InitiativeCommentRequest;
import com.pichincha.mbbk.document.docs.comment.InitiativeCommentResponse;
import com.pichincha.mbbk.document.docs.comment.InitiativeCommentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Informes", description = "Índice y administración de informes HTML")
public class DocsApiController {

    private final DocumentationEngine engine;
    private final InitiativeCommentService comments;

    public DocsApiController(DocumentationEngine engine, InitiativeCommentService comments) {
        this.engine = engine;
        this.comments = comments;
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

    @GetMapping("/docs/{key}/review")
    @Operation(summary = "Obtener estado de la iniciativa y comentarios persistidos")
    public Map<String, Object> loadReview(@PathVariable String key) {
        return comments.loadReview(key);
    }

    @PostMapping("/docs/{key}/comentarios")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Publicar un comentario de la iniciativa")
    public InitiativeCommentResponse createComment(
            @PathVariable String key,
            @Valid @RequestBody InitiativeCommentRequest request) {
        return comments.create(key, request);
    }

    @PutMapping("/docs/{key}/comentarios/{id}")
    @Operation(summary = "Editar un comentario propio")
    public InitiativeCommentResponse updateComment(
            @PathVariable String key,
            @PathVariable UUID id,
            @Valid @RequestBody InitiativeCommentRequest request) {
        return comments.update(key, id, request);
    }

    @DeleteMapping("/docs/{key}/comentarios/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Eliminar un comentario")
    public void deleteComment(
            @PathVariable String key,
            @PathVariable UUID id,
            @RequestParam(required = false) UUID usuarioId,
            @RequestParam(required = false) String githubUsername) {
        comments.delete(key, id, usuarioId, githubUsername);
    }

    @PostMapping("/docs/{key}/aprobar")
    @Operation(summary = "Aprobar y publicar la documentación (solo líder técnico)")
    public Map<String, Object> approve(
            @PathVariable String key,
            @Valid @RequestBody ApproveRequest request) {
        return comments.approve(key, request);
    }

    @PutMapping("/docs/{key}/review")
    @Operation(summary = "Actualizar estado de revisión (sin comentarios)")
    public JsonNode saveReview(@PathVariable String key, @RequestBody JsonNode body) {
        return engine.run("review-save", Map.of("key", key, "body", body));
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

    @PostMapping(value = "/docs/{key}/iniciativa", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Reprocesar la sección Iniciativa")
    public JsonNode iniciativa(
            @PathVariable String key,
            @RequestParam(value = "det", required = false) List<MultipartFile> det,
            @RequestParam(value = "link", required = false) String link,
            @RequestParam(value = "jiraUrl", required = false) String jiraUrl) throws Exception {
        Path tmp = Files.createTempDirectory("mbbk-iniciativa-");
        try {
            List<String> files = MultipartJobs.save(tmp, det);
            if (files.isEmpty()) {
                throw new DocumentationException(400, "Adjunta el documento técnico (DET).");
            }
            String epic = link == null || link.isBlank() ? jiraUrl : link;
            if (epic == null || epic.isBlank()) {
                throw new DocumentationException(400, "Indica el link de la épica.");
            }
            Map<String, Object> job = new LinkedHashMap<>();
            job.put("key", key);
            job.put("det", files);
            job.put("link", epic.trim());
            return engine.run("iniciativa", job);
        } finally {
            deleteRecursive(tmp);
        }
    }

    @PostMapping(value = "/docs/{key}/diagramas", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Reprocesar la sección Diagramas")
    public JsonNode diagramas(
            @PathVariable String key,
            @RequestParam(value = "sequence", required = false) List<MultipartFile> sequence,
            @RequestParam(value = "architecture", required = false) List<MultipartFile> architecture,
            @RequestParam(value = "useArchify", required = false) String useArchify) throws Exception {
        Path tmp = Files.createTempDirectory("mbbk-diagramas-");
        try {
            List<String> seq = MultipartJobs.save(tmp, sequence);
            List<String> arch = MultipartJobs.save(tmp, architecture);
            if (seq.isEmpty() && arch.isEmpty()) {
                throw new DocumentationException(400, "Adjunta diagramas de secuencia y/o arquitectura.");
            }
            boolean archify = "true".equalsIgnoreCase(useArchify)
                    || "on".equalsIgnoreCase(useArchify)
                    || "1".equals(useArchify);
            Map<String, Object> job = new LinkedHashMap<>();
            job.put("key", key);
            job.put("sequence", seq);
            job.put("architecture", arch);
            job.put("useArchify", archify);
            return engine.run("diagramas", job);
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
