package com.pichincha.mbbk.document.jira.dto;

import java.util.List;

public record JiraIssueResponse(
        String key,
        String summary,
        String description,
        String assignee,
        String assigneeEmail,
        String status,
        String issueType,
        String created,
        String resolutionDate,
        String reporter,
        String url,
        List<JiraInitiativeResponse> children
) {
}
