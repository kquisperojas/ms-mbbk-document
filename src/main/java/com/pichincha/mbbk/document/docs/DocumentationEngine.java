package com.pichincha.mbbk.document.docs;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pichincha.mbbk.document.credential.repository.ApiCredentialRepository;
import com.pichincha.mbbk.document.jira.JiraProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class DocumentationEngine {

    private final ObjectMapper objectMapper;
    private final ApiCredentialRepository credentials;
    private final JiraProperties jiraProperties;
    private final Path engineDir;
    private final Path docsRoot;
    private final String nodeBin;
    private final String archifyBin;
    private final String canonicalReport;
    private final String githubOrg;

    public DocumentationEngine(
            ObjectMapper objectMapper,
            ApiCredentialRepository credentials,
            JiraProperties jiraProperties,
            @Value("${app.engine-dir:${user.dir}/documentation-engine}") String engineDir,
            @Value("${app.docs-root:C:/WORKSPACE/DOCUMENTACION}") String docsRoot,
            @Value("${app.node-bin:node}") String nodeBin,
            @Value("${app.archify-bin:${user.home}/.agents/skills/archify/bin/archify.mjs}") String archifyBin,
            @Value("${app.canonical-report:C:/WORKSPACE/DOCUMENTACION/NEG-1678/informe-NEG-1678.html}") String canonicalReport,
            @Value("${app.github-org:pichincha-peru}") String githubOrg) {
        this.objectMapper = objectMapper;
        this.credentials = credentials;
        this.jiraProperties = jiraProperties;
        Path resolved = Path.of(engineDir).toAbsolutePath();
        Path fallback = Path.of("C:/WORKSPACE/DOCUMENTACION/ms-mbbk-document/documentation-engine");
        this.engineDir = Files.exists(resolved.resolve("cli.js")) ? resolved : fallback;
        this.docsRoot = Path.of(docsRoot).toAbsolutePath();
        this.nodeBin = nodeBin;
        this.archifyBin = archifyBin;
        this.canonicalReport = canonicalReport;
        this.githubOrg = githubOrg;
    }

    public Path catalogFile() {
        return engineDir.resolve("data").resolve("catalog.json");
    }

    public JsonNode run(String command, Map<String, Object> job) {
        Path jobFile = null;
        try {
            Files.createDirectories(engineDir);
            jobFile = Files.createTempFile(engineDir, "job-", ".json");
            objectMapper.writeValue(jobFile.toFile(), job);
            List<String> cmd = new ArrayList<>();
            cmd.add(nodeBin);
            cmd.add(engineDir.resolve("cli.js").toString());
            cmd.add(command);
            cmd.add(jobFile.toString());
            Path stdoutFile = Files.createTempFile("mbbk-eng-out-", ".json");
            Path stderrFile = Files.createTempFile("mbbk-eng-err-", ".txt");
            ProcessBuilder builder = new ProcessBuilder(cmd);
            builder.directory(engineDir.toFile());
            builder.redirectOutput(stdoutFile.toFile());
            builder.redirectError(stderrFile.toFile());
            Map<String, String> env = builder.environment();
            env.put("DOCS_ROOT", docsRoot.toString());
            env.put("JIRA_BASE_URL", first(credential("JIRA_BASE_URL"), jiraProperties.trimmedBaseUrl()));
            env.put("JIRA_EMAIL", first(credential("JIRA_EMAIL"), jiraProperties.email()));
            env.put("JIRA_API_TOKEN", first(credential("JIRA_API_TOKEN"), jiraProperties.apiToken()));
            env.put("JIRA_PROJECT", jiraProperties.project());
            env.put("JIRA_BOARD_ID", jiraProperties.boardId());
            env.put("JIRA_STATUS", jiraProperties.status());
            env.put("JIRA_ISSUE_TYPES", jiraProperties.issueTypes());
            env.put("GITHUB_TOKEN", first(credential("GITHUB_TOKEN"), System.getenv("GITHUB_TOKEN")));
            env.put("GITHUB_ORG", githubOrg);
            env.put("ARCHIFY_BIN", archifyBin);
            env.put("CANONICAL_REPORT", canonicalReport);
            Process process = builder.start();
            boolean finished = process.waitFor(3, TimeUnit.MINUTES);
            String stdout = Files.readString(stdoutFile, StandardCharsets.UTF_8);
            String stderr = Files.readString(stderrFile, StandardCharsets.UTF_8);
            Files.deleteIfExists(stdoutFile);
            Files.deleteIfExists(stderrFile);
            if (!finished) {
                process.destroyForcibly();
                throw new DocumentationException(504, "El motor de documentación superó 3 minutos.");
            }
            if (process.exitValue() != 0) {
                JsonNode error = readJson(stderr.isBlank() ? stdout : stderr);
                int status = error.path("status").asInt(500);
                String message = error.path("error").asText(stderr.isBlank() ? stdout : stderr);
                throw new DocumentationException(status == 0 ? 500 : status, message);
            }
            return objectMapper.readTree(stdout.isBlank() ? "{}" : stdout);
        } catch (DocumentationException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new DocumentationException(500, "No se pudo ejecutar Node (cli.js). " + ex.getMessage());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new DocumentationException(500, "Generación interrumpida.");
        } catch (Exception ex) {
            throw new DocumentationException(500, ex.getMessage());
        } finally {
            if (jobFile != null) {
                try {
                    Files.deleteIfExists(jobFile);
                } catch (IOException ignored) {
                    // temp job
                }
            }
        }
    }

    private JsonNode readJson(String raw) {
        try {
            return objectMapper.readTree(raw.isBlank() ? "{}" : raw);
        } catch (Exception ex) {
            return objectMapper.createObjectNode().put("error", raw);
        }
    }

    private String credential(String clave) {
        return credentials.findByClaveIgnoreCase(clave).map(row -> row.getValor()).orElse("");
    }

    private static String first(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }
}
