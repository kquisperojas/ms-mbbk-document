package com.pichincha.mbbk.document.credential.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pichincha.mbbk.document.config.AppConfig;
import com.pichincha.mbbk.document.credential.dto.ApiCredentialRequest;
import com.pichincha.mbbk.document.credential.dto.ApiCredentialResponse;
import com.pichincha.mbbk.document.credential.service.ApiCredentialService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = ApiCredentialController.class, properties = "app.cors.allowed-origins=http://localhost:5173")
@Import(AppConfig.class)
class ApiCredentialControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ApiCredentialService service;

    @Test
    void listsCredentials() throws Exception {
        when(service.findAll()).thenReturn(List.of(new ApiCredentialResponse(
                UUID.fromString("11111111-1111-1111-1111-111111111111"),
                "github",
                "GITHUB_TOKEN",
                "********",
                "Token GitHub",
                true
        )));

        mockMvc.perform(get("/api/v1/credenciales-apis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].clave").value("GITHUB_TOKEN"))
                .andExpect(jsonPath("$[0].proveedor").value("github"))
                .andExpect(jsonPath("$[0].valor").value("********"))
                .andExpect(jsonPath("$[0].configurado").value(true));
    }

    @Test
    void upsertsJiraToken() throws Exception {
        when(service.upsert(any(ApiCredentialRequest.class))).thenReturn(new ApiCredentialResponse(
                UUID.fromString("22222222-2222-2222-2222-222222222222"),
                "jira",
                "JIRA_API_TOKEN",
                "********",
                "Token Jira Cloud",
                true
        ));

        mockMvc.perform(put("/api/v1/credenciales-apis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ApiCredentialRequest(
                                "jira",
                                "JIRA_API_TOKEN",
                                "atlassian-token",
                                "Token Jira Cloud"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.proveedor").value("jira"))
                .andExpect(jsonPath("$.clave").value("JIRA_API_TOKEN"))
                .andExpect(jsonPath("$.valor").value("********"))
                .andExpect(jsonPath("$.configurado").value(true));
    }
}
