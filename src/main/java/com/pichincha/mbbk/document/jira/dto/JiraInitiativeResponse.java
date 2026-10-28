package com.pichincha.mbbk.document.jira.dto;

public record JiraInitiativeResponse(
        String key,
        String summary,
        String description,
        String assignee,
        String status,
        String url
) {
}
