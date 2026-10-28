package com.pichincha.mbbk.document.jira.dto;

import java.util.List;

public record JiraInitiativesResponse(
        String jql,
        String scope,
        List<JiraInitiativeResponse> items,
        List<String> documented,
        String fetchedAt
) {
}
