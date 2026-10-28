package com.pichincha.mbbk.document.docs;

import com.pichincha.mbbk.document.config.AppConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = GenerateController.class, properties = "app.cors.allowed-origins=http://localhost:5173")
@Import(AppConfig.class)
class GenerateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DocumentationEngine engine;

    @Test
    void rejectsLinkWithoutIssueKey() throws Exception {
        mockMvc.perform(multipart("/api/v1/generate").param("link", "https://example.com"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("El link no contiene una clave de Jira válida (ej. APP-123)."));
    }
}
