package com.pichincha.mbbk.document.jira.dto;

import java.util.Map;

public record JiraConfigResponse(
        String site,
        String project,
        String board,
        String boardUrl,
        String status,
        boolean configured,
        JiraUserResponse user,
        String error,
        Map<String, String> jql
) {
}
