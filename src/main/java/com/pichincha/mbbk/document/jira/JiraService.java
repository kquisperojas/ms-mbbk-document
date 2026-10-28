package com.pichincha.mbbk.document.jira;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pichincha.mbbk.document.credential.repository.ApiCredentialRepository;
import com.pichincha.mbbk.document.jira.dto.JiraConfigResponse;
import com.pichincha.mbbk.document.jira.dto.JiraInitiativeResponse;
import com.pichincha.mbbk.document.jira.dto.JiraInitiativesResponse;
import com.pichincha.mbbk.document.jira.dto.JiraUserResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@Service
public class JiraService {

    private static final List<String> LIST_FIELDS =
            List.of("summary", "description", "assignee", "status", "issuetype", "updated", "resolutiondate");

    private final JiraProperties properties;
    private final ApiCredentialRepository credentials;
    private final ObjectMapper objectMapper;
    private final Path docsRoot;
    private volatile String cachedBoardId = "";
    private volatile String cachedFilterId = "";

    public JiraService(
            JiraProperties properties,
            ApiCredentialRepository credentials,
            ObjectMapper objectMapper,
            @Value("${app.docs-root:C:/WORKSPACE/DOCUMENTACION}") String docsRoot) {
        this.properties = properties;
        this.credentials = credentials;
        this.objectMapper = objectMapper;
        this.docsRoot = Path.of(docsRoot);
    }

    public JiraConfigResponse config() {
        String site = baseUrl();
        String board = properties.boardId();
        JiraUserResponse user = null;
        String error = null;
        if (configured()) {
            try {
                JsonNode me = get("/rest/api/3/myself");
                user = new JiraUserResponse(text(me, "displayName"), text(me, "emailAddress"));
            } catch (RuntimeException ex) {
                error = ex.getMessage();
            }
        }
        String assigned = JiraJql.build("assigned", resolveFilterIdQuiet(), properties);
        String mine = JiraJql.build("mine", resolveFilterIdQuiet(), properties);
        return new JiraConfigResponse(
                site,
                properties.project(),
                board,
                site + "/jira/software/c/projects/" + properties.project() + "/boards/" + board + "/timeline",
                properties.status(),
                configured(),
                user,
                error,
                Map.of("assigned", assigned, "mine", mine));
    }

    public JiraInitiativesResponse listInitiatives(String rawScope) {
        if (!configured()) {
            throw new JiraNotConfiguredException(missingMessage());
        }
        String scope = "mine".equals(rawScope) ? "mine" : "assigned";
        String jql = JiraJql.build(scope, resolveFilterId(), properties);
        List<JiraInitiativeResponse> items = searchAll(jql).stream().map(this::toInitiative).toList();
        return new JiraInitiativesResponse(jql, scope, items, documentedKeys(), Instant.now().toString());
    }

    boolean configured() {
        return !email().isBlank() && !apiToken().isBlank();
    }

    private String resolveFilterIdQuiet() {
        try {
            return configured() ? resolveFilterId() : "";
        } catch (RuntimeException ex) {
            return "";
        }
    }

    private String resolveFilterId() {
        String boardId = properties.boardId() == null ? "" : properties.boardId().trim();
        if (boardId.isEmpty()) {
            return "";
        }
        if (boardId.equals(cachedBoardId) && cachedFilterId != null && !cachedFilterId.isBlank()) {
            return cachedFilterId;
        }
        JsonNode data = get("/rest/agile/1.0/board/" + boardId + "/configuration");
        String filterId = data.path("filter").path("id").asText("");
        if (filterId.isBlank()) {
            throw new JiraClientException(502, "El tablero " + boardId + " no expone un filtro Jira (configuration.filter.id)");
        }
        cachedBoardId = boardId;
        cachedFilterId = filterId;
        return filterId;
    }

    private List<JsonNode> searchAll(String jql) {
        List<JsonNode> issues = new ArrayList<>();
        String nextPageToken = null;
        do {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("jql", jql);
            body.put("fields", LIST_FIELDS);
            body.put("maxResults", 100);
            if (nextPageToken != null) {
                body.put("nextPageToken", nextPageToken);
            }
            JsonNode data = post("/rest/api/3/search/jql", body);
            data.path("issues").forEach(issues::add);
            nextPageToken = data.path("isLast").asBoolean(true) ? null : text(data, "nextPageToken");
        } while (nextPageToken != null && issues.size() < 500);
        return issues;
    }

