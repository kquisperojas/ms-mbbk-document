package com.pichincha.mbbk.document.jira;

import com.pichincha.mbbk.document.config.AppConfig;
import com.pichincha.mbbk.document.jira.dto.JiraConfigResponse;
import com.pichincha.mbbk.document.jira.dto.JiraInitiativeResponse;
import com.pichincha.mbbk.document.jira.dto.JiraInitiativesResponse;
import com.pichincha.mbbk.document.jira.dto.JiraIssueResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = JiraController.class, properties = "app.cors.allowed-origins=http://localhost:5173")
@Import(AppConfig.class)
class JiraControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JiraService jiraService;

    @Test
    void configReturnsBoardAndJql() throws Exception {
        when(jiraService.config()).thenReturn(new JiraConfigResponse(
                "https://pichinchaperu.atlassian.net",
                "APP",
                "179",
                "https://pichinchaperu.atlassian.net/jira/software/c/projects/APP/boards/179/timeline",
                "Solucionado",
                false,
                null,
                null,
                Map.of("assigned", "filter = 1 AND issuetype in (\"Epic\")", "mine", "assignee = currentUser()")));

        mockMvc.perform(get("/api/v1/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.board").value("179"))
                .andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.jql.assigned").value("filter = 1 AND issuetype in (\"Epic\")"));
    }

    @Test
    void initiativesReturnAssignedEpics() throws Exception {
        when(jiraService.listInitiatives("assigned")).thenReturn(new JiraInitiativesResponse(
                "filter = 1 AND issuetype in (\"Epic\")",
                "assigned",
                List.of(new JiraInitiativeResponse(
                        "APP-14099", "NEG-1668 Desafiliación", "", "Ana", "SOLUCIONADO",
                        "https://pichinchaperu.atlassian.net/browse/APP-14099")),
                List.of("NEG-1678"),
                "2026-10-28T15:00:00Z"));

        mockMvc.perform(get("/api/v1/initiatives?scope=assigned"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].key").value("APP-14099"))
                .andExpect(jsonPath("$.documented[0]").value("NEG-1678"));
    }

    @Test
    void initiativesWithoutTokenReturn503() throws Exception {
        when(jiraService.listInitiatives("assigned"))
                .thenThrow(new JiraNotConfiguredException(
                        "Faltan JIRA_API_TOKEN. Regístralos en Credenciales APIs (tabla credenciales_apis)."));

        mockMvc.perform(get("/api/v1/initiatives"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.detail").value(
                        "Faltan JIRA_API_TOKEN. Regístralos en Credenciales APIs (tabla credenciales_apis)."));
    }

    @Test
    void initiativeReturnsEpicByKey() throws Exception {
        when(jiraService.getIssue("APP-13418")).thenReturn(new JiraIssueResponse(
                "APP-13418",
                "[XDIG] NEG-1357 - Desbloqueo de usuarios por intentos fallidos",
                "",
                "Pedro Quispe Rojas",
                "pquispe-ext@pichincha.pe",
                "SOLUCIONADO",
                "Epic",
                "2025-01-13T12:09:29.044-0500",
                "2026-02-04T16:07:36.348-0500",
                "Niel Ugarte",
                "https://pichinchaperu.atlassian.net/browse/APP-13418",
                List.of()));

        mockMvc.perform(get("/api/v1/initiatives/APP-13418"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.key").value("APP-13418"))
                .andExpect(jsonPath("$.assignee").value("Pedro Quispe Rojas"))
                .andExpect(jsonPath("$.issueType").value("Epic"));
    }
}
