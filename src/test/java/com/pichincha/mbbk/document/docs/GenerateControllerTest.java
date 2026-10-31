package com.pichincha.mbbk.document.docs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pichincha.mbbk.document.config.AppConfig;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
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

    @Test
    void forwardsFeatureBranchToEngine() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        when(engine.run(eq("generate"), any())).thenReturn(mapper.readTree("{\"key\":\"APP-123\"}"));

        mockMvc.perform(multipart("/api/v1/generate")
                        .file(new MockMultipartFile("det", "det.docx", "application/octet-stream", "x".getBytes()))
                        .param("link", "https://pichinchaperu.atlassian.net/browse/APP-123")
                        .param("featureBranch", "https://github.com/org/repo/tree/feature/x"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.key").value("APP-123"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(engine).run(eq("generate"), captor.capture());
        assertThat(captor.getValue().get("featureBranch")).isEqualTo("https://github.com/org/repo/tree/feature/x");
    }
}