    private JiraInitiativeResponse toInitiative(JsonNode issue) {
        JsonNode fields = issue.path("fields");
        String key = text(issue, "key");
        return new JiraInitiativeResponse(
                key,
                text(fields, "summary"),
                adfToText(fields.get("description")).replaceAll("\n{3,}", "\n\n").trim(),
                fields.path("assignee").path("displayName").asText("Sin asignar"),
                fields.path("status").path("name").asText(""),
                baseUrl() + "/browse/" + key);
    }

    private JsonNode get(String apiPath) {
        try {
            JsonNode body = client().get().uri(apiPath).retrieve().body(JsonNode.class);
            return body == null ? objectMapper.createObjectNode() : body;
        } catch (RestClientResponseException ex) {
            throw wrap(ex);
        }
    }

    private JsonNode post(String apiPath, Object payload) {
        try {
            JsonNode body = client().post()
                    .uri(apiPath)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(JsonNode.class);
            return body == null ? objectMapper.createObjectNode() : body;
        } catch (RestClientResponseException ex) {
            throw wrap(ex);
        }
    }

    private RestClient client() {
        String basic = Base64.getEncoder()
                .encodeToString((email() + ":" + apiToken()).getBytes(StandardCharsets.UTF_8));
        return RestClient.builder()
                .baseUrl(baseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + basic)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    private JiraClientException wrap(RestClientResponseException ex) {
        int status = ex.getStatusCode().value();
        String snippet = ex.getResponseBodyAsString();
        if (snippet.length() > 400) {
            snippet = snippet.substring(0, 400);
        }
        int mapped = status == 401 || status == 403 ? status : 502;
        return new JiraClientException(mapped, "Jira respondió " + status + ": " + snippet);
    }

    private String email() {
        return firstNonBlank(credential("JIRA_EMAIL"), properties.email());
    }

    private String apiToken() {
        return firstNonBlank(credential("JIRA_API_TOKEN"), properties.apiToken());
    }

    private String baseUrl() {
        String fromDb = credential("JIRA_BASE_URL");
        if (!fromDb.isBlank()) {
            while (fromDb.endsWith("/")) {
                fromDb = fromDb.substring(0, fromDb.length() - 1);
            }
            return fromDb;
        }
        return properties.trimmedBaseUrl();
    }

    private String credential(String clave) {
        return credentials.findByClaveIgnoreCase(clave).map(row -> row.getValor()).orElse("");
    }

    private String missingMessage() {
        List<String> missing = new ArrayList<>();
        if (email().isBlank()) {
            missing.add("JIRA_EMAIL");
        }
        if (apiToken().isBlank()) {
            missing.add("JIRA_API_TOKEN");
        }
        return "Faltan " + String.join(" y ", missing)
                + ". Regístralos en Credenciales APIs (tabla credenciales_apis).";
    }

    private List<String> documentedKeys() {
        if (!Files.isDirectory(docsRoot)) {
            return List.of();
        }
        try (Stream<Path> stream = Files.list(docsRoot)) {
            return stream
                    .filter(Files::isDirectory)
                    .map(path -> path.getFileName().toString())
                    .filter(name -> !name.startsWith("_"))
                    .filter(name -> Files.exists(docsRoot.resolve(name).resolve("informe-" + name + ".html")))
                    .toList();
        } catch (Exception ex) {
            return List.of();
        }
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private static String text(JsonNode node, String field) {
        return node == null ? "" : node.path(field).asText("");
    }

    static String adfToText(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return "";
        }
        if (node.isTextual()) {
            return node.asText();
        }
        if (node.isArray()) {
            StringBuilder out = new StringBuilder();
            node.forEach(child -> out.append(adfToText(child)));
            return out.toString();
        }
        String type = node.path("type").asText("");
        return switch (type) {
            case "text" -> node.path("text").asText("");
            case "hardBreak" -> "\n";
            case "mention" -> node.path("attrs").path("text").asText("");
            case "emoji" -> node.path("attrs").path("text").asText("");
            case "inlineCard", "blockCard" -> node.path("attrs").path("url").asText("");
            case "paragraph", "heading", "codeBlock", "blockquote" -> adfToText(node.get("content")) + "\n";
            case "listItem" -> "- " + adfToText(node.get("content")).trim() + "\n";
            case "tableRow" -> {
                StringBuilder row = new StringBuilder();
                node.path("content").forEach(cell -> {
                    if (!row.isEmpty()) {
                        row.append(" | ");
                    }
                    row.append(adfToText(cell).trim());
                });
                yield row.append("\n").toString();
            }
            default -> adfToText(node.get("content"));
        };
    }
}
