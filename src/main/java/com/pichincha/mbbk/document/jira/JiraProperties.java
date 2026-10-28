package com.pichincha.mbbk.document.jira;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.jira")
public record JiraProperties(
        @DefaultValue("https://pichinchaperu.atlassian.net") String baseUrl,
        @DefaultValue("") String email,
        @DefaultValue("") String apiToken,
        @DefaultValue("APP") String project,
        @DefaultValue("179") String boardId,
        @DefaultValue("Solucionado") String status,
        @DefaultValue("Epic") String issueTypes,
        @DefaultValue("") String jql
) {
    public String trimmedBaseUrl() {
        String value = baseUrl == null ? "" : baseUrl.trim();
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }
}
