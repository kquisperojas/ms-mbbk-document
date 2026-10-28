package com.pichincha.mbbk.document.jira;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JiraAdfTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void extractsParagraphText() throws Exception {
        var node = mapper.readTree("""
                {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hola"}]}]}
                """);
        assertThat(JiraService.adfToText(node).trim()).isEqualTo("Hola");
    }
}
