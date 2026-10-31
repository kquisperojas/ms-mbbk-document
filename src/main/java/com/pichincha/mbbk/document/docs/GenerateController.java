package com.pichincha.mbbk.document.docs;

import com.fasterxml.jackson.databind.JsonNode;
import com.pichincha.mbbk.document.jira.JiraKeys;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
@Tag(name = "Documentación", description = "Generar informe HTML de iniciativa")
public class GenerateController {

    private final DocumentationEngine engine;

    public GenerateController(DocumentationEngine engine) {
        this.engine = engine;
    }

    @PostMapping(value = "/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Generar o regenerar el portal HTML de una iniciativa")
    public JsonNode generate(
            @RequestParam("link") String link,
            @RequestParam(value = "figma", required = false) String figma,
            @RequestParam(value = "featureBranch", required = false) String featureBranch,
            @RequestParam(value = "ramaFeature", required = false) String ramaFeature,
            @RequestParam(value = "det", required = false) List<MultipartFile> det,
            @RequestParam(value = "sequence", required = false) List<MultipartFile> sequence,
            @RequestParam(value = "architecture", required = false) List<MultipartFile> architecture,
            @RequestParam(value = "tests", required = false) List<MultipartFile> tests,
            @RequestParam(value = "others", required = false) List<MultipartFile> others) throws Exception {
        String key = JiraKeys.extract(link);
        if (key == null) {
            throw new DocumentationException(400, "El link no contiene una clave de Jira válida (ej. APP-123).");
        }
        Path tmp = Files.createTempDirectory("mbbk-generate-");
        try {
            List<String> detPaths = MultipartJobs.save(tmp, det);
            String branch = featureBranch == null || featureBranch.isBlank() ? ramaFeature : featureBranch;
            Map<String, Object> job = new LinkedHashMap<>();
            job.put("key", key);
            job.put("figmaUrl", figma == null ? "" : figma.trim());
            job.put("featureBranch", branch == null ? "" : branch.trim());
            job.put("det", detPaths);
            job.put("sequence", MultipartJobs.save(tmp, sequence));
            job.put("architecture", MultipartJobs.save(tmp, architecture));
            job.put("tests", MultipartJobs.save(tmp, tests));
            job.put("others", MultipartJobs.save(tmp, others));
            return engine.run("generate", job);
        } finally {
            deleteRecursive(tmp);
        }
    }

    @PostMapping(value = "/drafts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Guardar borrador de documentación sin generar el informe")
    public JsonNode saveDraft(
            @RequestParam("link") String link,
            @RequestParam(value = "figma", required = false) String figma,
            @RequestParam(value = "featureBranch", required = false) String featureBranch,
            @RequestParam(value = "ramaFeature", required = false) String ramaFeature,
            @RequestParam(value = "det", required = false) List<MultipartFile> det,
            @RequestParam(value = "sequence", required = false) List<MultipartFile> sequence,
            @RequestParam(value = "architecture", required = false) List<MultipartFile> architecture,
            @RequestParam(value = "tests", required = false) List<MultipartFile> tests,
            @RequestParam(value = "others", required = false) List<MultipartFile> others) throws Exception {
        String key = JiraKeys.extract(link);
        if (key == null) {
            throw new DocumentationException(400, "El link no contiene una clave de Jira válida (ej. APP-123).");
        }
        Path tmp = Files.createTempDirectory("mbbk-draft-");
        try {
            String branch = featureBranch == null || featureBranch.isBlank() ? ramaFeature : featureBranch;
            Map<String, Object> job = new LinkedHashMap<>();
            job.put("key", key);
            job.put("link", link == null ? "" : link.trim());
            job.put("figmaUrl", figma == null ? "" : figma.trim());
            job.put("featureBranch", branch == null ? "" : branch.trim());
            job.put("det", MultipartJobs.save(tmp, det));
            job.put("sequence", MultipartJobs.save(tmp, sequence));
            job.put("architecture", MultipartJobs.save(tmp, architecture));
            job.put("tests", MultipartJobs.save(tmp, tests));
            job.put("others", MultipartJobs.save(tmp, others));
            return engine.run("draft-save", job);
        } finally {
            deleteRecursive(tmp);
        }
    }

    @GetMapping("/drafts/{key}")
    @Operation(summary = "Leer borrador de una iniciativa")
    public JsonNode loadDraft(@PathVariable String key) {
        return engine.run("draft-load", Map.of("key", key));
    }

    @DeleteMapping("/drafts/{key}")
    @Operation(summary = "Eliminar borrador de una iniciativa")
    public JsonNode deleteDraft(@PathVariable String key) {
        return engine.run("draft-delete", Map.of("key", key));
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
