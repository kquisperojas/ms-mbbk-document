package com.pichincha.mbbk.document.jira;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

final class JiraJql {

    private JiraJql() {
    }

    static String build(String scope, String filterId, JiraProperties properties) {
        if (properties.jql() != null && !properties.jql().isBlank()) {
            return properties.jql().trim();
        }
        return String.join(" AND ",
                boardClause(filterId, properties),
                issueTypeClause(properties),
                statusClause(properties),
                assigneeClause(scope)) + " ORDER BY updated DESC";
    }

    private static String boardClause(String filterId, JiraProperties properties) {
        if (filterId != null && !filterId.isBlank()) {
            return "filter = " + filterId.trim();
        }
        if (properties.boardId() != null && !properties.boardId().isBlank()) {
            return "filter = <tablero " + properties.boardId().trim() + ">";
        }
        return "project = " + quote(properties.project());
    }

    private static String issueTypeClause(JiraProperties properties) {
        List<String> types = csv(properties.issueTypes());
        if (types.isEmpty()) {
            return "issuetype = Epic";
        }
        return "issuetype in (" + types.stream().map(JiraJql::quote).collect(Collectors.joining(", ")) + ")";
    }

    private static String statusClause(JiraProperties properties) {
        List<String> statuses = csv(properties.status());
        if (statuses.isEmpty()) {
            statuses = List.of("Solucionado");
        }
        return "status in (" + statuses.stream().map(JiraJql::quote).collect(Collectors.joining(", ")) + ")";
    }

    private static String assigneeClause(String scope) {
        return "mine".equals(scope) ? "assignee = currentUser()" : "assignee IS NOT EMPTY";
    }

    private static List<String> csv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .toList();
    }

    private static String quote(String value) {
        String raw = value == null ? "" : value.trim();
        return "\"" + raw.replace("\"", "\\\"") + "\"";
    }
}
