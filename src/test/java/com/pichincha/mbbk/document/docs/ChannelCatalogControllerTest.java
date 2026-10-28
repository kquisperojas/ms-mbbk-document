package com.pichincha.mbbk.document.docs;

import com.pichincha.mbbk.document.config.AppConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = ChannelCatalogController.class, properties = "app.cors.allowed-origins=http://localhost:5173")
@Import(AppConfig.class)
class ChannelCatalogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DocumentationEngine engine;

    @TempDir
    Path tempDir;

    @Test
    void readsCatalogJson() throws Exception {
        Path file = tempDir.resolve("catalog.json");
        Files.writeString(file, "{\"org\":\"pichincha-peru\",\"experiencia\":[{\"repo\":\"ch-mbbk-bill-payment-v1\"}]}");
        when(engine.catalogFile()).thenReturn(file);

        mockMvc.perform(get("/api/v1/catalog"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.org").value("pichincha-peru"))
                .andExpect(jsonPath("$.experiencia[0].repo").value("ch-mbbk-bill-payment-v1"));
    }
}
